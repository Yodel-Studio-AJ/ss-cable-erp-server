import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  const rows = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'product_group_attributes'
    ORDER BY ordinal_position
  `;
  console.log('product_group_attributes columns:');
  rows.forEach(r => console.log(' ', r.column_name, '-', r.data_type));
  await sql.end();
}

main().catch(console.error);
