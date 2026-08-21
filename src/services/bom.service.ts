import { eq, asc, and } from 'drizzle-orm';
import { db } from '../db/connection';
import {
  products, productGroups, productGroupAttributes, productGroupInputs,
  productAttributeValues, attributes, productStock, productVariantInputs,
  productPricing,
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
  /** Optional overrides for the output product's attribute values (pgaId → value).
   *  Applied before formula evaluation so ratio / mix attrs affect input quantities. */
  attrOverrides?: Record<string, number | string>;
}

// ─── load product with attributes + stock ────────────────────────────────────
// Joins from productGroupAttributes outward so ALL group attrs appear,
// even those with no stored productAttributeValues row (e.g. qty-basis attrs).

async function loadProduct(productId: string, qtyOverride?: number) {
  const [productRow] = await db
    .select({
      id:             products.id,
      productGroupId: products.productGroupId,
      groupName:      productGroups.name,
      name:           products.name,
      sku:            products.sku,
      stockQty:       productStock.quantityOnHand,
      unitPrice:      productPricing.currentPrice,
      pricingMethod:  productPricing.pricingMethod,
    })
    .from(products)
    .innerJoin(productGroups, eq(products.productGroupId, productGroups.id))
    .leftJoin(productStock, eq(productStock.productId, products.id))
    .leftJoin(productPricing, eq(productPricing.productId, products.id))
    .where(eq(products.id, productId))
    .limit(1);

  if (!productRow) throw new AppError('Product not found', 404);

  // All PGAs for this group, left-joined to stored values for this product
  const attrRows = await db
    .select({
      pgaId:           productGroupAttributes.id,
      attrName:        attributes.name,
      attrUnit:        attributes.unit,
      isQuantityBasis: productGroupAttributes.isQuantityBasis,
      isCalculated:    productGroupAttributes.isCalculated,
      isFromInput:     productGroupAttributes.isFromInput,
      formula:         productGroupAttributes.formula,
      formulaAlias:    productGroupAttributes.formulaAlias,
      sortOrder:       productGroupAttributes.sortOrder,
      pavId:           productAttributeValues.id,
      numericValue:    productAttributeValues.numericValue,
      textValue:       productAttributeValues.textValue,
    })
    .from(productGroupAttributes)
    .innerJoin(attributes, eq(attributes.id, productGroupAttributes.attributeId))
    .leftJoin(
      productAttributeValues,
      and(
        eq(productAttributeValues.productGroupAttributeId, productGroupAttributes.id),
        eq(productAttributeValues.productId, productId),
      ),
    )
    .where(eq(productGroupAttributes.productGroupId, productRow.productGroupId))
    .orderBy(asc(productGroupAttributes.sortOrder));

  const stockQty = productRow.stockQty ?? 0;

  const rawAttrs = attrRows.map((r) => ({
    id:                      r.pavId ?? `synthetic_${r.pgaId}`,
    productGroupAttributeId: r.pgaId,
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

  // Keep formula on isFromInput attrs (needed by resolveFormula); strip from others
  function buildAttributeValues(qty: number) {
    return computeAttributeValues(rawAttrs, qty).map(
      ({ formula, isFromInput, ...rest }) => ({
        ...rest,
        isFromInput,
        formula: isFromInput ? formula : null,
      }),
    );
  }

  const attributeValues = buildAttributeValues(stockQty);

  return {
    id:             productRow.id,
    productGroupId: productRow.productGroupId,
    groupName:      productRow.groupName,
    name:           productRow.name,
    sku:            productRow.sku,
    unitPrice:      productRow.unitPrice ?? null,
    pricingMethod:  productRow.pricingMethod ?? null,
    attributeValues,
    // Allow recomputing attrs with a different qty (e.g. requiredQty at BOM time)
    recomputeAttrs: (qty: number) => buildAttributeValues(qty),
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
  // For the output product's isFromInput attributes, resolve their value from the input product
  // by evaluating the isFromInput formula against the input product's attr values.
  const pgaValues: Record<string, number> = {};

  // First, build input pgaId → value map (simple + computed, but NOT qty_basis, because
  // at BOM time the input's qty_basis is what we are solving for)
  const inputPgaValues: Record<string, number> = {};
  for (const av of inputProduct.attributeValues) {
    if (av.isQuantityBasis) continue; // skip — this is the answer, not an input to the formula
    const val = av.computedValue ?? av.numericValue;
    if (val != null) inputPgaValues[av.productGroupAttributeId] = val;
  }

  // Process output product attrs, resolving isFromInput attrs from the input product
  const tokenRegex = /\bpga_[0-9a-f_]+\b/g;
  for (const av of outputProduct.attributeValues) {
    if (av.isQuantityBasis) {
      pgaValues[av.productGroupAttributeId] = outputQty;
    } else if (av.isFromInput && av.formula) {
      // Evaluate the isFromInput formula against input product values
      const fromInputTokens = [...new Set(av.formula.match(tokenRegex) ?? [])];
      const fromInputVars: Record<string, number> = {};
      for (const tok of fromInputTokens) {
        const uuid = uuidFromToken(tok.slice(4));
        const val  = inputPgaValues[uuid];
        if (val != null) fromInputVars[tok] = val;
      }
      const resolved = evalFormula(av.formula, fromInputVars);
      if (resolved != null) pgaValues[av.productGroupAttributeId] = resolved;
      else if (av.numericValue != null) pgaValues[av.productGroupAttributeId] = av.numericValue;
    } else {
      const val = av.computedValue ?? av.numericValue;
      if (val != null) pgaValues[av.productGroupAttributeId] = val;
    }
  }

  // Add all input product attrs (non-qty_basis) — don't overwrite output values
  for (const [pgaId, val] of Object.entries(inputPgaValues)) {
    if (!(pgaId in pgaValues)) pgaValues[pgaId] = val;
  }

  // Extract pga_<token> patterns directly from the formula string.
  // Tokens use underscores: pga_8c59e7e7_9e1c_4e47_... → UUID 8c59e7e7-9e1c-4e47-...
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

// ─── load saved variant inputs for a product ─────────────────────────────────

async function loadSavedVariantInputs(productId: string) {
  const rows = await db
    .select({
      productGroupInputId: productVariantInputs.productGroupInputId,
      inputProductId:      productVariantInputs.inputProductId,
    })
    .from(productVariantInputs)
    .where(eq(productVariantInputs.outputProductId, productId));
  return rows;
}

// ─── single-level BOM calculation ────────────────────────────────────────────

type InputResultBase = {
  bomInputId:     string;
  label:          string | null;
  inputGroupId:   string;
  inputGroupName: string;
  qtyFormula:     string;
  humanFormula:   string;
  yieldFactor:    number;
  notes:          string | null;
  inputProduct: {
    id:              string;
    name:            string;
    groupName:       string;
    sku:             string | null;
    unitPrice:       number | null;
    pricingMethod:   string | null;
    attributeValues: ReturnType<typeof computeAttributeValues>;
    qtyBasisAttr:    ReturnType<typeof computeAttributeValues>[number] | null;
  };
  baseQty:     number | null;
  requiredQty: number | null;
  error:       string | null;
  subBom:      BomLevel | null;
};

export type BomLevel = {
  outputProductId: string;
  outputProduct: {
    id:              string;
    name:            string;
    groupName:       string;
    sku:             string | null;
    unitPrice:       number | null;
    pricingMethod:   string | null;
    attributeValues: ReturnType<typeof computeAttributeValues>;
    qtyBasisAttr:    ReturnType<typeof computeAttributeValues>[number] | null;
  };
  outputQty:    number;
  inputResults: InputResultBase[];
};

async function calculateBomLevel(
  outputProductId: string,
  outputQty:       number,
  // explicit input selections (from caller); falls back to saved variant inputs if empty
  inputSelections: { bomInputId: string; inputProductId: string }[],
  depth:           number,  // to prevent infinite recursion
  attrOverrides?:  Record<string, number | string>,
): Promise<BomLevel> {
  const outputProduct = await loadProduct(outputProductId);

  // Apply caller-supplied attribute overrides (e.g. ratio/mix changes from the sandbox).
  // Only applied at depth 0 so sub-BOM products are unaffected.
  if (depth === 0 && attrOverrides && Object.keys(attrOverrides).length > 0) {
    outputProduct.attributeValues = outputProduct.attributeValues.map((av) => {
      const ov = attrOverrides[av.productGroupAttributeId];
      if (ov === undefined) return av;
      return typeof ov === 'number'
        ? { ...av, numericValue: ov, computedValue: ov }
        : { ...av, textValue: String(ov) };
    });
  }

  const bomInputRows  = await loadBomInputs(outputProduct.productGroupId);
  const qtyBasisAv    = outputProduct.attributeValues.find((av) => av.isQuantityBasis);

  // Merge caller-supplied selections with saved variant inputs for any gaps
  const savedSelections = await loadSavedVariantInputs(outputProductId);
  const selectionMap: Record<string, string> = {};
  for (const s of savedSelections)       selectionMap[s.productGroupInputId] = s.inputProductId;
  for (const s of inputSelections)       selectionMap[s.bomInputId]          = s.inputProductId;

  const inputResults = await Promise.all(
    bomInputRows.map(async (bomInput): Promise<InputResultBase | null> => {
      const inputProductId = selectionMap[bomInput.id];
      if (!inputProductId) return null;

      const inputProduct = await loadProduct(inputProductId);

      const { vars, humanFormula } = resolveFormula(
        bomInput.qtyFormula,
        outputProduct,
        inputProduct,
        outputQty,
      );

      const baseQty     = evalFormula(bomInput.qtyFormula, vars);
      const yf          = parseFloat(bomInput.yieldFactor as string);
      const requiredQty = baseQty != null && yf > 0 ? baseQty / yf : baseQty;

      // Recompute input product attrs using requiredQty so calculated attrs
      // (e.g. "Length of Rod" derived from weight) show actual required quantities.
      const inputAttrsForResult = requiredQty != null
        ? inputProduct.recomputeAttrs(requiredQty)
        : inputProduct.attributeValues;

      // Recursively compute sub-BOM for this input product (if it has BOM inputs)
      let subBom: BomLevel | null = null;
      if (depth < 5 && requiredQty != null) {
        const subBomInputs = await loadBomInputs(inputProduct.productGroupId);
        if (subBomInputs.length > 0) {
          subBom = await calculateBomLevel(inputProductId, requiredQty, [], depth + 1);
        }
      }

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
          id:              inputProduct.id,
          name:            inputProduct.name,
          groupName:       inputProduct.groupName,
          sku:             inputProduct.sku,
          unitPrice:       inputProduct.unitPrice,
          pricingMethod:   inputProduct.pricingMethod,
          attributeValues: inputAttrsForResult,
          qtyBasisAttr:    inputAttrsForResult.find((av) => av.isQuantityBasis) ?? null,
        },
        baseQty,
        requiredQty,
        error: requiredQty == null
          ? 'Formula could not be evaluated — check that all attribute values are set on both products'
          : null,
        subBom,
      } satisfies InputResultBase;
    }),
  );

  return {
    outputProductId: outputProduct.id,
    outputProduct: {
      id:              outputProduct.id,
      name:            outputProduct.name,
      groupName:       outputProduct.groupName,
      sku:             outputProduct.sku,
      unitPrice:       outputProduct.unitPrice,
      pricingMethod:   outputProduct.pricingMethod,
      attributeValues: outputProduct.attributeValues,
      qtyBasisAttr:    qtyBasisAv ?? null,
    },
    outputQty,
    inputResults: inputResults.filter((r): r is InputResultBase => r != null),
  };
}

// ─── public API ──────────────────────────────────────────────────────────────

export async function calculateBom(input: BomCalculateInput) {
  return calculateBomLevel(input.outputProductId, input.outputQty, input.inputs, 0, input.attrOverrides);
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
