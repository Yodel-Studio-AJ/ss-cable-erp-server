/**
 * Seed: Create N-strand Copper Core product groups.
 *
 * Design: instead of a single "num_strands" attribute with one BOM input,
 * each strand count is its own product group with N individual BOM input rows.
 *
 * Groups created:
 *   - "1-Strand Copper Core" → 1 BOM input (solid wire)
 *   - "2-Strand Copper Core" → 2 BOM inputs
 *   - "3-Strand Copper Core" → 3 BOM inputs
 *   - "7-Strand Copper Core" → 7 BOM inputs (most common, e.g. 6mm²–50mm²)
 *   - "19-Strand Copper Core" → 19 BOM inputs (e.g. 50mm²–150mm²)
 *
 * Each BOM input formula: length * stranding_factor
 *   (result = meters of that strand's DCW needed)
 *
 * Attributes per group (same for all):
 *   - Length (qty_basis, m)
 *   - Nominal Cross Section (declared IEC value, e.g. 6mm²)
 *   - Stranding Factor (e.g. 1.03)
 *
 * Note: "Number of Strands" is now implicit in the group name/BOM input count,
 * not a separate attribute.
 */
import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection';
import { productGroups, attributes, productGroupAttributes, productGroupInputs } from '../db/schema';

// DCW group ID (confirmed)
const DCW_GROUP_ID = '57fcaa6d-c0ed-4d07-9759-455e707eb62b';

function pgaToken(id: string) { return `pga_${id.replace(/-/g, '_')}`; }

async function getOrCreateAttr(name: string, unit: string | null) {
  const [ex] = await db.select({ id: attributes.id }).from(attributes)
    .where(unit ? and(eq(attributes.name, name), eq(attributes.unit, unit)) : eq(attributes.name, name))
    .limit(1);
  if (ex) return ex.id;
  const [cr] = await db.insert(attributes).values({ name, unit: unit ?? undefined, dataType: 'number' })
    .returning({ id: attributes.id });
  return cr.id;
}

async function getOrCreateGroup(name: string) {
  const [ex] = await db.select({ id: productGroups.id }).from(productGroups)
    .where(eq(productGroups.name, name)).limit(1);
  if (ex) { console.log(`  exists: ${name} (${ex.id})`); return ex.id; }
  const [cr] = await db.insert(productGroups).values({
    name, type: 'intermediate', materialType: 'metal', isProcured: false,
  }).returning({ id: productGroups.id });
  console.log(`  created: ${name} (${cr.id})`);
  return cr.id;
}

async function addPga(groupId: string, attrId: string, opts: {
  isQuantityBasis?: boolean;
  formulaAlias?: string;
  sortOrder: number;
}): Promise<string> {
  const [ex] = await db.select({ id: productGroupAttributes.id }).from(productGroupAttributes)
    .where(and(
      eq(productGroupAttributes.productGroupId, groupId),
      eq(productGroupAttributes.attributeId, attrId),
    )).limit(1);
  if (ex) return ex.id;
  const [cr] = await db.insert(productGroupAttributes).values({
    productGroupId:  groupId,
    attributeId:     attrId,
    isQuantityBasis: opts.isQuantityBasis ?? false,
    isCalculated:    false,
    isFromInput:     false,
    formula:         null,
    formulaAlias:    opts.formulaAlias ?? null,
    sortOrder:       opts.sortOrder,
  }).returning({ id: productGroupAttributes.id });
  return cr.id;
}

