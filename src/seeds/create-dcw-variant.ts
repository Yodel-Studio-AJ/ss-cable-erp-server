/**
 * Seed: create a "Drawn Copper Wire 10 SQ MM" product variant.
 * Run with: npx tsx src/seeds/create-dcw-variant.ts
 */
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/connection';
import {
  productGroups, productGroupAttributes, attributes, products, productAttributeValues,
} from '../db/schema';

async function main() {
  // Find "Drawn Copper Wire" group
  const allGroups = await db.select({ id: productGroups.id, name: productGroups.name })
    .from(productGroups);

  const dcwGroup = allGroups.find((g) =>
    g.name.toLowerCase().includes('drawn') && g.name.toLowerCase().includes('copper')
  );

  if (!dcwGroup) {
    console.error('❌ Could not find a "Drawn Copper Wire" product group.');
    console.log('Available groups:', allGroups.map((g) => g.name).join(', '));
    process.exit(1);
  }

  console.log(`✓ Found group: "${dcwGroup.name}" (${dcwGroup.id})`);

  // Get attributes for this group
  const pgaRows = await db
    .select({
      pgaId:           productGroupAttributes.id,
      isQuantityBasis: productGroupAttributes.isQuantityBasis,
      isCalculated:    productGroupAttributes.isCalculated,
      attrName:        attributes.name,
      sortOrder:       productGroupAttributes.sortOrder,
    })
    .from(productGroupAttributes)
    .innerJoin(attributes, eq(productGroupAttributes.attributeId, attributes.id))
    .where(eq(productGroupAttributes.productGroupId, dcwGroup.id))
    .orderBy(asc(productGroupAttributes.sortOrder));

  console.log('Group attributes:');
  pgaRows.forEach((r) => {
    const kind = r.isQuantityBasis ? 'Qty Basis' : r.isCalculated ? 'Calculated' : 'Simple';
    console.log(`  [${kind}] ${r.attrName} (pgaId: ${r.pgaId})`);
  });

  // Only "Simple" (non-calculated, non-qty-basis) attributes need stored values
  const simpleAttrs = pgaRows.filter((r) => !r.isQuantityBasis && !r.isCalculated);

  if (simpleAttrs.length === 0) {
    console.log('No simple attributes found — variant will have no stored attribute values.');
  }

  // Check if Cross Section Area exists as a simple attr
  const crossSection = simpleAttrs.find((a) =>
    a.attrName.toLowerCase().includes('cross') || a.attrName.toLowerCase().includes('section')
  );

  if (!crossSection) {
    console.error('❌ Could not find "Cross Section Area" simple attribute in this group.');
    console.log('Simple attrs:', simpleAttrs.map((a) => a.attrName));
    process.exit(1);
  }

  console.log(`✓ Cross Section attribute: "${crossSection.attrName}" (${crossSection.pgaId})`);

  // Check if variant already exists
  const existing = await db.select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.productGroupId, dcwGroup.id));

  const alreadyExists = existing.find((p) => p.name.toLowerCase().includes('10'));
  if (alreadyExists) {
    console.log(`⚠ Variant already exists: "${alreadyExists.name}" (${alreadyExists.id})`);
    console.log('Existing variants:', existing.map((p) => p.name).join(', '));
    process.exit(0);
  }

  // Create the variant
  const [created] = await db.insert(products).values({
    productGroupId: dcwGroup.id,
    name:           'DCW 10 SQ MM',
    sku:            'DCW-10',
    description:    'Drawn Copper Wire, 10 mm² cross-section',
    isActive:       true,
  }).returning();

  console.log(`✓ Created product: "${created.name}" (${created.id})`);

  // Insert Cross Section Area = 10
  await db.insert(productAttributeValues).values({
    productId:               created.id,
    productGroupAttributeId: crossSection.pgaId,
    numericValue:            10,
    textValue:               null,
  });

  console.log(`✓ Inserted attribute value: ${crossSection.attrName} = 10 mm²`);
  console.log('\n✅ Done!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
