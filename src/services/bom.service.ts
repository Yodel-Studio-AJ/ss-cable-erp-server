import { eq, asc } from 'drizzle-orm';
import { db } from '../db/connection';
import {
  products, productGroups, productGroupAttributes, productGroupInputs,
  productAttributeValues, attributes, productStock,
} from '../db/schema';
import { AppError } from '../lib/app-error';
import { deriveAlias, evalFormula, computeAttributeValues } from './products.service';

// ─── types ────────────────────────────────────────────────────────────────────

export interface BomCalculateInput {
  outputProductId: string;
  outputQty:       number;
  inputs: {
    bomInputId:     string;
    inputProductId: string;
  }[];
}

// ─── load product with attributes + stock ────────────────────────────────────

async function loadProduct(productId: string) {
  const rows = await db
    .select({
      id:              products.id,
      productGroupId:  products.productGroupId,
      groupName:       productGroups.name,
      name:            products.name,
      sku:             products.sku,
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
    .where(eq(products.id, productId));

  if (rows.length === 0) throw new AppError('Product not found', 404);

  const first    = rows[0];
  const stockQty = first.stockQty ?? 0;

  const rawAttrs = rows
    .filter((r) => r.pavId)
    .map((r) => ({
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
    id:             first.id,
    productGroupId: first.productGroupId,
    groupName:      first.groupName,
    name:           first.name,
    sku:            first.sku,
    attributeValues,
  };
}

// ─── load BOM inputs for a group ─────────────────────────────────────────────

async function loadBomInputs(outputGroupId: string) {
  const rows = await db
    .select({
      id:            productGroupInputs.id,
      outputGroupId: productGroupInputs.outputGroupId,
      inputGroupId:  productGroupInputs.inputGroupId,
      qtyFormula:    productGroupInputs.qtyFormula,
      formulaVars:   productGroupInputs.formulaVars,
      yieldFactor:   productGroupInputs.yieldFactor,
      label:         productGroupInputs.label,
      notes:         productGroupInputs.notes,
      sortOrder:     productGroupInputs.sortOrder,
      inputGroupName: productGroups.name,
    })
    .from(productGroupInputs)
    .innerJoin(productGroups, eq(productGroupInputs.inputGroupId, productGroups.id))
    .where(eq(productGroupInputs.outputGroupId, outputGroupId))
    .orderBy(asc(productGroupInputs.sortOrder));
  return rows;
}

// ─── resolve formula tokens to values ────────────────────────────────────────

function resolveFormula(
  formula:       string,
  outputProduct: Awaited<ReturnType<typeof loadProduct>>,
  inputProduct:  Awaited<ReturnType<typeof loadProduct>>,
  outputQty:     number,
): { vars: Record<string, number>; humanFormula: string } {
  // Build pgaId → numeric value from both products.
  // For the output product's qty-basis attribute, override with the user-supplied outputQty.
  const pgaValues: Record<string, number> = {};

  for (const av of outputProduct.attributeValues) {
    const val = av.isQuantityBasis ? outputQty : (av.computedValue ?? av.numericValue);
    if (val != null) pgaValues[av.productGroupAttributeId] = val;
  }
  for (const av of inputProduct.attributeValues) {
    // Don't overwrite output's qty-basis with input's matching attr
    if (!pgaValues[av.productGroupAttributeId]) {
      const val = av.computedValue ?? av.numericValue;
      if (val != null) pgaValues[av.productGroupAttributeId] = val;
    }
  }

  // Extract pga_<token> patterns directly from the formula string.
  // Tokens use underscores: pga_8c59e7e7_9e1c_4e47_... → UUID 8c59e7e7-9e1c-4e47-...
  const tokenRegex = /\bpga_[0-9a-f_]+\b/g;
  const tokens = [...new Set(formula.match(tokenRegex) ?? [])];

  const vars: Record<string, number> = {};
  let humanFormula = formula;

  // Build a label map from both products for human-readable formula
  const pgaLabel: Record<string, string> = {};
  for (const av of [...outputProduct.attributeValues, ...inputProduct.attributeValues]) {
    pgaLabel[av.productGroupAttributeId] = deriveAlias(av.formulaAlias, av.attrName);
  }

  for (const token of tokens) {
    // Convert token → UUID: strip 'pga_', replace remaining '_' with '-'
    // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    // The token has underscores where hyphens would be: pga_xxxxxxxx_xxxx_xxxx_xxxx_xxxxxxxxxxxx
    const rawUuid = token.slice(4); // strip 'pga_'
    // UUIDs have exactly 5 groups: 8-4-4-4-12 chars
    // Find the 4 hyphen positions by counting hex chars
    const uuid = uuidFromToken(rawUuid);

    const val = pgaValues[uuid];
    if (val != null) vars[token] = val;

    // Replace token with human label
    const label = pgaLabel[uuid] ?? token;
    humanFormula = humanFormula.replace(new RegExp(`\\b${token}\\b`, 'g'), label);
  }

  return { vars, humanFormula };
}

// Convert underscore-separated token back to UUID with hyphens.
// UUID = 8hex-4hex-4hex-4hex-12hex  (total 32 hex chars, 4 hyphens)
function uuidFromToken(raw: string): string {
  // raw is the token after stripping "pga_": xxxxxxxx_xxxx_xxxx_xxxx_xxxxxxxxxxxx
  // We know the hyphen positions in UUID: 8, 4, 4, 4, 12
  // Count hex chars between underscores
  const parts = raw.split('_');
  // parts may be over-split if a group happens to contain no extra underscores
  // Standard UUID split by underscore at those 4 hyphen positions → 5 parts
  // Reassemble with hyphens
  if (parts.length === 5) {
    return parts.join('-');
  }
  // Fallback: re-insert hyphens at known UUID positions (8, 4, 4, 4, 12)
  const hex = parts.join('');
  if (hex.length === 32) {
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // Last resort: replace underscores with hyphens
  return raw.replace(/_/g, '-');
}

// ─── main calculation ─────────────────────────────────────────────────────────

export async function calculateBom(input: BomCalculateInput) {
  const outputProduct = await loadProduct(input.outputProductId);
  const bomInputRows  = await loadBomInputs(outputProduct.productGroupId);

  const qtyBasisAv = outputProduct.attributeValues.find((av) => av.isQuantityBasis);

  const inputResults = await Promise.all(
    input.inputs.map(async (sel) => {
      const bomInput = bomInputRows.find((b) => b.id === sel.bomInputId);
      if (!bomInput) return null;

      const inputProduct = await loadProduct(sel.inputProductId);

      const { vars, humanFormula } = resolveFormula(
        bomInput.qtyFormula,
        outputProduct,
        inputProduct,
        input.outputQty,
      );

      const baseQty    = evalFormula(bomInput.qtyFormula, vars);
      const yf         = parseFloat(bomInput.yieldFactor as string);
      const requiredQty = baseQty != null && yf > 0 ? baseQty / yf : baseQty;

      return {
        bomInputId:     bomInput.id,
        label:          bomInput.label,
        inputGroupId:   bomInput.inputGroupId,
        inputGroupName: bomInput.inputGroupName,
        qtyFormula:     bomInput.qtyFormula,
        humanFormula,
        yieldFactor:    yf,
        notes:          bomInput.notes,
        inputProduct: {
          id:             inputProduct.id,
          name:           inputProduct.name,
          groupName:      inputProduct.groupName,
          sku:            inputProduct.sku,
          attributeValues: inputProduct.attributeValues,
          qtyBasisAttr:   inputProduct.attributeValues.find((av) => av.isQuantityBasis) ?? null,
        },
        baseQty,
        requiredQty,
        error: requiredQty == null
          ? 'Formula could not be evaluated — check that all attribute values are set on both products'
          : null,
      };
    }),
  );

  return {
    outputProductId: outputProduct.id,
    outputProduct: {
      id:             outputProduct.id,
      name:           outputProduct.name,
      groupName:      outputProduct.groupName,
      sku:            outputProduct.sku,
      attributeValues: outputProduct.attributeValues,
      qtyBasisAttr:   qtyBasisAv ?? null,
    },
    outputQty:   input.outputQty,
    inputResults: inputResults.filter(Boolean),
  };
}

// ─── get BOM inputs for a product ────────────────────────────────────────────

export async function getBomInputsForProduct(productId: string) {
  const [product] = await db
    .select({ productGroupId: products.productGroupId })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product) throw new AppError('Product not found', 404);
  return loadBomInputs(product.productGroupId);
}