async function addBomInput(groupId: string, strandNum: number, lengthPgaId: string, sfPgaId: string) {
  const label    = `Strand ${strandNum}`;
  const formula  = `${pgaToken(lengthPgaId)} * ${pgaToken(sfPgaId)}`;
  const formulaVars = {
    [pgaToken(lengthPgaId)]: { pgaId: lengthPgaId, attrName: 'Length', alias: 'length' },
    [pgaToken(sfPgaId)]:     { pgaId: sfPgaId,     attrName: 'Stranding Factor', alias: 'stranding_factor' },
  };

  // Check if already exists for this group + label
  const existing = await db.select({ id: productGroupInputs.id })
    .from(productGroupInputs)
    .where(and(
      eq(productGroupInputs.outputGroupId, groupId),
      eq(productGroupInputs.inputGroupId,  DCW_GROUP_ID),
      eq(productGroupInputs.sortOrder,     strandNum - 1),
    ))
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  const [cr] = await db.insert(productGroupInputs).values({
    outputGroupId: groupId,
    inputGroupId:  DCW_GROUP_ID,
    qtyFormula:    formula,
    formulaVars,
    yieldFactor:   '1.0',
    label,
    notes:         `Strand ${strandNum} — ${formula}`,
    sortOrder:     strandNum - 1,
  }).returning({ id: productGroupInputs.id });
  return cr.id;
}

async function setupGroup(name: string, strandCount: number, attrIds: Record<string, string>) {
  console.log(`\n── ${name} (${strandCount} strands) ──────────────────────`);
  const groupId   = await getOrCreateGroup(name);
  const lengthPga = await addPga(groupId, attrIds.length,           { isQuantityBasis: true,  formulaAlias: 'length',             sortOrder: 0 });
  const csPga     = await addPga(groupId, attrIds.crossSection,     { formulaAlias: 'nominal_cross_section', sortOrder: 1 });
  const sfPga     = await addPga(groupId, attrIds.strandingFactor,  { formulaAlias: 'stranding_factor',      sortOrder: 2 });

  console.log(`  Length PGA: ${lengthPga}`);
  console.log(`  Nominal CS PGA: ${csPga}`);
  console.log(`  Stranding Factor PGA: ${sfPga}`);

  // Create N BOM input rows (one per strand)
  const inputIds: string[] = [];
  for (let i = 1; i <= strandCount; i++) {
    const id = await addBomInput(groupId, i, lengthPga, sfPga);
    inputIds.push(id);
  }
  console.log(`  BOM inputs created: ${inputIds.length}`);
  console.log(`  Formula per strand: length * stranding_factor`);

  return { groupId, lengthPga, csPga, sfPga, inputIds };
}

async function main() {
  // Shared attributes across all core groups
  const attrIds = {
    length:          await getOrCreateAttr('Length', 'm'),
    crossSection:    await getOrCreateAttr('Nominal Cross Section', 'mm²'),
    strandingFactor: await getOrCreateAttr('Stranding Factor', null),
  };
  console.log('\nShared attribute IDs:', attrIds);

  const groups: Record<string, Awaited<ReturnType<typeof setupGroup>>> = {};

  // Common strand counts in cable manufacturing
  groups['1']  = await setupGroup('1-Strand Copper Core',  1,  attrIds);
  groups['2']  = await setupGroup('2-Strand Copper Core',  2,  attrIds);
  groups['3']  = await setupGroup('3-Strand Copper Core',  3,  attrIds);
  groups['7']  = await setupGroup('7-Strand Copper Core',  7,  attrIds);
  groups['19'] = await setupGroup('19-Strand Copper Core', 19, attrIds);

  console.log('\n\n✅ All N-strand Copper Core groups ready.');
  console.log('\nTo create a 4mm² 7-strand core variant:');
  console.log('  Group: "7-Strand Copper Core"');
  console.log('  Attributes: Nominal Cross Section = 4mm², Stranding Factor = 1.03');
  console.log('  Variant inputs: assign a 0.571mm² DCW variant to each of the 7 Strand slots');
  console.log('  BOM result: 7 × (length × 1.03) meters of that DCW variant');
  console.log('\nFor mixed strands (e.g. 4mm² 3-wire: 1mm² + 1mm² + 2mm²):');
  console.log('  Group: "3-Strand Copper Core"');
  console.log('  Strand 1 → 1mm² DCW, Strand 2 → 1mm² DCW, Strand 3 → 2mm² DCW');
  console.log('\nBOM input IDs for 7-Strand group:');
  groups['7'].inputIds.forEach((id, i) => console.log(`  Strand ${i + 1}: ${id}`));
}

main().catch(console.error).finally(() => process.exit());
