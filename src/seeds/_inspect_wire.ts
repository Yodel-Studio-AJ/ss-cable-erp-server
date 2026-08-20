import { db } from '../db/connection';
import { productGroups, productGroupAttributes, productGroupInputs, attributes } from '../db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const [wg] = await db.select({ id: productGroups.id }).from(productGroups)
    .where(eq(productGroups.name, 'FR-LSH PVC Insulated Wire')).limit(1);
  if (!wg) { console.log('Wire group NOT FOUND'); return; }
  console.log('Wire group:', wg.id);

  const pgas = await db.select({
    pgaId: productGroupAttributes.id,
    name: attributes.name,
    isQtyBasis: productGroupAttributes.isQuantityBasis,
    isFromInput: productGroupAttributes.isFromInput,
    formula: productGroupAttributes.formula,
    alias: productGroupAttributes.formulaAlias,
  }).from(productGroupAttributes)
    .innerJoin(attributes, eq(attributes.id, productGroupAttributes.attributeId))
    .where(eq(productGroupAttributes.productGroupId, wg.id))
    .orderBy(productGroupAttributes.sortOrder);

  console.log('\nPGAs:');
  pgas.forEach(p => console.log(' ', JSON.stringify(p)));

  const inputs = await db.select({
    id: productGroupInputs.id,
    label: productGroupInputs.label,
    formula: productGroupInputs.qtyFormula,
  }).from(productGroupInputs)
    .where(eq(productGroupInputs.outputGroupId, wg.id))
    .orderBy(productGroupInputs.sortOrder);

  console.log('\nBOM inputs:');
  inputs.forEach(i => console.log(' ', JSON.stringify(i)));
}

main().catch(console.error).finally(() => process.exit());
