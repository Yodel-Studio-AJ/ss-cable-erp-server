/**
 * Seed: Fine-wire Copper Core variants per IS/IEC standard.
 *
 * Table (user-provided):
 *   0.50 mm²  → 16/0.2  (16 strands, 0.2mm dia)
 *   0.75 mm²  → 24/0.2  (24 strands, 0.2mm dia)
 *   1.0  mm²  → 32/0.2  (32 strands, 0.2mm dia)
 *
 * Wire cross-sections (π × r²):
 *   0.2mm dia  → π × 0.1²  = 0.031416 mm²  (16×0.031416 = 0.5027 ≈ 0.5)
 *   0.25mm dia → π × 0.125² = 0.049087 mm²  (24×0.049087 = 1.178... wait)
 *
 * Verification:
 *   16 × 0.031416 = 0.5027 ≈ 0.50 mm²  ✓
 *   24 × 0.031416 = 0.7540 ≈ 0.75 mm²  ✓
 *   32 × 0.031416 = 1.0053 ≈ 1.00 mm²  ✓
 *
 * All three use 0.2mm wire. The 0.25mm diameter is for the 1.5mm², 2.5mm² sizes.
 *
 * Steps:
 * 1. Create 16, 24, 32-strand Copper Core groups (N BOM input slots each)
 * 2. Create 0.2mm DCW variant (cross_section = 0.031416 mm²)
 * 3. Create 0.25mm DCW variant (cross_section = 0.049087 mm²)
 * 4. Link DCW → 8mm² Copper Rod
 * 5. Create core variants, assign all strand slots → DCW
 */
import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection';
import {
  productGroups, attributes, productGroupAttributes, productGroupInputs,
  products, productAttributeValues, productVariantInputs,
} from '../db/schema';

// ── Existing IDs ──────────────────────────────────────────────────────────────
const DCW_GROUP_ID   = '57fcaa6d-c0ed-4d07-9759-455e707eb62b';
const ROD_8MM_ID     = 'aca49bb3-96c6-4953-bf0f-224137e7abcd';  // 8mm² Copper Rod
const DCW_BOM_INPUT_ID = '1f455814-2bbc-415e-823e-4e061e4be31f'; // DCW→Rod BOM input

// ── Shared attributes (reused from existing groups) ───────────────────────────
const ATTR_LENGTH           = '01c3a216-7ed6-4f17-a95e-8c6c5ccd7a91'; // Length (m)
const ATTR_NOMINAL_CS       = 'd766e9fd-556b-4ff2-8b29-ac5d1de2379b'; // Nominal Cross Section (mm²)
const ATTR_STRANDING_FACTOR = '038e0266-ac6f-4d11-bdec-f24a0c9f1a74'; // Stranding Factor

// ── DCW PGA IDs ───────────────────────────────────────────────────────────────
const DCW_CS_PGA      = '918cb107-b032-4989-be65-1b75d8dc75ec'; // Cross Section Area
const DCW_DENSITY_PGA = 'da53d9e0-7f83-4a64-988f-a0510601d165'; // Density (isFromInput)

function pgaToken(id: string) { return `pga_${id.replace(/-/g, '_')}`; }

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getOrCreateGroup(name: string): Promise<string> {
  const [ex] = await db.select({ id: productGroups.id }).from(productGroups)
    .where(eq(productGroups.name, name)).limit(1);
  if (ex) { console.log(`  exists: ${name} (${ex.id})`); return ex.id; }
  const [cr] = await db.insert(productGroups).values({
    name, type: 'intermediate', materialType: 'metal', isProcured: false,
  }).returning({ id: productGroups.id });
  console.log(`  created: ${name} (${cr.id})`);
  return cr.id;
}

async function addPgaIfMissing(groupId: string, attrId: string, opts: {
  isQuantityBasis?: boolean; formulaAlias?: string; sortOrder: number;
}): Promise<string> {
  const [ex] = await db.select({ id: productGroupAttributes.id }).from(productGroupAttributes)
    .where(and(
      eq(productGroupAttributes.productGroupId, groupId),
      eq(productGroupAttributes.attributeId, attrId),
    )).limit(1);
  if (ex) return ex.id;
  const [cr] = await db.insert(productGroupAttributes).values({
    productGroupId: groupId, attributeId: attrId,
    isQuantityBasis: opts.isQuantityBasis ?? false,
    isCalculated: false, isFromInput: false,
    formulaAlias: opts.formulaAlias ?? null,
    sortOrder: opts.sortOrder,
  }).returning({ id: productGroupAttributes.id });
  return cr.id;
}

