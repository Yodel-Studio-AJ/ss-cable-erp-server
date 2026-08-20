/**
 * Seed: Create "Copper Core" product group (intermediate, metal)
 * with full attribute set and BOM input from Drawn Copper Wire.
 *
 * Stranding process: N wires of DCW twisted together to form one core.
 * BOM formula: num_strands * length_of_core * stranding_factor
 * (result = meters of DCW input wire needed)
 */
import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection';
import {
  productGroups, attributes, productGroupAttributes, productGroupInputs,
} from '../db/schema';

function pgaToken(id: string) { return `pga_${id.replace(/-/g, '_')}`; }

async function getOrCreateAttr(name: string, unit: string | null, dataType: 'number' | 'string' = 'number') {
  const cond = unit
    ? and(eq(attributes.name, name), eq(attributes.unit, unit))
    : eq(attributes.name, name);
  const [existing] = await db.select({ id: attributes.id }).from(attributes).where(cond).limit(1);
  if (existing) return existing.id;
  const [created] = await db.insert(attributes).values({ name, unit: unit ?? undefined, dataType }).returning({ id: attributes.id });
  return created.id;
}

async function main() {
  // ── Find / create Copper Core group ────────────────────────────────────────
  const [existing] = await db.select({ id: productGroups.id }).from(productGroups)
    .where(eq(productGroups.name, 'Copper Core')).limit(1);

  let coreGroupId: string;
  if (existing) {
    coreGroupId = existing.id;
    console.log('Copper Core group already exists:', coreGroupId);
  } else {
    const [created] = await db.insert(productGroups).values({
      name:         'Copper Core',
      type:         'intermediate',
      materialType: 'metal',
      isProcured:   false,
    }).returning({ id: productGroups.id });
    coreGroupId = created.id;
    console.log('Created Copper Core group:', coreGroupId);
  }

  // ── Find DCW group ──────────────────────────────────────────────────────────
  const [dcwGroup] = await db.select({ id: productGroups.id }).from(productGroups)
    .where(eq(productGroups.name, 'Drawn Copper Wire')).limit(1);
  if (!dcwGroup) throw new Error('Drawn Copper Wire group not found — run fix-dcw-bom first');
  console.log('DCW group:', dcwGroup.id);

  // ── Find DCW length PGA (qty_basis) ────────────────────────────────────────
  const dcwPgas = await db
    .select({ id: productGroupAttributes.id, isQuantityBasis: productGroupAttributes.isQuantityBasis })
    .from(productGroupAttributes)
    .where(eq(productGroupAttributes.productGroupId, dcwGroup.id));
  const dcwLengthPga = dcwPgas.find((p) => p.isQuantityBasis);
  if (!dcwLengthPga) throw new Error('DCW has no qty_basis attr');

  // ── Create / get attributes ─────────────────────────────────────────────────
  const attrIds = {
    length:           await getOrCreateAttr('Length', 'm'),
    numStrands:       await getOrCreateAttr('Number of Strands', 'wires'),
    nominalCrossSection: await getOrCreateAttr('Nominal Cross Section', 'mm²'),
    strandingFactor:  await getOrCreateAttr('Stranding Factor', null),
    totalCrossSection: await getOrCreateAttr('Total Cross Section', 'mm²'),
  };
  console.log('\nAttribute IDs:', attrIds);

  // ── Check existing PGAs ─────────────────────────────────────────────────────
  const existingPgas = await db
    .select({ id: productGroupAttributes.id, attributeId: productGroupAttributes.attributeId })
    .from(productGroupAttributes)
    .where(eq(productGroupAttributes.productGroupId, coreGroupId));

  const existingAttrIds = new Set(existingPgas.map((p) => p.attributeId));
  const pgaMap: Record<string, string> = {};
  for (const p of existingPgas) pgaMap[p.attributeId] = p.id;

  async function addPga(attrId: string, opts: {
    isQuantityBasis?: boolean; isCalculated?: boolean; isFromInput?: boolean;
    formula?: string; formulaAlias?: string; sortOrder: number;
  }) {
    if (existingAttrIds.has(attrId)) {
      console.log(`  PGA for attr ${attrId} already exists (${pgaMap[attrId]})`);
      return pgaMap[attrId];
    }
    const [pga] = await db.insert(productGroupAttributes).values({
      productGroupId:  coreGroupId,
      attributeId:     attrId,
      isQuantityBasis: opts.isQuantityBasis ?? false,
      isCalculated:    opts.isCalculated ?? false,
      isFromInput:     opts.isFromInput ?? false,
      formula:         opts.formula ?? null,
      formulaAlias:    opts.formulaAlias ?? null,
      sortOrder:       opts.sortOrder,
    }).returning({ id: productGroupAttributes.id });
    pgaMap[attrId] = pga.id;
    return pga.id;
  }

  // sortOrder 0: Length (qty_basis)
  const lengthPgaId = await addPga(attrIds.length, {
    isQuantityBasis: true, formulaAlias: 'length', sortOrder: 0,
  });
  console.log('\nLength PGA:', lengthPgaId);

  // sortOrder 1: Number of Strands
  const numStrandsPgaId = await addPga(attrIds.numStrands, {
    formulaAlias: 'num_strands', sortOrder: 1,
  });
  console.log('Num Strands PGA:', numStrandsPgaId);

  // sortOrder 2: Nominal Cross Section (declared, e.g. 6mm²)
  const nominalCsPgaId = await addPga(attrIds.nominalCrossSection, {
    formulaAlias: 'cross_section', sortOrder: 2,
  });
  console.log('Nominal Cross Section PGA:', nominalCsPgaId);

  // sortOrder 3: Stranding Factor (e.g. 1.03)
  const strandingFactorPgaId = await addPga(attrIds.strandingFactor, {
    formulaAlias: 'stranding_factor', sortOrder: 3,
  });
  console.log('Stranding Factor PGA:', strandingFactorPgaId);

  // sortOrder 4: Total Cross Section = num_strands × cross_section (calculated)
  const totalCsFormula = `${pgaToken(numStrandsPgaId)} * ${pgaToken(nominalCsPgaId)}`;
  const totalCsPgaId = await addPga(attrIds.totalCrossSection, {
    isCalculated: true,
    formula:      totalCsFormula,
    formulaAlias: 'total_cross_section',
    sortOrder:    4,
  });
  console.log('Total Cross Section PGA:', totalCsPgaId);

  // ── BOM input: Drawn Copper Wire ────────────────────────────────────────────
  // Formula: num_strands * length_of_core * stranding_factor
  // Result = meters of DCW wire needed
  const bomFormula = `${pgaToken(numStrandsPgaId)} * ${pgaToken(lengthPgaId)} * ${pgaToken(strandingFactorPgaId)}`;
  const bomFormulaVars = {
    [pgaToken(numStrandsPgaId)]:      { pgaId: numStrandsPgaId,      groupId: coreGroupId, groupName: 'Copper Core', attrName: 'Number of Strands',   alias: 'num_strands' },
    [pgaToken(lengthPgaId)]:           { pgaId: lengthPgaId,           groupId: coreGroupId, groupName: 'Copper Core', attrName: 'Length',               alias: 'length' },
    [pgaToken(strandingFactorPgaId)]:  { pgaId: strandingFactorPgaId,  groupId: coreGroupId, groupName: 'Copper Core', attrName: 'Stranding Factor',      alias: 'stranding_factor' },
  };

  const [existingBom] = await db
    .select({ id: productGroupInputs.id })
    .from(productGroupInputs)
    .where(and(
      eq(productGroupInputs.outputGroupId, coreGroupId),
      eq(productGroupInputs.inputGroupId,  dcwGroup.id),
    ))
    .limit(1);

  if (existingBom) {
    await db.update(productGroupInputs).set({
      qtyFormula:  bomFormula,
      formulaVars: bomFormulaVars,
      notes:       'Stranding process — twist factor adds ~3% extra length per strand',
    }).where(eq(productGroupInputs.id, existingBom.id));
    console.log('\nUpdated BOM input:', existingBom.id);
  } else {
    const [bomInput] = await db.insert(productGroupInputs).values({
      outputGroupId: coreGroupId,
      inputGroupId:  dcwGroup.id,
      qtyFormula:    bomFormula,
      formulaVars:   bomFormulaVars,
      yieldFactor:   '1.0',
      notes:         'Stranding process — twist factor adds ~3% extra length per strand',
      sortOrder:     0,
    }).returning({ id: productGroupInputs.id });
    console.log('\nCreated BOM input:', bomInput.id);
  }

  console.log('\nBOM formula:', bomFormula);
  console.log('\n✅ Copper Core group ready.');
  console.log('\nNext: create variants like "6 SQ MM 7-Strand Core" with:');
  console.log('  Number of Strands = 7');
  console.log('  Nominal Cross Section = 6  (mm²)');
  console.log('  Stranding Factor = 1.03');
  console.log('  Input variant: DCW variant of ~0.857mm² cross section');
  console.log('\nBOM calculation for 1000m of 6sqmm core:');
  console.log('  = 7 strands × 1000m × 1.03 factor = 7210m of DCW needed');
}

main().catch(console.error).finally(() => process.exit());
