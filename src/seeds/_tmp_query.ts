import { db } from '../db/connection';
import { productGroups, productGroupAttributes, attributes, productGroupInputs } from '../db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const [rodGroup] = await db.select({ id: productGroups.id }).from(productGroups).where(eq(productGroups.name, 'Copper Rods')).limit(1);
  const [dcwGroup] = await db.select({ id: productGroups.id }).from(productGroups).where(eq(productGroups.name, 'Drawn Copper Wire')).limit(1);

  const rodPgas = await db.select({ id: productGroupAttributes.id, isQuantityBasis: productGroupAttributes.isQuantityBasis, formulaAlias: productGroupAttributes.formulaAlias, attrName: attributes.name }).from(productGroupAttributes).innerJoin(attributes, eq(attributes.id, productGroupAttributes.attributeId)).where(eq(productGroupAttributes.productGroupId, rodGroup.id));

  const dcwPgas = await db.select({ id: productGroupAttributes.id, isQuantityBasis: productGroupAttributes.isQuantityBasis, isFromInput: productGroupAttributes.isFromInput, formulaAlias: productGroupAttributes.formulaAlias, formula: productGroupAttributes.formula, attrName: attributes.name }).from(productGroupAttributes).innerJoin(attributes, eq(attributes.id, productGroupAttributes.attributeId)).where(eq(productGroupAttributes.productGroupId, dcwGroup.id));

  const bom = await db.select({ id: productGroupInputs.id, formula: productGroupInputs.qtyFormula }).from(productGroupInputs).where(eq(productGroupInputs.outputGroupId, dcwGroup.id)).limit(1);

  console.log('ROD:', JSON.stringify(rodPgas, null, 2));
  console.log('DCW:', JSON.stringify(dcwPgas, null, 2));
  console.log('BOM:', JSON.stringify(bom[0], null, 2));
}

main().catch(console.error).finally(() => process.exit());
