import { eq, asc } from 'drizzle-orm';
import { db } from '../db/connection';
import { products, productAttributeValues, productGroups, productGroupAttributes, attributes, productStock } from '../db/schema';
import { AppError } from '../lib/app-error';

// ─── formula evaluation ───────────────────────────────────────────────────────

function deriveAlias(formulaAlias: string | null, attrName: string | null): string {
  if (formulaAlias) return formulaAlias;
  return (attrName ?? '').toLowerCase().replace(/\s+/g, '_');
}

function evalFormula(formula: string, vars: Record<string, number>): number | null {
  try {
    let expr = formula;
    for (const [name, val] of Object.entries(vars)) {
      expr = expr.replace(new RegExp(`\\b${name}\\b`, 'g'), String(val));
    }
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr})`)();
    return typeof result === 'number' && isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

function computeAttributeValues<T extends {
  isQuantityBasis: boolean | null;
  isCalculated: boolean | null;
  isFromInput: boolean | null;
  formula: string | null;
  formulaAlias: string | null;
  attrName: string | null;
  numericValue: number | null;
  sortOrder: number | null;
}>(attrs: T[], stockQty: number): (T & { computedValue: number | null })[] {
  const vars: Record<string, number> = {};
  // Process non-calculated attrs first so their values are in vars before formulas run
  const sorted = attrs.slice().sort((a, b) => {
    const calcA = a.isCalculated ? 1 : 0;
    const calcB = b.isCalculated ? 1 : 0;
    if (calcA !== calcB) return calcA - calcB;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
  return sorted.map((attr) => {
      const alias = deriveAlias(attr.formulaAlias, attr.attrName);
      let computedValue: number | null = null;

      if (attr.isQuantityBasis) {
        computedValue = stockQty;
        vars[alias] = stockQty;
      } else if (attr.isCalculated && attr.formula) {
        computedValue = evalFormula(attr.formula, vars);
        if (computedValue != null) vars[alias] = computedValue;
      } else {
        computedValue = attr.numericValue;
        if (computedValue != null) vars[alias] = computedValue;
      }

      return { ...attr, computedValue };
    });
}

// ─── types ────────────────────────────────────────────────────────────────────

export interface AttributeValueInput {
  productGroupAttributeId: string;
  numericValue?: number | null;
  textValue?: string | null;
}

export interface CreateProductInput {
  name: string;
  sku?: string | null;
  description?: string | null;
  attributeValues: AttributeValueInput[];
}

export type UpdateProductInput = Partial<CreateProductInput>;

// ─── helpers ──────────────────────────────────────────────────────────────────

async function assertGroupExists(groupId: string) {
  const [pg] = await db.select({ id: productGroups.id }).from(productGroups).where(eq(productGroups.id, groupId)).limit(1);
  if (!pg) throw new AppError('Product group not found', 404);
}

async function assertProductBelongsToGroup(productId: string, groupId: string) {
  const [p] = await db.select({ id: products.id, productGroupId: products.productGroupId })
    .from(products).where(eq(products.id, productId)).limit(1);
  if (!p) throw new AppError('Product not found', 404);
  if (p.productGroupId !== groupId) throw new AppError('Product does not belong to this group', 403);
  return p;
}

function buildProduct(rows: {
  id: string; productGroupId: string; name: string; sku: string | null;
  description: string | null; isActive: boolean; createdAt: Date; updatedAt: Date;
  pavId: string | null; pgaId: string | null; numericValue: number | null; textValue: string | null;
}[]) {
  if (rows.length === 0) throw new AppError('Product not found', 404);
  const first = rows[0];
  return {
    id:             first.id,
    productGroupId: first.productGroupId,
    name:           first.name,
    sku:            first.sku,
    description:    first.description,
    isActive:       first.isActive,
    createdAt:      first.createdAt,
    updatedAt:      first.updatedAt,
    attributeValues: rows
      .filter((r) => r.pavId !== null)
      .map((r) => ({
        id:                      r.pavId!,
        productGroupAttributeId: r.pgaId!,
        numericValue:            r.numericValue,
        textValue:               r.textValue,
      })),
  };
}

const SELECT_COLS = {
  id:             products.id,
  productGroupId: products.productGroupId,
  name:           products.name,
  sku:            products.sku,
  description:    products.description,
  isActive:       products.isActive,
  createdAt:      products.createdAt,
  updatedAt:      products.updatedAt,
  pavId:          productAttributeValues.id,
  pgaId:          productAttributeValues.productGroupAttributeId,
  numericValue:   productAttributeValues.numericValue,
  textValue:      productAttributeValues.textValue,
};

// ─── list all (global) ────────────────────────────────────────────────────────

export async function listAllProducts() {
  const rows = await db
    .select({
      id:              products.id,
      productGroupId:  products.productGroupId,
      groupName:       productGroups.name,
      name:            products.name,
      sku:             products.sku,
      isActive:        products.isActive,
      createdAt:       products.createdAt,
      updatedAt:       products.updatedAt,
      pavId:           productAttributeValues.id,
      pgaId:           productAttributeValues.productGroupAttributeId,
      numericValue:    productAttributeValues.numericValue,
      textValue:       productAttributeValues.textValue,
      attrName:        attributes.name,
      attrUnit:        attributes.unit,
      isQuantityBasis: productGroupAttributes.isQuantityBasis,
      isCalculated:    productGroupAttributes.isCalculated,
      isFromInput:     productGroupAttributes.isFromInput,
      formula:         productGroupAttributes.formula,
      formulaAlias:    productGroupAttributes.formulaAlias,
      sortOrder:       productGroupAttributes.sortOrder,
      stockQty:        productStock.quantityOnHand,
    })
    .from(products)
    .innerJoin(productGroups, eq(products.productGroupId, productGroups.id))
    .leftJoin(productAttributeValues, eq(productAttributeValues.productId, products.id))
    .leftJoin(productGroupAttributes, eq(productGroupAttributes.id, productAttributeValues.productGroupAttributeId))
    .leftJoin(attributes, eq(attributes.id, productGroupAttributes.attributeId))
    .leftJoin(productStock, eq(productStock.productId, products.id))
    .orderBy(asc(productGroups.name), asc(products.name));

  const productMap = new Map<string, {
    id: string; productGroupId: string; groupName: string; name: string;
    sku: string | null; isActive: boolean; createdAt: Date; updatedAt: Date;
    stockQty: number;
    attributeValues: {
      id: string; productGroupAttributeId: string;
      numericValue: number | null; textValue: string | null;
      attrName: string | null; attrUnit: string | null;
      isQuantityBasis: boolean | null; isCalculated: boolean | null;
      isFromInput: boolean | null; formula: string | null;
      formulaAlias: string | null; sortOrder: number | null;
    }[];
  }>();

  for (const row of rows) {
    if (!productMap.has(row.id)) {
      productMap.set(row.id, {
        id: row.id, productGroupId: row.productGroupId, groupName: row.groupName,
        name: row.name, sku: row.sku, isActive: row.isActive,
        createdAt: row.createdAt, updatedAt: row.updatedAt,
        stockQty: row.stockQty ?? 0, attributeValues: [],
      });
    }
    if (row.pavId) {
      productMap.get(row.id)!.attributeValues.push({
        id: row.pavId, productGroupAttributeId: row.pgaId!,
        numericValue: row.numericValue, textValue: row.textValue,
        attrName: row.attrName, attrUnit: row.attrUnit,
        isQuantityBasis: row.isQuantityBasis, isCalculated: row.isCalculated,
        isFromInput: row.isFromInput, formula: row.formula,
        formulaAlias: row.formulaAlias, sortOrder: row.sortOrder,
      });
    }
  }

  return Array.from(productMap.values()).map(({ stockQty, ...p }) => ({
    ...p,
    attributeValues: computeAttributeValues(p.attributeValues, stockQty).map(
      ({ formula: _f, ...rest }) => rest,
    ),
  }));
}

// ─── get single product (global, no group context needed) ────────────────────

export async function getProductWithGroup(productId: string) {
  const [rows, stockRows] = await Promise.all([
    db
      .select({
        id:              products.id,
        productGroupId:  products.productGroupId,
        groupName:       productGroups.name,
        name:            products.name,
        sku:             products.sku,
        description:     products.description,
        isActive:        products.isActive,
        createdAt:       products.createdAt,
        updatedAt:       products.updatedAt,
        pavId:           productAttributeValues.id,
        pgaId:           productAttributeValues.productGroupAttributeId,
        numericValue:    productAttributeValues.numericValue,
        textValue:       productAttributeValues.textValue,
        attrName:        attributes.name,
        attrUnit:        attributes.unit,
        isQuantityBasis: productGroupAttributes.isQuantityBasis,
        isCalculated:    productGroupAttributes.isCalculated,
        isFromInput:     productGroupAttributes.isFromInput,
        formula:         productGroupAttributes.formula,
        formulaAlias:    productGroupAttributes.formulaAlias,
        sortOrder:       productGroupAttributes.sortOrder,
      })
      .from(products)
      .innerJoin(productGroups, eq(products.productGroupId, productGroups.id))
      .leftJoin(productAttributeValues, eq(productAttributeValues.productId, products.id))
      .leftJoin(productGroupAttributes, eq(productGroupAttributes.id, productAttributeValues.productGroupAttributeId))
      .leftJoin(attributes, eq(attributes.id, productGroupAttributes.attributeId))
      .where(eq(products.id, productId)),
    db.select({ quantityOnHand: productStock.quantityOnHand })
      .from(productStock)
      .where(eq(productStock.productId, productId))
      .limit(1),
  ]);

  if (rows.length === 0) throw new AppError('Product not found', 404);
  const first = rows[0];
  const stockQty = stockRows[0]?.quantityOnHand ?? 0;

  const rawAttrs = rows
    .filter(r => r.pavId)
    .map(r => ({
      id:                      r.pavId!,
      productGroupAttributeId: r.pgaId!,
      numericValue:            r.numericValue,
      textValue:               r.textValue,
      attrName:                r.attrName,
      attrUnit:                r.attrUnit,
      isQuantityBasis:         r.isQuantityBasis,
      isCalculated:            r.isCalculated,
      isFromInput:             r.isFromInput,
      formula:                 r.formula,
      formulaAlias:            r.formulaAlias,
      sortOrder:               r.sortOrder,
    }));

  const attributeValues = computeAttributeValues(rawAttrs, stockQty).map(
    ({ formula: _f, ...rest }) => rest,
  );

  return {
    id: first.id, productGroupId: first.productGroupId, groupName: first.groupName,
    name: first.name, sku: first.sku, description: first.description,
    isActive: first.isActive, createdAt: first.createdAt, updatedAt: first.updatedAt,
    attributeValues,
  };
}

// ─── list by group ────────────────────────────────────────────────────────────

export async function listProducts(groupId: string) {
  await assertGroupExists(groupId);

  const rows = await db
    .select(SELECT_COLS)
    .from(products)
    .leftJoin(productAttributeValues, eq(productAttributeValues.productId, products.id))
    .where(eq(products.productGroupId, groupId))
    .orderBy(asc(products.createdAt));

  // Collapse rows → products
  const productMap = new Map<string, ReturnType<typeof buildProduct>>();
  for (const row of rows) {
    if (!productMap.has(row.id)) {
      productMap.set(row.id, buildProduct([{ ...row, pavId: null, pgaId: null, numericValue: null, textValue: null }]));
    }
    if (row.pavId) {
      productMap.get(row.id)!.attributeValues.push({
        id:                      row.pavId,
        productGroupAttributeId: row.pgaId!,
        numericValue:            row.numericValue,
        textValue:               row.textValue,
      });
    }
  }

  return Array.from(productMap.values());
}

// ─── get one ──────────────────────────────────────────────────────────────────

export async function getProductById(groupId: string, productId: string) {
  const rows = await db
    .select(SELECT_COLS)
    .from(products)
    .leftJoin(productAttributeValues, eq(productAttributeValues.productId, products.id))
    .where(eq(products.id, productId));

  const product = buildProduct(rows as any);
  if (product.productGroupId !== groupId) throw new AppError('Product not found', 404);
  return product;
}

// ─── create ───────────────────────────────────────────────────────────────────

export async function createProduct(groupId: string, input: CreateProductInput) {
  await assertGroupExists(groupId);

  const [created] = await db.insert(products).values({
    productGroupId: groupId,
    name:           input.name,
    sku:            input.sku ?? null,
    description:    input.description ?? null,
  }).returning();

  if (input.attributeValues.length > 0) {
    await db.insert(productAttributeValues).values(
      input.attributeValues.map((av) => ({
        productId:               created.id,
        productGroupAttributeId: av.productGroupAttributeId,
        numericValue:            av.numericValue ?? null,
        textValue:               av.textValue ?? null,
      }))
    );
  }

  return getProductById(groupId, created.id);
}

// ─── update ───────────────────────────────────────────────────────────────────

export async function updateProduct(groupId: string, productId: string, input: UpdateProductInput) {
  await assertProductBelongsToGroup(productId, groupId);

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name        !== undefined) patch.name        = input.name;
  if (input.sku         !== undefined) patch.sku         = input.sku;
  if (input.description !== undefined) patch.description = input.description;

  await db.update(products).set(patch).where(eq(products.id, productId));

  if (input.attributeValues !== undefined) {
    await db.delete(productAttributeValues).where(eq(productAttributeValues.productId, productId));
    if (input.attributeValues.length > 0) {
      await db.insert(productAttributeValues).values(
        input.attributeValues.map((av) => ({
          productId:               productId,
          productGroupAttributeId: av.productGroupAttributeId,
          numericValue:            av.numericValue ?? null,
          textValue:               av.textValue ?? null,
        }))
      );
    }
  }

  return getProductById(groupId, productId);
}

// ─── delete ───────────────────────────────────────────────────────────────────

export async function deleteProduct(groupId: string, productId: string) {
  await assertProductBelongsToGroup(productId, groupId);
  await db.delete(products).where(eq(products.id, productId));
}
