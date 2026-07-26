/**
 * Seed: add density value to DCW 10 SQ MM variant.
 * Copper density ≈ 8940 kg/m³
 * Run with: npx tsx --env-file=.env src/seeds/add-dcw-density.ts
 */
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/connection';
import { productGroups, productGroupAttributes, attributes, products, productAttributeValues } from '../db/schema';

async function main() {
  const allGroups = await db.select({ id: productGroups.id, name: productGroups.name }).from(productGroups);
  const dcwGroup = allGroups.find((g) => g.name.toLowerCase().includes('drawn') && g.name.toLowerCase().includes('copper'));
  if (!dcwGroup) { console.error('DCW group not found'); process.exit(1); }

  // Find DCW 10 SQ MM product
  const allProds = await db.select({ id: products.id, name: products.name })
    .from(products).where(eq(products.productGroupId, dcwGroup.id));
  const dcw10 = allProds.find((p) => p.name.toLowerCase().includes('10'));
  if (!dcw10) { console.error('DCW 10 product not found'); process.exit(1); }
  console.log(`Found product: "${dcw10.name}" (${dcw10.id})`);

  // Find Density PGA
  const pgaRows = await db
    .select({ pgaId: productGroupAttributes.id, attrName: attributes.name })
    .from(productGroupAttributes)
    .innerJoin(attributes, eq(productGroupAttributes.attributeId, attributes.id))
    .where(eq(productGroupAttributes.productGroupId, dcwGroup.id));

  const densityPga = pgaRows.find((r) => r.attrName.toLowerCase().includes('density'));
  if (!densityPga) { console.error('Density PGA not found'); process.exit(1); }
  console.log(`Density PGA: "${densityPga.attrName}" (${densityPga.pgaId})`);

  // Check if already exists
  const existing = await db.select().from(productAttributeValues)
    .where(eq(productAttributeValues.productId, dcw10.id));
  const hasD = existing.find((av) => av.productGroupAttributeId === densityPga.pgaId);
  if (hasD) {
    console.log(`Density already set: ${hasD.numericValue}`);
    process.exit(0);
  }

  await db.insert(productAttributeValues).values({
    productId: dcw10.id,
    productGroupAttributeId: densityPga.pgaId,
    numericValue: 8940,
    textValue: null,
  });
  console.log('✓ Added density = 8940 kg/m³');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
