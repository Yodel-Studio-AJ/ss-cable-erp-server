/**
 * Inspect DCW group attributes and DCW 10 variant values.
 * Run: npx tsx --env-file=.env src/seeds/inspect-dcw.ts
 */
import { eq } from 'drizzle-orm';
import { db } from '../db/connection';
import { productGroups, productGroupAttributes, attributes, products, productAttributeValues } from '../db/schema';

async function main() {
  const allGroups = await db.select({ id: productGroups.id, name: productGroups.name }).from(productGroups);
  const dcwGroup = allGroups.find((g) => g.name.toLowerCase().includes('drawn'));
  if (!dcwGroup) { console.error('DCW not found'); process.exit(1); }

  console.log(`\n=== Group: ${dcwGroup.name} ===`);
  const pgaRows = await db
    .select({
      pgaId: productGroupAttributes.id,
      isQuantityBasis: productGroupAttributes.isQuantityBasis,
      isCalculated: productGroupAttributes.isCalculated,
      isFromInput: productGroupAttributes.isFromInput,
      formulaAlias: productGroupAttributes.formulaAlias,
      formula: productGroupAttributes.formula,
      sortOrder: productGroupAttributes.sortOrder,
      attrName: attributes.name,
    })
    .from(productGroupAttributes)
    .innerJoin(attributes, eq(productGroupAttributes.attributeId, attributes.id))
    .where(eq(productGroupAttributes.productGroupId, dcwGroup.id));

  for (const r of pgaRows) {
    const kind = r.isQuantityBasis ? 'QTY_BASIS' : r.isFromInput ? 'FROM_INPUT' : r.isCalculated ? 'CALCULATED' : 'SIMPLE';
    console.log(`  [${kind}] sort=${r.sortOrder} "${r.attrName}" alias=${r.formulaAlias ?? '(derived)'}`);
    if (r.formula) console.log(`         formula: ${r.formula}`);
    console.log(`         pgaId: ${r.pgaId}`);
  }

  const prods = await db.select().from(products).where(eq(products.productGroupId, dcwGroup.id));
  for (const p of prods) {
    console.log(`\n  Product: "${p.name}" (${p.id})`);
    const avs = await db.select().from(productAttributeValues).where(eq(productAttributeValues.productId, p.id));
    for (const av of avs) {
      console.log(`    pgaId=${av.productGroupAttributeId} numeric=${av.numericValue} text=${av.textValue}`);
    }
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
