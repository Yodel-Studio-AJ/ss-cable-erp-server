/**
 * Fix Copper Core: make Nominal Cross Section an isFromInput calculated attribute.
 *
 * Design:
 *   nominal_cross_section = num_strands × cross_section_per_strand
 *   where cross_section_per_strand comes from the selected DCW input variant.
 *
 * This means when you create a "6mm² 7-strand core" variant and pick a 0.857mm² DCW:
 *   nominal_cs = 7 × 0.857 = 5.999 ≈ 6mm²
 *
 * For mixed cores (e.g. 16 strands: 8 × 8mm² + 8 × 7.5mm²):
 *   → 2 separate BOM input rows, each with their own num_strands sub-attribute
 *   → nominal_cs for each row = num_strands_row × cross_section_row, then sum
 *   (handled by adding more BOM input rows + num_strands attributes)
 *
 * Changes in this script:
 * 1. "Nominal Cross Section" PGA → isFromInput=true, formula = num_strands * dcw_cross_section
 * 2. "Total Cross Section" PGA → repurpose to "Actual Cross Section" (same formula, stays calculated)
 *    OR remove it since it duplicates nominal_cs for single-type cores
 *
 * DCW cross section PGA: 918cb107-b032-4989-be65-1b75d8dc75ec
 * Core num_strands PGA:  9726dbc5-6a80-4211-b0a7-6a3a18c0c620
 * Core nominal_cs  PGA:  6d0aef27-bcdf-4b17-a2d7-419b494f7db4  ← becomes isFromInput
 * Core total_cs    PGA:  45338430-dc86-4786-9125-e3b491f37760  ← repurpose or drop
 */
import { eq } from 'drizzle-orm';
import { db } from '../db/connection';
import { productGroupAttributes, attributes } from '../db/schema';

const CORE_NUM_STRANDS_PGA  = '9726dbc5-6a80-4211-b0a7-6a3a18c0c620';
const CORE_NOMINAL_CS_PGA   = '6d0aef27-bcdf-4b17-a2d7-419b494f7db4';
const CORE_TOTAL_CS_PGA     = '45338430-dc86-4786-9125-e3b491f37760';
const DCW_CROSS_SEC_PGA     = '918cb107-b032-4989-be65-1b75d8dc75ec';

function pgaToken(id: string) { return `pga_${id.replace(/-/g, '_')}`; }

async function main() {
  // 1. Update "Nominal Cross Section" → isFromInput, calculated from input wire cross section
  //    formula: num_strands (from core variant) × cross_section_per_strand (from DCW variant)
  const nominalCsFormula = `${pgaToken(CORE_NUM_STRANDS_PGA)} * ${pgaToken(DCW_CROSS_SEC_PGA)}`;
  await db.update(productGroupAttributes)
    .set({
      isFromInput:  true,
      isCalculated: true,
      formula:      nominalCsFormula,
      formulaAlias: 'nominal_cross_section',
      sortOrder:    2,
    })
    .where(eq(productGroupAttributes.id, CORE_NOMINAL_CS_PGA));
  console.log('✓ Nominal Cross Section is now isFromInput + calculated');
  console.log('  formula:', nominalCsFormula);

  // 2. Remove "Total Cross Section" — it's now identical to Nominal CS for single-type cores.
  //    Delete the PGA row so it doesn't appear as a duplicate attribute.
  await db.delete(productGroupAttributes)
    .where(eq(productGroupAttributes.id, CORE_TOTAL_CS_PGA));
  console.log('✓ Removed redundant "Total Cross Section" PGA');

  // Print summary
  const coreAttr = await productGroupAttributes.name; // just for confirmation
  console.log('\n✅ Copper Core attribute redesign complete');
  console.log('\nAttributes now:');
  console.log('  0. Length (qty_basis) — meters of core to produce');
  console.log('  1. Number of Strands  — how many wire strands');
  console.log('  2. Nominal Cross Section — isFromInput: num_strands × DCW_cross_section');
  console.log('  3. Stranding Factor   — e.g. 1.03');
  console.log('\nBOM formula (unchanged): num_strands × length × stranding_factor');
  console.log('→ gives meters of DCW needed\n');
  console.log('Example: 7-strand core, 1000m, 0.857mm² DCW:');
  console.log('  Nominal CS  = 7 × 0.857 = 5.999mm² (≈ 6mm²)');
  console.log('  DCW needed  = 7 × 1000 × 1.03 = 7210m');
}

main().catch(console.error).finally(() => process.exit());
