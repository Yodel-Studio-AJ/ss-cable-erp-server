/**
 * Seed: FR-LSH PVC Insulated Wire — IS 694:2010 / IS 8130-1984 Class 5
 *
 * ── Design ────────────────────────────────────────────────────────────────────
 * BOM inputs per wire variant:
 *   1. Copper Core (any n-strand variant — BOM slot references 16-Strand group
 *      but product_variant_inputs can point to any strand group variant)
 *   2. Grade A PVC   — 70% of total insulation weight (ratio is a wire attribute)
 *   3. Grade B PVC   — 20% of total insulation weight
 *   4. Refurbished PVC — 10% of total insulation weight
 *
 * PVC weight formula (per slot):
 *   π × (overall_dia − ins_thickness) × ins_thickness × length × density / 1000 × mix_ratio
 *   (density comes from each PVC compound via isFromInput)
 *
 * IS table (Class 5, IS 8130-1984):
 *   0.50 mm²  16/0.2   2.20 mm OD  0.6 mm ins  39.0 Ω/km   3–4 A
 *   0.75 mm²  24/0.2   2.30 mm OD  0.6 mm ins  26.0 Ω/km   6–7 A
 *   1.0  mm²  32/0.2   2.50 mm OD  0.6 mm ins  19.5 Ω/km  11–12 A
 *   1.5  mm²  30/0.25  2.70 mm OD  0.6 mm ins  13.3 Ω/km  13–16 A
 *   2.5  mm²  48/0.25  3.40 mm OD  0.7 mm ins   7.98 Ω/km  18–22 A
 *   4.0  mm²  56/0.3   4.00 mm OD  0.8 mm ins   4.95 Ω/km  24–30 A
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection';
import {
  attributes, productGroups, productGroupAttributes, productGroupInputs,
  products, productAttributeValues, productVariantInputs,
} from '../db/schema';

const PI = Math.PI;

// ─── helpers ──────────────────────────────────────────────────────────────────

function pgaToken(id: string) { return `pga_${id.replace(/-/g, '_')}`; }

async function upsertAttr(name: string, unit: string | null, dataType: 'number' | 'string' = 'number'): Promise<string> {
  const [ex] = await db.select({ id: attributes.id }).from(attributes).where(eq(attributes.name, name)).limit(1);
  if (ex) return ex.id;
  const [cr] = await db.insert(attributes).values({ name, unit: unit ?? undefined, dataType }).returning({ id: attributes.id });
  console.log(`  attr+: ${name}`);
  return cr.id;
}

async function upsertGroup(name: string, type: 'raw_material' | 'intermediate' | 'finished_goods', isProcured: boolean, materialType: 'metal' | 'pvc' | 'mixed'): Promise<string> {
  const [ex] = await db.select({ id: productGroups.id }).from(productGroups).where(eq(productGroups.name, name)).limit(1);
  if (ex) { console.log(`  group exists: ${name}`); return ex.id; }
  const [cr] = await db.insert(productGroups).values({ name, type, isProcured, materialType }).returning({ id: productGroups.id });
  console.log(`  group+: ${name} (${cr.id})`);
  return cr.id;
}

async function addPga(groupId: string, attrId: string, opts: {
  isQuantityBasis?: boolean; isCalculated?: boolean; isFromInput?: boolean;
  formula?: string; formulaVars?: Record<string, unknown>;
  formulaAlias?: string; sortOrder: number;
}): Promise<string> {
  const [ex] = await db.select({ id: productGroupAttributes.id }).from(productGroupAttributes)
    .where(and(eq(productGroupAttributes.productGroupId, groupId), eq(productGroupAttributes.attributeId, attrId))).limit(1);
  if (ex) return ex.id;
  const [cr] = await db.insert(productGroupAttributes).values({
    productGroupId:  groupId,
    attributeId:     attrId,
    isQuantityBasis: opts.isQuantityBasis ?? false,
    isCalculated:    opts.isCalculated   ?? false,
    isFromInput:     opts.isFromInput    ?? false,
    formula:         opts.formula        ?? null,
    formulaAlias:    opts.formulaAlias   ?? null,
    sortOrder:       opts.sortOrder,
  }).returning({ id: productGroupAttributes.id });
  return cr.id;
}

async function addBomInput(outputGroupId: string, inputGroupId: string, opts: {
  qtyFormula: string; formulaVars: Record<string, unknown>;
  yieldFactor?: string; label: string; notes?: string; sortOrder: number;
}): Promise<string> {
  const [ex] = await db.select({ id: productGroupInputs.id }).from(productGroupInputs)
    .where(and(
      eq(productGroupInputs.outputGroupId, outputGroupId),
      eq(productGroupInputs.inputGroupId,  inputGroupId),
      eq(productGroupInputs.label,         opts.label),
    )).limit(1);
  if (ex) return ex.id;
  const [cr] = await db.insert(productGroupInputs).values({
    outputGroupId,
    inputGroupId,
    qtyFormula:  opts.qtyFormula,
    formulaVars: opts.formulaVars,
    yieldFactor: opts.yieldFactor ?? '1.0',
    label:       opts.label,
    notes:       opts.notes ?? null,
    sortOrder:   opts.sortOrder,
  }).returning({ id: productGroupInputs.id });
  console.log(`  bom-input+: ${opts.label}`);
  return cr.id;
}

async function upsertProduct(name: string, sku: string, groupId: string): Promise<string> {
  const [ex] = await db.select({ id: products.id }).from(products)
    .where(and(eq(products.productGroupId, groupId), eq(products.name, name))).limit(1);
  if (ex) { console.log(`  product exists: ${name}`); return ex.id; }
  const [cr] = await db.insert(products).values({ name, sku, productGroupId: groupId }).returning({ id: products.id });
  console.log(`  product+: ${name} (${cr.id})`);
  return cr.id;
}

async function setPav(productId: string, pgaId: string, numericValue: number | null, textValue?: string | null) {
  const [ex] = await db.select({ id: productAttributeValues.id }).from(productAttributeValues)
    .where(and(eq(productAttributeValues.productId, productId), eq(productAttributeValues.productGroupAttributeId, pgaId))).limit(1);
  const nv = numericValue as unknown as number; // Drizzle numeric ↔ string quirk
  if (ex) await db.update(productAttributeValues).set({ numericValue: nv, textValue: textValue ?? null }).where(eq(productAttributeValues.id, ex.id));
  else     await db.insert(productAttributeValues).values({ productId, productGroupAttributeId: pgaId, numericValue: nv, textValue: textValue ?? null });
}

async function setVariantInput(outputProductId: string, bomInputId: string, inputProductId: string) {
  const [ex] = await db.select({ id: productVariantInputs.id }).from(productVariantInputs)
    .where(and(eq(productVariantInputs.outputProductId, outputProductId), eq(productVariantInputs.productGroupInputId, bomInputId))).limit(1);
  if (ex) await db.update(productVariantInputs).set({ inputProductId }).where(eq(productVariantInputs.id, ex.id));
  else     await db.insert(productVariantInputs).values({ outputProductId, productGroupInputId: bomInputId, inputProductId });
}

async function getPgaId(groupId: string, attrName: string): Promise<string> {
  const [row] = await db
    .select({ pgaId: productGroupAttributes.id })
    .from(productGroupAttributes)
    .innerJoin(attributes, eq(attributes.id, productGroupAttributes.attributeId))
    .where(and(eq(productGroupAttributes.productGroupId, groupId), eq(attributes.name, attrName)))
    .limit(1);
  if (!row) throw new Error(`PGA not found: group=${groupId} attr=${attrName}`);
  return row.pgaId;
}

async function getGroupId(name: string): Promise<string> {
  const [row] = await db.select({ id: productGroups.id }).from(productGroups).where(eq(productGroups.name, name)).limit(1);
  if (!row) throw new Error(`Group not found: ${name}`);
  return row.id;
}

async function getProductId(groupId: string, name: string): Promise<string> {
  const [row] = await db.select({ id: products.id }).from(products)
    .where(and(eq(products.productGroupId, groupId), eq(products.name, name))).limit(1);
  if (!row) throw new Error(`Product not found: ${name}`);
  return row.id;
}

// ─── setup N-strand copper core groups ───────────────────────────────────────

const DCW_GROUP_NAME = 'Drawn Copper Wire';

async function setupNStrandGroup(strandCount: number, dcwGroupId: string, dcwVariantName: string): Promise<{ groupId: string; strandInputIds: string[]; variantId: string | null }> {
  const name = `${strandCount}-Strand Copper Core`;
  const [ex] = await db.select({ id: productGroups.id }).from(productGroups).where(eq(productGroups.name, name)).limit(1);
  if (ex) {
    // Already exists — just get input IDs and check for existing variant
    const rows = await db.select({ id: productGroupInputs.id })
      .from(productGroupInputs)
      .where(eq(productGroupInputs.outputGroupId, ex.id))
      .orderBy(productGroupInputs.sortOrder);
    // Try to find existing variants
    const [variant] = await db.select({ id: products.id }).from(products)
      .where(eq(products.productGroupId, ex.id)).limit(1);
    return { groupId: ex.id, strandInputIds: rows.map(r => r.id), variantId: variant?.id ?? null };
  }

  // Create group
  const groupId = await upsertGroup(name, 'intermediate', false, 'metal');

  // Fetch shared attr IDs
  const aLength = await upsertAttr('Length', 'm');
  const aNomCs  = await upsertAttr('Nominal Cross Section', 'mm²');
  const aSf     = await upsertAttr('Stranding Factor', null);

  // PGAs
  const lengthPga = await addPga(groupId, aLength, { isQuantityBasis: true, formulaAlias: 'length', sortOrder: 0 });
  await addPga(groupId, aNomCs, { formulaAlias: 'nominal_cross_section', sortOrder: 1 });
  const sfPga     = await addPga(groupId, aSf,    { formulaAlias: 'stranding_factor', sortOrder: 2 });

  // N BOM input slots → DCW
  const strandInputIds: string[] = [];
  for (let i = 1; i <= strandCount; i++) {
    const formula = `${pgaToken(lengthPga)} * ${pgaToken(sfPga)}`;
    const id = await addBomInput(groupId, dcwGroupId, {
      qtyFormula:  formula,
      formulaVars: {
        [pgaToken(lengthPga)]: { pgaId: lengthPga, attrName: 'Length', alias: 'length' },
        [pgaToken(sfPga)]:     { pgaId: sfPga,     attrName: 'Stranding Factor', alias: 'stranding_factor' },
      },
      label:     `Strand ${i}`,
      notes:     `Strand ${i}`,
      sortOrder: i - 1,
    });
    strandInputIds.push(id);
  }
  return { groupId, strandInputIds, variantId: null };
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {

  // ─── 1. Refurbished PVC variant ──────────────────────────────────────────────
  console.log('\n── Refurbished PVC Compound variant ─────────────────────────');
  const pvcGroupId = await getGroupId('PVC Insulation Compound');

  const densityPga  = await getPgaId(pvcGroupId, 'Density');
  const tensilePga  = await getPgaId(pvcGroupId, 'Tensile Strength');
  const elongPga    = await getPgaId(pvcGroupId, 'Elongation at Break');
  const maxTempPga  = await getPgaId(pvcGroupId, 'Max Operating Temp');
  const volResPga   = await getPgaId(pvcGroupId, 'Volume Resistivity');
  const dielPga     = await getPgaId(pvcGroupId, 'Dielectric Strength');
  const shoreDPga   = await getPgaId(pvcGroupId, 'Shore D Hardness');
  const standardPga = await getPgaId(pvcGroupId, 'Compound Standard');
  const colorPga    = await getPgaId(pvcGroupId, 'Color');

  // Refurbished Grade A — re-processed Grade A from previous cycle.
  // Same density/temp, slightly reduced tensile & elongation from thermal history.
  const pvcRef = await upsertProduct('Refurbished Grade A PVC Compound', 'PVC-REF-GRA-A', pvcGroupId);
  await setPav(pvcRef, densityPga,  1.40);
  await setPav(pvcRef, tensilePga,  9);          // 10 → 9 MPa (slight thermal degradation)
  await setPav(pvcRef, elongPga,    140);         // 150 → 140 %
  await setPav(pvcRef, maxTempPga,  70);
  await setPav(pvcRef, volResPga,   1e12);
  await setPav(pvcRef, dielPga,     14);
  await setPav(pvcRef, shoreDPga,   75);
  await setPav(pvcRef, standardPga, null, 'Refurbished — re-processed Grade A TM1');
  await setPav(pvcRef, colorPga,    null, 'Black');

  // Convenience references for later (existing Grade A & B products)
  const pvcA = await getProductId(pvcGroupId, 'Grade A PVC Compound');
  const pvcB = await getProductId(pvcGroupId, 'Grade B PVC Compound');

  // ─── 2. Additional DCW variants for 1.5 / 2.5 / 4.0 mm² sizes ──────────────
  console.log('\n── Additional DCW variants ───────────────────────────────────');
  const dcwGroupId = await getGroupId(DCW_GROUP_NAME);
  // These PGA IDs are stable (from inspect-dcw / _tmp_query output)
  const dcwCsPga   = '918cb107-b032-4989-be65-1b75d8dc75ec'; // Cross Section Area
  const dcwDensPga = 'da53d9e0-7f83-4a64-988f-a0510601d165'; // Density Of Drawn Copper Wire (isFromInput)

  // 0.25mm wire → π × 0.125² = 0.049087 mm²  (already created in fine-wire seed but idempotent)
  const dcw025Id = await upsertProduct('0.25mm Drawn Copper Wire', 'DCW-025MM', dcwGroupId);
  await setPav(dcw025Id, dcwCsPga,   PI * 0.125 * 0.125);
  await setPav(dcw025Id, dcwDensPga, 8960);

  // 0.3mm wire → π × 0.15² = 0.070686 mm²
  const dcw03Id = await upsertProduct('0.3mm Drawn Copper Wire', 'DCW-03MM', dcwGroupId);
  await setPav(dcw03Id, dcwCsPga,   PI * 0.15 * 0.15);
  await setPav(dcw03Id, dcwDensPga, 8960);

  // Both link to 8mm² Copper Rod (close enough — actual plant may use 10mm² for 0.3mm wire)
  const rodGroupId = await getGroupId('Copper Rods');
  const rod8mm = await getProductId(rodGroupId, '8 mm² Copper Rod');
  const dcwBomInput = await db.select({ id: productGroupInputs.id })
    .from(productGroupInputs)
    .where(eq(productGroupInputs.inputGroupId, rodGroupId))
    .then(rows => rows[0]?.id ?? null);
  if (dcwBomInput) {
    await setVariantInput(dcw025Id, dcwBomInput, rod8mm);
    await setVariantInput(dcw03Id,  dcwBomInput, rod8mm);
    console.log(`  0.25mm & 0.3mm DCW → 8mm² Copper Rod`);
  }

  // ─── 3. N-strand copper core groups for 1.5 / 2.5 / 4.0 mm² ────────────────
  console.log('\n── N-strand groups for 1.5 / 2.5 / 4.0 mm² sizes ───────────');

  const g30 = await setupNStrandGroup(30, dcwGroupId, '0.25mm Drawn Copper Wire');
  const g48 = await setupNStrandGroup(48, dcwGroupId, '0.25mm Drawn Copper Wire');
  const g56 = await setupNStrandGroup(56, dcwGroupId, '0.3mm Drawn Copper Wire');

  // ─── 4. Core variants for new sizes ──────────────────────────────────────────
  console.log('\n── Core variants ────────────────────────────────────────────');

  // Helper: get or create a core variant and assign all strand slots → given DCW
  async function ensureCoreVariant(groupId: string, strandInputIds: string[], opts: {
    name: string; sku: string; nominalCsVal: number; sfVal: number; dcwId: string;
  }): Promise<string> {
    const variantId = await upsertProduct(opts.name, opts.sku, groupId);
    const csPga = await getPgaId(groupId, 'Nominal Cross Section');
    const sfPga = await getPgaId(groupId, 'Stranding Factor');
    await setPav(variantId, csPga, opts.nominalCsVal);
    await setPav(variantId, sfPga, opts.sfVal);
    for (const slotId of strandInputIds) {
      await setVariantInput(variantId, slotId, opts.dcwId);
    }
    return variantId;
  }

  // 30-strand 0.25mm → 30 × 0.049087 = 1.473 mm² ≈ 1.5 mm²
  await ensureCoreVariant(g30.groupId, g30.strandInputIds, {
    name: '1.5mm² 30-Strand Copper Core', sku: 'CORE-15SQ-30STR',
    nominalCsVal: 1.5, sfVal: 1.03, dcwId: dcw025Id,
  });

  // 48-strand 0.25mm → 48 × 0.049087 = 2.356 mm² ≈ 2.5 mm²
  await ensureCoreVariant(g48.groupId, g48.strandInputIds, {
    name: '2.5mm² 48-Strand Copper Core', sku: 'CORE-25SQ-48STR',
    nominalCsVal: 2.5, sfVal: 1.03, dcwId: dcw025Id,
  });

  // 56-strand 0.3mm → 56 × 0.070686 = 3.958 mm² ≈ 4.0 mm²
  await ensureCoreVariant(g56.groupId, g56.strandInputIds, {
    name: '4.0mm² 56-Strand Copper Core', sku: 'CORE-40SQ-56STR',
    nominalCsVal: 4.0, sfVal: 1.03, dcwId: dcw03Id,
  });

  // Also ensure the 3 fine-wire core variants are present (created in previous seed)
  // Look up group IDs for reference in wire variant setup
  const g16Id = await getGroupId('16-Strand Copper Core');
  const g24Id = await getGroupId('24-Strand Copper Core');
  const g32Id = await getGroupId('32-Strand Copper Core');
  const core05  = await getProductId(g16Id, '0.5mm² 16-Strand Copper Core');
  const core075 = await getProductId(g24Id, '0.75mm² 24-Strand Copper Core');
  const core10  = await getProductId(g32Id, '1.0mm² 32-Strand Copper Core');
  const core15  = await getProductId(g30.groupId, '1.5mm² 30-Strand Copper Core');
  const core25  = await getProductId(g48.groupId, '2.5mm² 48-Strand Copper Core');
  const core40  = await getProductId(g56.groupId, '4.0mm² 56-Strand Copper Core');
  console.log(`  Cores ready: 0.5 / 0.75 / 1.0 / 1.5 / 2.5 / 4.0 mm²`);

  // ─── 5. FR-LSH Wire group and attributes ─────────────────────────────────────
  console.log('\n── FR-LSH Wire product group ─────────────────────────────────');
  const wireGroupId = await upsertGroup('FR-LSH PVC Insulated Wire', 'finished_goods', false, 'mixed');

  // Attributes needed (some shared with other groups, reuse by name)
  const aLength     = await upsertAttr('Length',                 'm');
  const aNomArea    = await upsertAttr('Nominal Conductor Area', 'mm²');
  const aOvDia      = await upsertAttr('Overall Diameter',       'mm');
  const aInsTh      = await upsertAttr('Insulation Thickness',   'mm');
  const aMaxRes     = await upsertAttr('Max Resistance',         'Ω/km');
  const aCurrCap    = await upsertAttr('Current Carrying Capacity', 'A');
  const aInsDens    = await upsertAttr('Insulation Density',     'g/cm³'); // isFromInput
  const aRatioA     = await upsertAttr('Grade A Mix Ratio',      null);
  const aRatioB     = await upsertAttr('Grade B Mix Ratio',      null);
  const aRatioRef   = await upsertAttr('Recycle Mix Ratio',      null);
  const aVoltGrade  = await upsertAttr('Voltage Grade',          'V');
  const aStandard   = await upsertAttr('Wire Standard',          null, 'string');
  const aColor      = await upsertAttr('Color',                  null, 'string');

  // PGAs on the wire group
  const wLengthPga   = await addPga(wireGroupId, aLength,    { isQuantityBasis: true, formulaAlias: 'length',    sortOrder: 0 });
  const wNomAreaPga  = await addPga(wireGroupId, aNomArea,   { formulaAlias: 'nominal_area',    sortOrder: 1 });
  const wOvDiaPga    = await addPga(wireGroupId, aOvDia,     { formulaAlias: 'overall_dia',     sortOrder: 2 });
  const wInsThPga    = await addPga(wireGroupId, aInsTh,     { formulaAlias: 'ins_thickness',   sortOrder: 3 });
  const wMaxResPga   = await addPga(wireGroupId, aMaxRes,    { formulaAlias: 'max_resistance',  sortOrder: 4 });
  const wCurrCapPga  = await addPga(wireGroupId, aCurrCap,   { formulaAlias: 'current_cap',     sortOrder: 5 });
  const wVoltPga     = await addPga(wireGroupId, aVoltGrade, { formulaAlias: 'voltage_grade',   sortOrder: 6 });
  // isFromInput: pulls density from whichever PVC compound is assigned
  // formula = just the PVC density PGA token (identity function)
  const wInsDensPga  = await addPga(wireGroupId, aInsDens, {
    isFromInput: true,
    isCalculated: true,
    formula:      pgaToken(densityPga),   // densityPga = PVC group's density PGA
    formulaAlias: 'ins_density',
    sortOrder:    7,
  });
  const wRatioAPga   = await addPga(wireGroupId, aRatioA,   { formulaAlias: 'grade_a_ratio',   sortOrder: 8 });
  const wRatioBPga   = await addPga(wireGroupId, aRatioB,   { formulaAlias: 'grade_b_ratio',   sortOrder: 9 });
  const wRatioRefPga = await addPga(wireGroupId, aRatioRef, { formulaAlias: 'recycle_ratio',   sortOrder: 10 });
  const wStdPga      = await addPga(wireGroupId, aStandard, { sortOrder: 11 });
  const wColorPga    = await addPga(wireGroupId, aColor,    { sortOrder: 12 });

  console.log(`  Wire group PGAs ready`);
  console.log(`  isFromInput density PGA: ${wInsDensPga} (formula: ${pgaToken(densityPga)})`);

  // ─── 6. BOM inputs ────────────────────────────────────────────────────────────
  console.log('\n── BOM inputs ───────────────────────────────────────────────');

  // PVC mass formula = π × (D − t) × t × L × ρ / 1000  [result in kg]
  // Then multiply by the blend ratio (grade-specific PGA on the wire)
  // Variables:
  //   wOvDiaPga   → overall_dia (mm)  — from wire variant
  //   wInsThPga   → ins_thickness (mm) — from wire variant
  //   wLengthPga  → length (m)         — qty_basis = outputQty
  //   wInsDensPga → density (g/cm³)    — isFromInput, resolved from PVC compound

  const pvcBaseFormula = (ratioPga: string) =>
    `3.14159265358979 * (${pgaToken(wOvDiaPga)} - ${pgaToken(wInsThPga)}) ` +
    `* ${pgaToken(wInsThPga)} * ${pgaToken(wLengthPga)} ` +
    `* ${pgaToken(wInsDensPga)} / 1000 * ${pgaToken(ratioPga)}`;

  const pvcFormulaVars = (ratioPga: string, ratioAlias: string) => ({
    [pgaToken(wOvDiaPga)]:   { pgaId: wOvDiaPga,   attrName: 'Overall Diameter',  alias: 'overall_dia' },
    [pgaToken(wInsThPga)]:   { pgaId: wInsThPga,   attrName: 'Insulation Thickness', alias: 'ins_thickness' },
    [pgaToken(wLengthPga)]:  { pgaId: wLengthPga,  attrName: 'Length',             alias: 'length' },
    [pgaToken(wInsDensPga)]: { pgaId: wInsDensPga, attrName: 'Insulation Density', alias: 'ins_density' },
    [pgaToken(ratioPga)]:    { pgaId: ratioPga,    attrName: ratioAlias,           alias: ratioAlias.toLowerCase().replace(/\s+/g, '_') },
  });

  // Copper Core BOM slot — formula = wire length (the core needs exactly that length)
  const coreSlotId = await addBomInput(wireGroupId, g16Id, {
    qtyFormula:  pgaToken(wLengthPga),
    formulaVars: { [pgaToken(wLengthPga)]: { pgaId: wLengthPga, attrName: 'Length', alias: 'length' } },
    label:       'Copper Core',
    notes:       'Stranded copper conductor (class 5). Actual variant can come from any N-strand group.',
    sortOrder:   0,
  });

  // Grade A PVC slot
  const pvcASlotId = await addBomInput(wireGroupId, pvcGroupId, {
    qtyFormula:  pvcBaseFormula(wRatioAPga),
    formulaVars: pvcFormulaVars(wRatioAPga, 'Grade A Mix Ratio'),
    label:       'PVC — Grade A',
    notes:       'Primary virgin insulation compound (default 70% of blend)',
    sortOrder:   1,
  });

  // Grade B PVC slot
  const pvcBSlotId = await addBomInput(wireGroupId, pvcGroupId, {
    qtyFormula:  pvcBaseFormula(wRatioBPga),
    formulaVars: pvcFormulaVars(wRatioBPga, 'Grade B Mix Ratio'),
    label:       'PVC — Grade B',
    notes:       'Secondary virgin insulation compound (default 20% of blend)',
    sortOrder:   2,
  });

  // Refurbished PVC slot
  const pvcRefSlotId = await addBomInput(wireGroupId, pvcGroupId, {
    qtyFormula:  pvcBaseFormula(wRatioRefPga),
    formulaVars: pvcFormulaVars(wRatioRefPga, 'Recycle Mix Ratio'),
    label:       'PVC — Refurbished',
    notes:       'Re-processed Grade A from previous production cycle (default 10% of blend)',
    sortOrder:   3,
  });

  console.log(`  4 BOM input slots: Core, Grade A PVC, Grade B PVC, Refurbished PVC`);

  // ─── 7. Wire variants ─────────────────────────────────────────────────────────
  console.log('\n── Wire variants (IS 694:2010) ───────────────────────────────');

  type WireSpec = {
    name: string; sku: string; nominalArea: number;
    overallDia: number; insThickness: number; maxRes: number; currCap: number;
    coreId: string;
    // Optional override ratios; default 0.70 / 0.20 / 0.10
    ratioA?: number; ratioB?: number; ratioRef?: number;
    color?: string;
  };

  const wireSizes: WireSpec[] = [
    { name: '0.5mm² FR-LSH Wire (Red)',   sku: 'FRLSH-05SQ-RED',  nominalArea: 0.5,  overallDia: 2.20, insThickness: 0.6, maxRes: 39.0,  currCap: 4,  coreId: core05,  color: 'Red' },
    { name: '0.5mm² FR-LSH Wire (Black)', sku: 'FRLSH-05SQ-BLK',  nominalArea: 0.5,  overallDia: 2.20, insThickness: 0.6, maxRes: 39.0,  currCap: 4,  coreId: core05,  color: 'Black' },
    { name: '0.75mm² FR-LSH Wire (Red)',  sku: 'FRLSH-075SQ-RED', nominalArea: 0.75, overallDia: 2.30, insThickness: 0.6, maxRes: 26.0,  currCap: 7,  coreId: core075, color: 'Red' },
    { name: '0.75mm² FR-LSH Wire (Blue)', sku: 'FRLSH-075SQ-BLU', nominalArea: 0.75, overallDia: 2.30, insThickness: 0.6, maxRes: 26.0,  currCap: 7,  coreId: core075, color: 'Blue' },
    { name: '1.0mm² FR-LSH Wire (Black)', sku: 'FRLSH-10SQ-BLK',  nominalArea: 1.0,  overallDia: 2.50, insThickness: 0.6, maxRes: 19.5,  currCap: 12, coreId: core10,  color: 'Black' },
    { name: '1.5mm² FR-LSH Wire (Black)', sku: 'FRLSH-15SQ-BLK',  nominalArea: 1.5,  overallDia: 2.70, insThickness: 0.6, maxRes: 13.3,  currCap: 16, coreId: core15,  color: 'Black' },
    { name: '2.5mm² FR-LSH Wire (Black)', sku: 'FRLSH-25SQ-BLK',  nominalArea: 2.5,  overallDia: 3.40, insThickness: 0.7, maxRes: 7.98,  currCap: 22, coreId: core25,  color: 'Black' },
    { name: '4.0mm² FR-LSH Wire (Black)', sku: 'FRLSH-40SQ-BLK',  nominalArea: 4.0,  overallDia: 4.00, insThickness: 0.8, maxRes: 4.95,  currCap: 30, coreId: core40,  color: 'Black' },
  ];

  for (const w of wireSizes) {
    console.log(`\n  → ${w.name}`);
    const wireId = await upsertProduct(w.name, w.sku, wireGroupId);

    // Numeric attributes
    await setPav(wireId, wNomAreaPga,  w.nominalArea);
    await setPav(wireId, wOvDiaPga,    w.overallDia);
    await setPav(wireId, wInsThPga,    w.insThickness);
    await setPav(wireId, wMaxResPga,   w.maxRes);
    await setPav(wireId, wCurrCapPga,  w.currCap);
    await setPav(wireId, wVoltPga,     1100);
    await setPav(wireId, wRatioAPga,   w.ratioA   ?? 0.70);
    await setPav(wireId, wRatioBPga,   w.ratioB   ?? 0.20);
    await setPav(wireId, wRatioRefPga, w.ratioRef ?? 0.10);
    // Text attributes
    await setPav(wireId, wStdPga,  null, 'IS 694:2010 / IS 8130-1984 Class 5');
    await setPav(wireId, wColorPga, null, w.color ?? 'Black');

    // Assign BOM inputs
    await setVariantInput(wireId, coreSlotId,   w.coreId);
    await setVariantInput(wireId, pvcASlotId,   pvcA);
    await setVariantInput(wireId, pvcBSlotId,   pvcB);
    await setVariantInput(wireId, pvcRefSlotId, pvcRef);

    // Preview PVC calculation at 1000m
    const L = 1000; const ρ = 1.40; const D = w.overallDia; const t = w.insThickness;
    const totalPvc = PI * (D - t) * t * L * ρ / 1000;
    const gradeAkg = totalPvc * (w.ratioA ?? 0.70);
    const gradeBkg = totalPvc * (w.ratioB ?? 0.20);
    const refKg    = totalPvc * (w.ratioRef ?? 0.10);
    console.log(`     PVC @ 1000m: total=${totalPvc.toFixed(3)}kg  A=${gradeAkg.toFixed(3)}kg  B=${gradeBkg.toFixed(3)}kg  Ref=${refKg.toFixed(3)}kg`);
  }

  // ─── 8. Summary ───────────────────────────────────────────────────────────────
  console.log(`
\n✅ FR-LSH Wire seeded successfully.

New items:
  - Refurbished Grade A PVC Compound (variant of PVC Insulation Compound)
  - 0.3mm DCW variant
  - 30-Strand, 48-Strand, 56-Strand Copper Core groups + variants
  - FR-LSH PVC Insulated Wire group with 4 BOM slots:
      1. Copper Core          → formula: length
      2. PVC — Grade A        → formula: π(D−t)·t·L·ρ/1000 × grade_a_ratio (default 70%)
      3. PVC — Grade B        → formula: π(D−t)·t·L·ρ/1000 × grade_b_ratio (default 20%)
      4. PVC — Refurbished    → formula: π(D−t)·t·L·ρ/1000 × recycle_ratio (default 10%)
  - 8 wire variants (0.5 / 0.75 / 1.0 / 1.5 / 2.5 / 4.0 mm², multiple colors)

BOM chain for 1000m of 0.5mm² wire:
  ├─ 0.5mm² 16-Strand Core  →  1000m
  │   ├─ 0.2mm DCW × 16    →  1030m each (via stranding factor 1.03)
  │   │   └─ 8mm² Copper Rod (by weight)
  ├─ Grade A PVC            →  ~3.02 kg  (70% of ~4.32 kg)
  ├─ Grade B PVC            →  ~0.86 kg  (20%)
  └─ Refurbished PVC        →  ~0.43 kg  (10%)
  `);
}

main().catch(console.error).finally(() => process.exit());
