import { eq, asc } from 'drizzle-orm';
import { db } from '../db/connection';
import { products, productAttributeValues, productGroups, productGroupAttributes, attributes } from '../db/schema';
import { AppError } from '../lib/app-error';

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
      id:             products.id,
      productGroupId: products.productGroupId,
      groupName:      productGroups.name,
      name:           products.name,
      sku:            products.sku,
      isActive:       products.isActive,
      createdAt:      products.createdAt,
      updatedAt:      products.updatedAt,
      pavId:          productAttributeValues.id,
      pgaId:          productAttributeValues.productGroupAttributeId,
      numericValue:   productAttributeValues.numericValue,
      textValue:      productAttributeValues.textValue,
    })
    .from(products)
    .innerJoin(productGroups, eq(products.productGroupId, productGroups.id))
    .leftJoin(productAttributeValues, eq(productAttributeValues.productId, products.id))
    .orderBy(asc(productGroups.name), asc(products.name));

  const productMap = new Map<string, {
    id: string; productGroupId: string; groupName: string; name: string;
    sku: string | null; isActive: boolean; createdAt: Date; updatedAt: Date;
    attributeValues: { id: string; productGroupAttributeId: string; numericValue: number | null; textValue: string | null }[];
  }>();

  for (const row of rows) {
    if (!productMap.has(row.id)) {
      productMap.set(row.id, {
        id: row.id, productGroupId: row.productGroupId, groupName: row.groupName,
        name: row.name, sku: row.sku, isActive: row.isActive,
        createdAt: row.createdAt, updatedAt: row.updatedAt, attributeValues: [],
      });
    }
    if (row.pavId) {
      productMap.get(row.id)!.attributeValues.push({
        id: row.pavId, productGroupAttributeId: row.pgaId!,
        numericValue: row.numericValue, textValue: row.textValue,
      });
    }
  }

  return Array.from(productMap.values());
}

// ─── get single product (global, no group context needed) ────────────────────

export async function getProductWithGroup(productId: string) {
  const rows = await db
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
      sortOrder:       productGroupAttributes.sortOrder,
    })
    .from(products)
    .innerJoin(productGroups, eq(products.productGroupId, productGroups.id))
    .leftJoin(productAttributeValues, eq(productAttributeValues.productId, products.id))
    .leftJoin(productGroupAttributes, eq(productGroupAttributes.id, productAttributeValues.productGroupAttributeId))
    .leftJoin(attributes, eq(attributes.id, productGroupAttributes.attributeId))
    .where(eq(products.id, productId));

  if (rows.length === 0) throw new AppError('Product not found', 404);
  const first = rows[0];
  return {
    id: first.id, productGroupId: first.productGroupId, groupName: first.groupName,
    name: first.name, sku: first.sku, description: first.description,
    isActive: first.isActive, createdAt: first.createdAt, updatedAt: first.updatedAt,
    attributeValues: rows
      .filter(r => r.pavId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
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
      })),
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
