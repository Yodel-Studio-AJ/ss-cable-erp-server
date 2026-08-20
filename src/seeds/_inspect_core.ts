import { db } from '../db/connection';
import { products, productGroups, productGroupAttributes, productAttributeValues, attributes } from '../db/schema';
import { eq } from 'drizzle-orm';

const CORE_ID = '04389c2e-6a19-409b-b16e-31ad728a25a2'; // 0.5mm² core (for Red 0.5 wire)

async function main() {
  const [p] = await db.select({ id: products.id, name: products.name, productGroupId: products.productGroupId })
    .from(products).where(eq(products.id, CORE_ID)).limit(1);
  if (!p) { console.log('Core product NOT FOUND'); return; }
  console.log('Core product:', p.id, p.name, '| group:', p.productGroupId);

  // Get all PGAs for the group
  const pgas = await db.select({
    pgaId: productGroupAttributes.id,
    name: attributes.name,
    isQtyBasis: productGroupAttributes.isQuantityBasis,
    isFromInput: productGroupAttributes.isFromInput,
    isCalculated: productGroupAttributes.isCalculated,
    formula: productGroupAttributes.formula,
    alias: productGroupAttributes.formulaAlias,
  }).from(productGroupAttributes)
    .innerJoin(attributes, eq(attributes.id, productGroupAttributes.attributeId))
    .where(eq(productGroupAttributes.productGroupId, p.productGroupId));

  console.log('\nGroup PGAs:');
  pgas.forEach(g => console.log(' ', JSON.stringify(g)));

  // Get stored PAVs for this product
  const pavs = await db.select({
    pgaId: productAttributeValues.productGroupAttributeId,
    numericValue: productAttributeValues.numericValue,
    textValue: productAttributeValues.textValue,
  }).from(productAttributeValues).where(eq(productAttributeValues.productId, CORE_ID));

  console.log('\nStored PAVs:', pavs.length);
  pavs.forEach(pav => console.log(' ', JSON.stringify(pav)));
}

main().catch(console.error).finally(() => process.exit());
