/**
 * Link DCW variants to their Copper Rod input variants.
 *
 * DCW BOM input: 1f455814-2bbc-415e-823e-4e061e4be31f
 *
 * Assignments:
 *   0.857mm² DCW → 8mm² Copper Rod
 *   1.429mm² DCW → 10mm² Copper Rod (closest standard rod)
 *   2.286mm² DCW → 10mm² Copper Rod
 *   DCW 10 SQ MM → 10mm² Copper Rod
 *   6sq mm Copper Wire → 8mm² Copper Rod
 */
import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection';
import { productVariantInputs } from '../db/schema';

const DCW_BOM_INPUT_ID = '1f455814-2bbc-415e-823e-4e061e4be31f';

const ROD_8MM = 'aca49bb3-96c6-4953-bf0f-224137e7abcd';
const ROD_10MM = '7dd2e773-9edc-4c59-bb8a-1c89e8ae1f18';

const links = [
  { dcwId: '6187ee2e-b6e1-4fa0-9388-87485b6499d7', rodId: ROD_8MM,  label: '0.857mm² DCW → 8mm² Rod' },
  { dcwId: 'f9f29744-c9ad-4c12-acb7-222e899a98d1', rodId: ROD_10MM, label: '1.429mm² DCW → 10mm² Rod' },
  { dcwId: '1257cab6-472d-4f8e-9a61-ce7c2dff3ce0', rodId: ROD_10MM, label: '2.286mm² DCW → 10mm² Rod' },
  { dcwId: '64dd2aba-2dc2-4260-ae11-17f2563e8af5', rodId: ROD_10MM, label: 'DCW 10 SQ MM → 10mm² Rod' },
  { dcwId: '6f76b1af-8309-4575-ad9f-be8fc337af29', rodId: ROD_8MM,  label: '6sq mm Wire → 8mm² Rod' },
];

async function main() {
  for (const { dcwId, rodId, label } of links) {
    const [ex] = await db.select({ id: productVariantInputs.id })
      .from(productVariantInputs)
      .where(and(
        eq(productVariantInputs.outputProductId,     dcwId),
        eq(productVariantInputs.productGroupInputId, DCW_BOM_INPUT_ID),
      )).limit(1);

    if (ex) {
      await db.update(productVariantInputs)
        .set({ inputProductId: rodId })
        .where(eq(productVariantInputs.id, ex.id));
      console.log(`  updated: ${label}`);
    } else {
      await db.insert(productVariantInputs).values({
        outputProductId:     dcwId,
        productGroupInputId: DCW_BOM_INPUT_ID,
        inputProductId:      rodId,
      });
      console.log(`  created: ${label}`);
    }
  }
  console.log('\n✅ DCW variants linked to Copper Rod variants.');
}

main().catch(console.error).finally(() => process.exit());
