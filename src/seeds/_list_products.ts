import { db } from '../db/connection';
import { products, productGroups } from '../db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const groupsOfInterest = ['Copper Rods', 'Drawn Copper Wire'];
  for (const name of groupsOfInterest) {
    const [g] = await db.select({ id: productGroups.id }).from(productGroups).where(eq(productGroups.name, name)).limit(1);
    if (!g) { console.log(`${name}: group not found`); continue; }
    const prods = await db.select({ id: products.id, name: products.name, sku: products.sku }).from(products).where(eq(products.productGroupId, g.id));
    console.log(`\n${name} (${g.id}):`);
    for (const p of prods) console.log(`  ${p.name} (${p.id}) sku=${p.sku}`);
  }
}
main().catch(console.error).finally(() => process.exit());
