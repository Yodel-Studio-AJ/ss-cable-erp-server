import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  await sql`
    INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES ('0010_fix_pga_formula_vars', ${Date.now()})
    ON CONFLICT DO NOTHING
  `;
  console.log('✓ migration 0010 marked as applied');
  await sql.end();
}

main().catch(console.error);
