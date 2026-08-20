/**
 * Seed: Create test Copper Core variants and DCW variants for BOM testing.
 *
 * Copper Core group: c25a8c7b-e4f0-4861-bba6-cbb50b0fbe11
 * DCW group:         57fcaa6d-c0ed-4d07-9759-455e707eb62b
 * BOM input (core→DCW): 88cc65d9-5f76-4934-873e-1da45cd71275
 *
 * Copper Core PGAs:
 *   Length (qty_basis):         25f5db3d-f107-4148-b129-7215efdf9b95
 *   Number of Strands:          9726dbc5-6a80-4211-b0a7-6a3a18c0c620
 *   Nominal Cross Section:      6d0aef27-bcdf-4b17-a2d7-419b494f7db4  (isFromInput)
 *   Stranding Factor:           1e7ea889-a8e1-4f6b-9a3e-52ff5d07c319
 *
 * DCW PGAs:
 *   Length of Wire (qty_basis): 7d1fc4c2-ecfe-4f22-aaea-dc1e3b6cef3a
 *   Cross Section Area:         918cb107-b032-4989-be65-1b75d8dc75ec
 *   Density (isFromInput):      da53d9e0-7f83-4a64-988f-a0510601d165
 *   Weight (calculated):        22ab1c42-1576-454d-9517-7f24ecc3de35
 *
 * Copper Rod PGAs:
 *   Weight (qty_basis):         afde93f3-ead8-4b88-819a-f5c431f6b7c1
 *   Length (calculated):        563f4f79-830a-4ab7-9cdc-c56e1e7526df
 *   Density:                    8c59e7e7-9e1c-4e47-b6ad-a6cda3f14f69
 *   Cross Section:              1e61b7ce-87a0-42ee-8cf4-fd01f2891e0d
 *
 * DCW BOM input (DCW→CopperRod): 1f455814-2bbc-415e-823e-4e061e4be31f
 */
import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection';
import {
  products, productGroups, productGroupAttributes, productAttributeValues,
  productGroupInputs, productVariantInputs, attributes,
} from '../db/schema';

// ── Group IDs ─────────────────────────────────────────────────────────────────
const CORE_GROUP_ID   = 'c25a8c7b-e4f0-4861-bba6-cbb50b0fbe11';
const DCW_GROUP_ID    = '57fcaa6d-c0ed-4d07-9759-455e707eb62b';

// ── Copper Core PGA IDs ───────────────────────────────────────────────────────
const CORE_LENGTH_PGA    = '25f5db3d-f107-4148-b129-7215efdf9b95';
const CORE_STRANDS_PGA   = '9726dbc5-6a80-4211-b0a7-6a3a18c0c620';
const CORE_NOMINAL_CS_PGA = '6d0aef27-bcdf-4b17-a2d7-419b494f7db4';
const CORE_SF_PGA        = '1e7ea889-a8e1-4f6b-9a3e-52ff5d07c319';

// ── DCW PGA IDs ───────────────────────────────────────────────────────────────
const DCW_LENGTH_PGA     = '7d1fc4c2-ecfe-4f22-aaea-dc1e3b6cef3a';
const DCW_CS_PGA         = '918cb107-b032-4989-be65-1b75d8dc75ec';
const DCW_DENSITY_PGA    = 'da53d9e0-7f83-4a64-988f-a0510601d165';

// ── BOM input IDs ─────────────────────────────────────────────────────────────
const CORE_BOM_INPUT_ID  = '88cc65d9-5f76-4934-873e-1da45cd71275';  // core → DCW
const DCW_BOM_INPUT_ID   = '1f455814-2bbc-415e-823e-4e061e4be31f';  // DCW → copper rod

async function upsertProduct(name: string, sku: string, groupId: string) {
  const [existing] = await db.select({ id: products.id })
    .from(products)
    .where(and(eq(products.productGroupId, groupId), eq(products.name, name)))
    .limit(1);
  if (existing) {
    console.log(`  exists: ${name} (${existing.id})`);
    return existing.id;
  }
  const [created] = await db.insert(products).values({ name, sku, productGroupId: groupId })
    .returning({ id: products.id });
  console.log(`  created: ${name} (${created.id})`);
  return created.id;
}

async function setPav(productId: string, pgaId: string, rawValue: string) {
  const numericValue = parseFloat(rawValue) as unknown as number;
  const [existing] = await db.select({ id: productAttributeValues.id })
    .from(productAttributeValues)
    .where(and(
      eq(productAttributeValues.productId, productId),
      eq(productAttributeValues.productGroupAttributeId, pgaId),
    ))
    .limit(1);

  if (existing) {
    await db.update(productAttributeValues)
      .set({ numericValue })
      .where(eq(productAttributeValues.id, existing.id));
  } else {
    await db.insert(productAttributeValues).values({
      productId,
      productGroupAttributeId: pgaId,
      numericValue,
    });
  }
}

