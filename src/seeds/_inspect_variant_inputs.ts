import { db } from '../db/connection';
import { productVariantInputs, products } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';

const wireGroupId = '0949b99b-85be-454f-9373-f8432dd574e6';

async function main() {
  const wires = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.productGroupId, wireGroupId));

  console.log('Wire products:', wires.length);
  wires.forEach(w => console.log(' ', w.id, w.name));

  if (wires.length === 0) return;

  const wireIds = wires.map(w => w.id);
  const vi = await db
    .select({
      outputProductId: productVariantInputs.outputProductId,
      productGroupInputId: productVariantInputs.productGroupInputId,
      inputProductId: productVariantInputs.inputProductId,
    })
    .from(productVariantInputs)
    .where(inArray(productVariantInputs.outputProductId, wireIds));

  console.log('\nVariant inputs saved:', vi.length);
  vi.forEach(r => console.log(' ', JSON.stringify(r)));
}

main().catch(console.error).finally(() => process.exit());