async function addBomInputIfMissing(groupId: string, strandNum: number, lengthPgaId: string, sfPgaId: string): Promise<string> {
  const [ex] = await db.select({ id: productGroupInputs.id }).from(productGroupInputs)
    .where(and(
      eq(productGroupInputs.outputGroupId, groupId),
      eq(productGroupInputs.inputGroupId,  DCW_GROUP_ID),
      eq(productGroupInputs.sortOrder,     strandNum - 1),
    )).limit(1);
  if (ex) return ex.id;
  const formula = `${pgaToken(lengthPgaId)} * ${pgaToken(sfPgaId)}`;
  const [cr] = await db.insert(productGroupInputs).values({
    outputGroupId: groupId, inputGroupId: DCW_GROUP_ID,
    qtyFormula: formula,
    formulaVars: {
      [pgaToken(lengthPgaId)]: { pgaId: lengthPgaId, attrName: 'Length', alias: 'length' },
      [pgaToken(sfPgaId)]:     { pgaId: sfPgaId, attrName: 'Stranding Factor', alias: 'stranding_factor' },
    },
    yieldFactor: '1.0', label: `Strand ${strandNum}`,
    notes: `Strand ${strandNum}`,
    sortOrder: strandNum - 1,
  }).returning({ id: productGroupInputs.id });
  return cr.id;
}

async function setupGroup(name: string, strandCount: number): Promise<{ groupId: string; strandInputIds: string[] }> {
  const groupId   = await getOrCreateGroup(name);
  const lengthPga = await addPgaIfMissing(groupId, ATTR_LENGTH,           { isQuantityBasis: true, formulaAlias: 'length',             sortOrder: 0 });
  const csPga     = await addPgaIfMissing(groupId, ATTR_NOMINAL_CS,       { formulaAlias: 'nominal_cross_section',                      sortOrder: 1 });
  const sfPga     = await addPgaIfMissing(groupId, ATTR_STRANDING_FACTOR, { formulaAlias: 'stranding_factor',                           sortOrder: 2 });

  const strandInputIds: string[] = [];
  for (let i = 1; i <= strandCount; i++) {
    const id = await addBomInputIfMissing(groupId, i, lengthPga, sfPga);
    strandInputIds.push(id);
  }
  console.log(`  ${strandCount} BOM input slots ready`);
  return { groupId, strandInputIds };
}

async function upsertProduct(name: string, sku: string, groupId: string): Promise<string> {
  const [ex] = await db.select({ id: products.id }).from(products)
    .where(and(eq(products.productGroupId, groupId), eq(products.name, name))).limit(1);
  if (ex) { console.log(`  exists: ${name}`); return ex.id; }
  const [cr] = await db.insert(products).values({ name, sku, productGroupId: groupId }).returning({ id: products.id });
  console.log(`  created: ${name} (${cr.id})`);
  return cr.id;
}

async function setPav(productId: string, pgaId: string, value: string) {
  const numericValue = parseFloat(value) as unknown as number;
  const [ex] = await db.select({ id: productAttributeValues.id }).from(productAttributeValues)
    .where(and(eq(productAttributeValues.productId, productId), eq(productAttributeValues.productGroupAttributeId, pgaId))).limit(1);
  if (ex) await db.update(productAttributeValues).set({ numericValue }).where(eq(productAttributeValues.id, ex.id));
  else await db.insert(productAttributeValues).values({ productId, productGroupAttributeId: pgaId, numericValue });
}