async function setVariantInput(outputProductId: string, bomInputId: string, inputProductId: string) {
  const [existing] = await db.select({ id: productVariantInputs.id })
    .from(productVariantInputs)
    .where(and(
      eq(productVariantInputs.outputProductId, outputProductId),
      eq(productVariantInputs.productGroupInputId, bomInputId),
    ))
    .limit(1);
  if (existing) {
    await db.update(productVariantInputs)
      .set({ inputProductId })
      .where(eq(productVariantInputs.id, existing.id));
  } else {
    await db.insert(productVariantInputs).values({
      outputProductId,
      productGroupInputId: bomInputId,
      inputProductId,
    });
  }
}

async function main() {
  // ── DCW variants ─────────────────────────────────────────────────────────────
  // We need DCW variants that the core will use.
  // Cross section per strand:
  //  6mm²  7-strand core → each strand = 6/7 ≈ 0.857mm²
  //  10mm² 7-strand core → each strand = 10/7 ≈ 1.429mm²
  //  16mm² 7-strand core → each strand = 16/7 ≈ 2.286mm²

  console.log('\n── Creating DCW variants ───────────────────────────────────────');
  const dcw857Id  = await upsertProduct('0.857mm² Drawn Copper Wire', 'DCW-0857', DCW_GROUP_ID);
  const dcw1429Id = await upsertProduct('1.429mm² Drawn Copper Wire', 'DCW-1429', DCW_GROUP_ID);
  const dcw2286Id = await upsertProduct('2.286mm² Drawn Copper Wire', 'DCW-2286', DCW_GROUP_ID);

  // Cross Section Area for each
  await setPav(dcw857Id,  DCW_CS_PGA, '0.857');
  await setPav(dcw1429Id, DCW_CS_PGA, '1.429');
  await setPav(dcw2286Id, DCW_CS_PGA, '2.286');

  // Density (isFromInput — stored at create time from the rod input).
  // Using 8960 kg/m³ (copper) for all
  await setPav(dcw857Id,  DCW_DENSITY_PGA, '8960');
  await setPav(dcw1429Id, DCW_DENSITY_PGA, '8960');
  await setPav(dcw2286Id, DCW_DENSITY_PGA, '8960');

  console.log('  DCW 0.857mm²:', dcw857Id);
  console.log('  DCW 1.429mm²:', dcw1429Id);
  console.log('  DCW 2.286mm²:', dcw2286Id);

  // ── Copper Core variants ──────────────────────────────────────────────────────
  console.log('\n── Creating Copper Core variants ───────────────────────────────');

  // 6mm² 7-strand core
  const core6Id = await upsertProduct('6mm² 7-Strand Copper Core', 'CORE-6SQ-7STR', CORE_GROUP_ID);
  await setPav(core6Id, CORE_STRANDS_PGA, '7');
  await setPav(core6Id, CORE_SF_PGA,      '1.03');
  // Nominal CS is isFromInput (computed at BOM time from selected DCW variant)
  // but we also store it explicitly for display before BOM
  await setPav(core6Id, CORE_NOMINAL_CS_PGA, '6');
  // Variant input: use 0.857mm² DCW
  await setVariantInput(core6Id, CORE_BOM_INPUT_ID, dcw857Id);
  console.log('  Core 6mm² 7-strand:', core6Id, '→ DCW:', dcw857Id);

  // 10mm² 7-strand core
  const core10Id = await upsertProduct('10mm² 7-Strand Copper Core', 'CORE-10SQ-7STR', CORE_GROUP_ID);
  await setPav(core10Id, CORE_STRANDS_PGA, '7');
  await setPav(core10Id, CORE_SF_PGA,      '1.03');
  await setPav(core10Id, CORE_NOMINAL_CS_PGA, '10');
  await setVariantInput(core10Id, CORE_BOM_INPUT_ID, dcw1429Id);
  console.log('  Core 10mm² 7-strand:', core10Id, '→ DCW:', dcw1429Id);

  // 16mm² 7-strand core
  const core16Id = await upsertProduct('16mm² 7-Strand Copper Core', 'CORE-16SQ-7STR', CORE_GROUP_ID);
  await setPav(core16Id, CORE_STRANDS_PGA, '7');
  await setPav(core16Id, CORE_SF_PGA,      '1.03');
  await setPav(core16Id, CORE_NOMINAL_CS_PGA, '16');
  await setVariantInput(core16Id, CORE_BOM_INPUT_ID, dcw2286Id);
  console.log('  Core 16mm² 7-strand:', core16Id, '→ DCW:', dcw2286Id);

  console.log('\n✅ Copper Core variants ready for BOM testing.');
  console.log('\nBOM verification examples:');
  console.log('  6mm²  core, 1000m: needs 7 × 1000 × 1.03 = 7210m of 0.857mm² DCW');
  console.log('  10mm² core, 1000m: needs 7 × 1000 × 1.03 = 7210m of 1.429mm² DCW');
  console.log('  16mm² core, 1000m: needs 7 × 1000 × 1.03 = 7210m of 2.286mm² DCW');
  console.log('\n  Then DCW BOM: for 7210m of 0.857mm² DCW using 8mm² rod:');
  console.log('    weight = 8960 × 0.857 × 7210 / 1,000,000 = 55.38 kg');
  console.log('    ÷ 0.97 (yield) = 57.09 kg Copper Rod required');
  console.log('    Length attr = 57.09 × 1,000,000 / (8960 × 8) = 796m of rod');
}

main().catch(console.error).finally(() => process.exit());
