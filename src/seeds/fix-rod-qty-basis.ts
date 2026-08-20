/**
 * Fix Copper Rod attributes:
 * - Keep Weight as qty_basis (stock tracked in kg — unchanged)
 * - Revert Length of Rod back to non-qty_basis
 * - Make Length a CALCULATED attribute: weight × 1_000_000 / (density × cross_section)
 *   → gives meters when weight = requiredQty (computed by BOM)
 * - Revert DCW BOM formula to weight-based: density × cross_section × length / 1_000_000
 *
 * The BOM backend will recompute input attrs using requiredQty so Length shows meters needed.
 *
 * PGA IDs (Copper Rod):
 *   Weight (qty_basis):        afde93f3-ead8-4b88-819a-f5c431f6b7c1
 *   Length of Rod (Copper):    563f4f79-830a-4ab7-9cdc-c56e1e7526df
 *   Density:                   8c59e7e7-9e1c-4e47-b6ad-a6cda3f14f69
 *   Cross Section:             1e61b7ce-87a0-42ee-8cf4-fd01f2891e0d
 *
 * PGA IDs (DCW):
 *   Density (isFromInput):     da53d9e0-7f83-4a64-988f-a0510601d165  (formula: rod density)
 *   Length of Wire (qty_basis):7d1fc4c2-ecfe-4f22-aaea-dc1e3b6cef3a
 *   Cross Section Area:        918cb107-b032-4989-be65-1b75d8dc75ec
 *
 * DCW BOM input:               1f455814-2bbc-415e-823e-4e061e4be31f
 */
import { eq } from 'drizzle-orm';
import { db } from '../db/connection';
import { productGroupAttributes, productGroupInputs } from '../db/schema';

// Copper Rod PGA IDs
const ROD_WEIGHT_PGA    = 'afde93f3-ead8-4b88-819a-f5c431f6b7c1';
const ROD_LENGTH_PGA    = '563f4f79-830a-4ab7-9cdc-c56e1e7526df';
const ROD_DENSITY_PGA   = '8c59e7e7-9e1c-4e47-b6ad-a6cda3f14f69';
const ROD_CROSS_SEC_PGA = '1e61b7ce-87a0-42ee-8cf4-fd01f2891e0d';

// DCW PGA IDs
const DCW_DENSITY_PGA   = 'da53d9e0-7f83-4a64-988f-a0510601d165';
const DCW_CROSS_SEC_PGA = '918cb107-b032-4989-be65-1b75d8dc75ec';
const DCW_LENGTH_PGA    = '7d1fc4c2-ecfe-4f22-aaea-dc1e3b6cef3a';

// DCW BOM input
const DCW_BOM_INPUT_ID  = '1f455814-2bbc-415e-823e-4e061e4be31f';

function pgaToken(id: string) { return `pga_${id.replace(/-/g, '_')}`; }

async function main() {
  // 1. Restore Weight as qty_basis
  await db.update(productGroupAttributes)
    .set({ isQuantityBasis: true, formulaAlias: 'weight' })
    .where(eq(productGroupAttributes.id, ROD_WEIGHT_PGA));
  console.log('✓ Weight restored as qty_basis for Copper Rod');

  // 2. Length of Rod → non-qty_basis, calculated from weight
  //    formula: weight * 1_000_000 / (density * cross_section)
  //    When BOM substitutes requiredQty as weight, this gives meters of rod needed.
  const lengthFormula = `${pgaToken(ROD_WEIGHT_PGA)} * 1000000 / (${pgaToken(ROD_DENSITY_PGA)} * ${pgaToken(ROD_CROSS_SEC_PGA)})`;
  await db.update(productGroupAttributes)
    .set({
      isQuantityBasis: false,
      isCalculated:    true,
      formula:         lengthFormula,
      formulaAlias:    'length',
    })
    .where(eq(productGroupAttributes.id, ROD_LENGTH_PGA));
  console.log('✓ Length of Rod is now calculated:', lengthFormula);

  // 3. Restore DCW BOM formula to weight-based:
  //    density_dcw × cross_section_dcw × length_dcw / 1_000_000  → kg of rod
  const dcwBomFormula = `${pgaToken(DCW_DENSITY_PGA)} * ${pgaToken(DCW_CROSS_SEC_PGA)} * ${pgaToken(DCW_LENGTH_PGA)} / 1000000`;
  const dcwFormulaVars = {
    [pgaToken(DCW_DENSITY_PGA)]: {
      pgaId: DCW_DENSITY_PGA, groupName: 'Drawn Copper Wire',
      attrName: 'Density Of Drawn Copper Wire', alias: 'density',
    },
    [pgaToken(DCW_CROSS_SEC_PGA)]: {
      pgaId: DCW_CROSS_SEC_PGA, groupName: 'Drawn Copper Wire',
      attrName: 'Cross Section Area', alias: 'cross_section',
    },
    [pgaToken(DCW_LENGTH_PGA)]: {
      pgaId: DCW_LENGTH_PGA, groupName: 'Drawn Copper Wire',
      attrName: 'Length of Wire', alias: 'length',
    },
  };

  await db.update(productGroupInputs)
    .set({
      qtyFormula:  dcwBomFormula,
      formulaVars: dcwFormulaVars,
      notes:       'Drawing process — 3% loss',
    })
    .where(eq(productGroupInputs.id, DCW_BOM_INPUT_ID));
  console.log('✓ DCW BOM formula restored to weight-based:', dcwBomFormula);

  console.log('\n✅ Done.');
  console.log('\nThe BOM backend will be updated to recompute input product attrs');
  console.log('using requiredQty as qty_basis, so "Length of Rod" shows meters needed.');
  console.log('\nExample for 99m of 10mm² DCW with 8mm² rod:');
  console.log('  Required weight = 8960 × 10 × 99 / 1_000_000 ÷ 0.97 = 9.14 kg');
  console.log('  Required length = 9.14 × 1_000_000 / (8960 × 8) = 127.6m of rod');
}

main().catch(console.error).finally(() => process.exit());
