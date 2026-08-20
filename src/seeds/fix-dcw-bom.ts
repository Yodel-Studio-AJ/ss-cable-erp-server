/**
 * Fix script for DCW BOM calculator issues:
 * 1. Add "Length" qty_basis attribute to Drawn Copper Wire group
 * 2. Rebuild BOM formula using the correct PGA tokens:
 *    density_rod × cross_section_dcw × length_dcw / 1_000_000
 * 3. Set the isFromInput formula on "Density Of Drawn Copper Wire" attr
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection';
import {
  productGroups,
  attributes,
  productGroupAttributes,
  productGroupInputs,
} from '../db/schema';

function pgaToken(pgaId: string) {
  return `pga_${pgaId.replace(/-/g, '_')}`;
}

async function main() {
  // ── 1. Find DCW group ──────────────────────────────────────────────────────
  const [dcwGroup] = await db
    .select({ id: productGroups.id, name: productGroups.name })
    .from(productGroups)
    .where(eq(productGroups.name, 'Drawn Copper Wire'))
    .limit(1);

  if (!dcwGroup) throw new Error('Drawn Copper Wire group not found');
  console.log('DCW group:', dcwGroup.id);

  // ── 2. Find Copper Rods group ──────────────────────────────────────────────
  const [rodGroup] = await db
    .select({ id: productGroups.id })
    .from(productGroups)
    .where(eq(productGroups.name, 'Copper Rods'))
    .limit(1);

  if (!rodGroup) throw new Error('Copper Rods group not found');
  console.log('Copper Rods group:', rodGroup.id);

  // ── 3. Find key PGAs on DCW ────────────────────────────────────────────────
  const dcwPgas = await db
    .select({ id: productGroupAttributes.id, attrName: attributes.name, isQuantityBasis: productGroupAttributes.isQuantityBasis })
    .from(productGroupAttributes)
    .innerJoin(attributes, eq(attributes.id, productGroupAttributes.attributeId))
    .where(eq(productGroupAttributes.productGroupId, dcwGroup.id));

  console.log('\nDCW PGAs:', dcwPgas.map(p => `${p.attrName} (${p.id}) qty_basis=${p.isQuantityBasis}`));

  const crossSectionPga = dcwPgas.find(p => p.attrName === 'Cross Section Area');
  const densityFromInputPga = dcwPgas.find(p => p.attrName === 'Density Of Drawn Copper WIre' || p.attrName === 'Density Of Drawn Copper Wire');
  const existingQtyBasis = dcwPgas.find(p => p.isQuantityBasis);

  if (!crossSectionPga) throw new Error('Cross Section Area PGA not found on DCW');

  // ── 4. Find density PGA on Copper Rods ────────────────────────────────────
  const rodPgas = await db
    .select({ id: productGroupAttributes.id, attrName: attributes.name })
    .from(productGroupAttributes)
    .innerJoin(attributes, eq(attributes.id, productGroupAttributes.attributeId))
    .where(eq(productGroupAttributes.productGroupId, rodGroup.id));

  console.log('\nRod PGAs:', rodPgas.map(p => `${p.attrName} (${p.id})`));

  const rodDensityPga = rodPgas.find(p => p.attrName.toLowerCase().includes('density'));
  if (!rodDensityPga) throw new Error('Density PGA not found on Copper Rods');

  // ── 5. Add "Length" qty_basis to DCW (skip if already exists) ─────────────
  let lengthPgaId: string;

  if (existingQtyBasis) {
    console.log(`\nQty basis already exists on DCW: ${existingQtyBasis.attrName} (${existingQtyBasis.id}) — using it`);
    lengthPgaId = existingQtyBasis.id;
  } else {
    // Create or find a "Length" attribute
    let [lengthAttr] = await db
      .select({ id: attributes.id })
      .from(attributes)
      .where(and(eq(attributes.name, 'Length'), eq(attributes.unit, 'm')))
      .limit(1);

    if (!lengthAttr) {
      [lengthAttr] = await db
        .insert(attributes)
        .values({ name: 'Length', unit: 'm', dataType: 'number' })
        .returning({ id: attributes.id });
      console.log('\nCreated Length attribute:', lengthAttr.id);
    } else {
      console.log('\nFound existing Length attribute:', lengthAttr.id);
    }

    // Add to DCW group as qty_basis at sortOrder 0
    // First bump existing attrs' sortOrders
    for (const pga of dcwPgas) {
      await db
        .update(productGroupAttributes)
        .set({ sortOrder: (pga as any).sortOrder + 1 })
        .where(eq(productGroupAttributes.id, pga.id));
    }

    const [newPga] = await db
      .insert(productGroupAttributes)
      .values({
        productGroupId:  dcwGroup.id,
        attributeId:     lengthAttr.id,
        isQuantityBasis: true,
        isCalculated:    false,
        isFromInput:     false,
        formulaAlias:    'length',
        sortOrder:       0,
      })
      .returning({ id: productGroupAttributes.id });

    lengthPgaId = newPga.id;
    console.log('\nAdded Length qty_basis PGA to DCW:', lengthPgaId);
  }

  // ── 6. If Density is isFromInput, set its formula to reference rod density ─
  if (densityFromInputPga) {
    const fromInputFormula = pgaToken(rodDensityPga.id);
    await db
      .update(productGroupAttributes)
      .set({ formula: fromInputFormula })
      .where(eq(productGroupAttributes.id, densityFromInputPga.id));
    console.log(`\nSet isFromInput formula on "${densityFromInputPga.attrName}": ${fromInputFormula}`);
  }

  // ── 7. Rebuild BOM formula ─────────────────────────────────────────────────
  // Formula: density_rod × cross_section_dcw × length_dcw / 1000000
  // Result: kg of copper rod needed
  const newFormula = `${pgaToken(rodDensityPga.id)} * ${pgaToken(crossSectionPga.id)} * ${pgaToken(lengthPgaId)} / 1000000`;
  const newFormulaVars = {
    [pgaToken(rodDensityPga.id)]:   { pgaId: rodDensityPga.id,  groupId: rodGroup.id,  groupName: 'Copper Rods',       attrName: 'Density of Rod (Copper)', alias: 'density' },
    [pgaToken(crossSectionPga.id)]: { pgaId: crossSectionPga.id, groupId: dcwGroup.id,  groupName: 'Drawn Copper Wire', attrName: 'Cross Section Area',       alias: 'cross_section' },
    [pgaToken(lengthPgaId)]:        { pgaId: lengthPgaId,        groupId: dcwGroup.id,  groupName: 'Drawn Copper Wire', attrName: 'Length',                    alias: 'length' },
  };

  const bomInputRows = await db
    .select({ id: productGroupInputs.id })
    .from(productGroupInputs)
    .where(eq(productGroupInputs.outputGroupId, dcwGroup.id));

  if (bomInputRows.length === 0) {
    console.log('\nNo BOM input rows found for DCW group — formula not updated');
  } else {
    for (const row of bomInputRows) {
      await db
        .update(productGroupInputs)
        .set({ qtyFormula: newFormula, formulaVars: newFormulaVars })
        .where(eq(productGroupInputs.id, row.id));
    }
    console.log('\nUpdated BOM formula:', newFormula);
    console.log('Formula vars:', JSON.stringify(newFormulaVars, null, 2));
  }

  console.log('\n✅ Done. Summary:');
  console.log(`  Length qty_basis PGA: ${lengthPgaId}`);
  console.log(`  Token in formula:     ${pgaToken(lengthPgaId)}`);
  console.log(`  Full formula:         ${newFormula}`);
  console.log('\nNow go to the DCW variant and set the Length value (meters) if desired.');
}

main().catch(console.error).finally(() => process.exit());
