/**
 * One-time fix: adds formula_vars JSONB column to product_group_attributes
 * and drops source_input_pga_id + its FK if they still exist.
 * Run with: npx tsx scripts/fix-pga-columns.ts
 */
import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  // Drop FK constraint if it exists
  await sql`
    ALTER TABLE product_group_attributes
    DROP CONSTRAINT IF EXISTS
      "product_group_attributes_source_input_pga_id_product_group_attr"
  `;
  console.log('✓ dropped FK constraint (if existed)');

  // Drop source_input_pga_id column if it exists
  await sql`
    ALTER TABLE product_group_attributes
    DROP COLUMN IF EXISTS source_input_pga_id
  `;
  console.log('✓ dropped source_input_pga_id (if existed)');

  // Add formula_vars JSONB column if not present
  await sql`
    ALTER TABLE product_group_attributes
    ADD COLUMN IF NOT EXISTS formula_vars jsonb
  `;
  console.log('✓ added formula_vars jsonb');

  await sql.end();
  console.log('Done.');
}

main().catch((err) => { console.error(err); process.exit(1); });