async function setVariantInput(outputProductId: string, bomInputId: string, inputProductId: string) {
  const [ex] = await db.select({ id: productVariantInputs.id }).from(productVariantInputs)
    .where(and(eq(productVariantInputs.outputProductId, outputProductId), eq(productVariantInputs.productGroupInputId, bomInputId))).limit(1);
  if (ex) await db.update(productVariantInputs).set({ inputProductId }).where(eq(productVariantInputs.id, ex.id));
  else await db.insert(productVariantInputs).values({ outputProductId, productGroupInputId: bomInputId, inputProductId });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const PI = Math.PI;

  // Wire cross-sections
  const cs02  = (PI * Math.pow(0.1,   2)).toFixed(6);  // 0.031416 mm²
  const cs025 = (PI * Math.pow(0.125, 2)).toFixed(6);  // 0.049087 mm²
  console.log(`0.2mm wire cross-section:  ${cs02} mm²`);
  console.log(`0.25mm wire cross-section: ${cs025} mm²`);
  console.log(`Verification: 16 × ${cs02} = ${(16 * parseFloat(cs02)).toFixed(4)} mm² (expect 0.5)`);
  console.log(`Verification: 24 × ${cs02} = ${(24 * parseFloat(cs02)).toFixed(4)} mm² (expect 0.75)`);
  console.log(`Verification: 32 × ${cs02} = ${(32 * parseFloat(cs02)).toFixed(4)} mm² (expect 1.0)`);

  // ── Step 1: Create DCW variants ────────────────────────────────────────────
  console.log('\n── DCW variants ──────────────────────────────────────────────');
  const dcw02Id  = await upsertProduct('0.2mm Drawn Copper Wire',  'DCW-02MM',  DCW_GROUP_ID);
  const dcw025Id = await upsertProduct('0.25mm Drawn Copper Wire', 'DCW-025MM', DCW_GROUP_ID);
  await setPav(dcw02Id,  DCW_CS_PGA,      cs02);
  await setPav(dcw02Id,  DCW_DENSITY_PGA, '8960');
  await setPav(dcw025Id, DCW_CS_PGA,      cs025);
  await setPav(dcw025Id, DCW_DENSITY_PGA, '8960');

  // Link DCW → 8mm² Copper Rod
  await setVariantInput(dcw02Id,  DCW_BOM_INPUT_ID, ROD_8MM_ID);
  await setVariantInput(dcw025Id, DCW_BOM_INPUT_ID, ROD_8MM_ID);
  console.log(`  0.2mm DCW (${dcw02Id}) → 8mm² Copper Rod`);
  console.log(`  0.25mm DCW (${dcw025Id}) → 8mm² Copper Rod`);

  // ── Step 2: Create N-strand groups ─────────────────────────────────────────
  console.log('\n── 16-Strand Copper Core group ───────────────────────────────');
  const g16 = await setupGroup('16-Strand Copper Core', 16);

  console.log('\n── 24-Strand Copper Core group ───────────────────────────────');
  const g24 = await setupGroup('24-Strand Copper Core', 24);

  console.log('\n── 32-Strand Copper Core group ───────────────────────────────');
  const g32 = await setupGroup('32-Strand Copper Core', 32);

  // ── Step 3: Core variants ──────────────────────────────────────────────────
  // Get PGA IDs for each group's Nominal CS and Stranding Factor
  async function getGroupPgas(groupId: string) {
    const pgas = await db.select({
      id: productGroupAttributes.id,
      attrId: productGroupAttributes.attributeId,
      isQuantityBasis: productGroupAttributes.isQuantityBasis,
    }).from(productGroupAttributes).where(eq(productGroupAttributes.productGroupId, groupId));
    return {
      csPga: pgas.find(p => p.attrId === ATTR_NOMINAL_CS)!.id,
      sfPga: pgas.find(p => p.attrId === ATTR_STRANDING_FACTOR)!.id,
    };
  }

  // 0.5mm² — 16 strands × 0.2mm wire
  console.log('\n── 0.5mm² 16-Strand Core variant ─────────────────────────────');
  const { csPga: cs16, sfPga: sf16 } = await getGroupPgas(g16.groupId);
  const core05Id = await upsertProduct('0.5mm² 16-Strand Copper Core', 'CORE-05SQ-16STR', g16.groupId);
  await setPav(core05Id, cs16, '0.5');
  await setPav(core05Id, sf16, '1.03');
  for (const slotId of g16.strandInputIds) await setVariantInput(core05Id, slotId, dcw02Id);
  console.log(`  All 16 strands → 0.2mm DCW`);
  console.log(`  Expected total CS: 16 × ${cs02} = ${(16 * parseFloat(cs02)).toFixed(4)} mm²`);

  // 0.75mm² — 24 strands × 0.2mm wire
  console.log('\n── 0.75mm² 24-Strand Core variant ────────────────────────────');
  const { csPga: cs24, sfPga: sf24 } = await getGroupPgas(g24.groupId);
  const core075Id = await upsertProduct('0.75mm² 24-Strand Copper Core', 'CORE-075SQ-24STR', g24.groupId);
  await setPav(core075Id, cs24, '0.75');
  await setPav(core075Id, sf24, '1.03');
  for (const slotId of g24.strandInputIds) await setVariantInput(core075Id, slotId, dcw02Id);
  console.log(`  All 24 strands → 0.2mm DCW`);
  console.log(`  Expected total CS: 24 × ${cs02} = ${(24 * parseFloat(cs02)).toFixed(4)} mm²`);

  // 1.0mm² — 32 strands × 0.2mm wire
  console.log('\n── 1.0mm² 32-Strand Core variant ─────────────────────────────');
  const { csPga: cs32, sfPga: sf32 } = await getGroupPgas(g32.groupId);
  const core10Id = await upsertProduct('1.0mm² 32-Strand Copper Core', 'CORE-10SQ-32STR', g32.groupId);
  await setPav(core10Id, cs32, '1.0');
  await setPav(core10Id, sf32, '1.03');
  for (const slotId of g32.strandInputIds) await setVariantInput(core10Id, slotId, dcw02Id);
  console.log(`  All 32 strands → 0.2mm DCW`);
  console.log(`  Expected total CS: 32 × ${cs02} = ${(32 * parseFloat(cs02)).toFixed(4)} mm²`);

  console.log('\n\n✅ Fine-wire variants created.');
  console.log('\nBOM calculation preview for 1000m of 0.5mm² 16-strand core:');
  console.log(`  Per strand: 1000m × 1.03 = 1030m of 0.2mm DCW`);
  console.log(`  × 16 strands = 16,480m total DCW`);
  console.log(`  For each 1030m of DCW (0.031416mm² cs):`);
  const weightPerStrand = 8960 * 0.031416 * 1030 / 1_000_000;
  console.log(`    weight = 8960 × 0.031416 × 1030 / 1,000,000 = ${weightPerStrand.toFixed(4)} kg`);
  const length = weightPerStrand * 1_000_000 / (8960 * 8);
  console.log(`    rod length = ${weightPerStrand.toFixed(4)} × 1,000,000 / (8960 × 8) = ${length.toFixed(2)} m`);
}

main().catch(console.error).finally(() => process.exit());
