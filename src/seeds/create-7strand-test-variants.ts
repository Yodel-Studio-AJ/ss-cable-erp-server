/**
 * Create test variants for 7-Strand Copper Core group.
 *
 * 6mm² 7-strand core: each strand = 6/7 ≈ 0.857mm² DCW
 * → uses the 0.857mm² DCW variant for all 7 strands
 *
 * 7-Strand group: b126fa8a-0829-4e46-a7f5-912ac93c1e71
 * BOM input IDs:
 *   Strand 1: 1f5055d9-901f-4a41-9044-ddd4ae2413e0
 *   Strand 2: 5626ad65-7302-42a6-a322-013a9bfc5860
 *   Strand 3: 24fea0db-3633-4477-b4c1-e4ad3d2d4fd9
 *   Strand 4: 4ec1cb1e-5bab-434f-b46e-d69d304aed59
 *   Strand 5: f4231da2-f290-428a-b681-19f50fa7c26a
 *   Strand 6: 51725ca7-0e00-4507-b3a9-ea318690a4f1
 *   Strand 7: 1750a30b-d7ae-4cfd-a781-084960d4e79a
 *
 * DCW variant: 0.857mm² Drawn Copper Wire (6187ee2e-b6e1-4fa0-9388-87485b6499d7)
 * DCW group:   57fcaa6d-c0ed-4d07-9759-455e707eb62b
 */
import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection';
import { products, productAttributeValues, productVariantInputs } from '../db/schema';

const SEVEN_STRAND_GROUP_ID = 'b126fa8a-0829-4e46-a7f5-912ac93c1e71';

// PGA IDs for 7-Strand group
const LENGTH_PGA = '67d8fab2-9de7-4479-9e8b-e7db41030a39';
const CS_PGA     = '9db9e004-ecc4-413e-af37-a49596077989';
const SF_PGA     = '7c9eb0f7-84b0-49b5-b2ad-a25d4184c457';

// BOM input slot IDs
const STRAND_INPUT_IDS = [
  '1f5055d9-901f-4a41-9044-ddd4ae2413e0',
  '5626ad65-7302-42a6-a322-013a9bfc5860',
  '24fea0db-3633-4477-b4c1-e4ad3d2d4fd9',
  '4ec1cb1e-5bab-434f-b46e-d69d304aed59',
  'f4231da2-f290-428a-b681-19f50fa7c26a',
  '51725ca7-0e00-4507-b3a9-ea318690a4f1',
  '1750a30b-d7ae-4cfd-a781-084960d4e79a',
];

// DCW variants (from earlier seed)
const DCW_0857_ID = '6187ee2e-b6e1-4fa0-9388-87485b6499d7';
const DCW_1429_ID = 'f9f29744-c9ad-4c12-acb7-222e899a98d1';
const DCW_2286_ID = '1257cab6-472d-4f8e-9a61-ce7c2dff3ce0';

async function upsertProduct(name: string, sku: string) {
  const [ex] = await db.select({ id: products.id }).from(products)
    .where(and(eq(products.productGroupId, SEVEN_STRAND_GROUP_ID), eq(products.name, name)))
    .limit(1);
  if (ex) { console.log(`  exists: ${name} (${ex.id})`); return ex.id; }
  const [cr] = await db.insert(products).values({ name, sku, productGroupId: SEVEN_STRAND_GROUP_ID })
    .returning({ id: products.id });
  console.log(`  created: ${name} (${cr.id})`);
  return cr.id;
}

async function setPav(productId: string, pgaId: string, value: string) {
  const num = parseFloat(value) as unknown as number;
  const [ex] = await db.select({ id: productAttributeValues.id }).from(productAttributeValues)
    .where(and(
      eq(productAttributeValues.productId, productId),
      eq(productAttributeValues.productGroupAttributeId, pgaId),
    )).limit(1);
  if (ex) {
    await db.update(productAttributeValues).set({ numericValue: num }).where(eq(productAttributeValues.id, ex.id));
  } else {
    await db.insert(productAttributeValues).values({ productId, productGroupAttributeId: pgaId, numericValue: num });
  }
}

async function setVariantInput(outputProductId: string, bomInputId: string, inputProductId: string) {
  const [ex] = await db.select({ id: productVariantInputs.id }).from(productVariantInputs)
    .where(and(
      eq(productVariantInputs.outputProductId, outputProductId),
      eq(productVariantInputs.productGroupInputId, bomInputId),
    )).limit(1);
  if (ex) {
    await db.update(productVariantInputs).set({ inputProductId }).where(eq(productVariantInputs.id, ex.id));
  } else {
    await db.insert(productVariantInputs).values({ outputProductId, productGroupInputId: bomInputId, inputProductId });
  }
}

async function main() {
  // ── 6mm² 7-strand (all same, 0.857mm² each) ────────────────────────────────
  console.log('\n── 6mm² 7-Strand Copper Core ─────────────────────────────────');
  const core6Id = await upsertProduct('6mm² 7-Strand Copper Core', 'CORE-6SQ-7STR-V2');
  await setPav(core6Id, CS_PGA, '6');
  await setPav(core6Id, SF_PGA, '1.03');
  for (const slotId of STRAND_INPUT_IDS) {
    await setVariantInput(core6Id, slotId, DCW_0857_ID);
  }
  console.log('  All 7 strands → 0.857mm² DCW');

  // ── 10mm² 7-strand (all same, 1.429mm² each) ───────────────────────────────
  console.log('\n── 10mm² 7-Strand Copper Core ────────────────────────────────');
  const core10Id = await upsertProduct('10mm² 7-Strand Copper Core', 'CORE-10SQ-7STR-V2');
  await setPav(core10Id, CS_PGA, '10');
  await setPav(core10Id, SF_PGA, '1.03');
  for (const slotId of STRAND_INPUT_IDS) {
    await setVariantInput(core10Id, slotId, DCW_1429_ID);
  }
  console.log('  All 7 strands → 1.429mm² DCW');

  // ── Mixed 7-strand example: custom 4mm² using 2 × 2mm² + 5 × 0.857mm² ──────
  // This shows the power of per-strand BOM inputs
  console.log('\n── Mixed 4mm² 7-Strand Copper Core (example) ─────────────────');
  const coreMixId = await upsertProduct('4mm² Mixed 7-Strand Copper Core', 'CORE-4SQ-7STR-MIX');
  await setPav(coreMixId, CS_PGA, '4');
  await setPav(coreMixId, SF_PGA, '1.03');
  // Strands 1-2: 2.286mm² DCW; Strands 3-7: 0.857mm² DCW (mixed composition)
  await setVariantInput(coreMixId, STRAND_INPUT_IDS[0], DCW_2286_ID);
  await setVariantInput(coreMixId, STRAND_INPUT_IDS[1], DCW_2286_ID);
  for (let i = 2; i < 7; i++) {
    await setVariantInput(coreMixId, STRAND_INPUT_IDS[i], DCW_0857_ID);
  }
  console.log('  Strands 1-2 → 2.286mm² DCW; Strands 3-7 → 0.857mm² DCW');

  console.log('\n✅ 7-Strand Copper Core test variants created.');
  console.log('\nBOM verification for 6mm² 7-strand, 1000m:');
  console.log('  7 × (1000m × 1.03) = 7 × 1030 = 7210m of 0.857mm² DCW per strand');
  console.log('  Each strand shows: Required 1030m of 0.857mm² DCW');
  console.log('  Then each DCW shows its copper rod requirement.');
}

main().catch(console.error).finally(() => process.exit());
