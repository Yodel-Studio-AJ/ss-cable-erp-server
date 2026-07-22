import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  // Find copper rod group
  const groups = await sql`SELECT id, name FROM product_groups ORDER BY name`;
  console.log('Product groups:', groups.map(g => `${g.name} (${g.id})`).join('\n'));

  const copperRod = groups.find(g => g.name.toLowerCase().includes('copper rod'));
  if (!copperRod) {
    console.error('Copper rod group not found. Available groups listed above.');
    await sql.end();
    return;
  }
  console.log('\nFound:', copperRod.name, copperRod.id);

  // Get its attributes
  const attrs = await sql`
    SELECT pga.id, pga.formula_alias, pga.is_quantity_basis, pga.is_calculated, pga.is_from_input,
           a.name, a.unit, a.data_type
    FROM product_group_attributes pga
    JOIN attributes a ON a.id = pga.attribute_id
    WHERE pga.product_group_id = ${copperRod.id}
    ORDER BY pga.sort_order
  `;
  console.log('\nAttributes:');
  attrs.forEach(a => console.log(` - ${a.name} (${a.unit ?? '—'}) alias=${a.formula_alias} qty_basis=${a.is_quantity_basis}`));

  // Identify qty-basis attr (e.g. cross section area)
  const qtyBasis = attrs.find(a => a.is_quantity_basis);
  const simpleAttrs = attrs.filter(a => !a.is_calculated && !a.is_from_input);

  console.log('\nQty basis attr:', qtyBasis?.name ?? 'none');

  // --- Variant 1: 8 sq mm copper rod ---
  const variant1Name = '8 mm² Copper Rod';
  const variant1Sku  = 'CR-8MM2';

  // --- Variant 2: 10 sq mm copper rod ---
  const variant2Name = '10 mm² Copper Rod';
  const variant2Sku  = 'CR-10MM2';

  // Default numeric values — adjust if your group has different attributes
  // We'll set: qty-basis = 8 or 10, everything else null (user can fill later)
  for (const [varName, varSku, qtyVal] of [
    [variant1Name, variant1Sku, 8],
    [variant2Name, variant2Sku, 10],
  ] as const) {
    // Insert product
    const [product] = await sql`
      INSERT INTO products (product_group_id, name, sku, is_active)
      VALUES (${copperRod.id}, ${varName}, ${varSku}, true)
      ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name, sku
    `;
    console.log(`\nCreated: ${product.name} (${product.id})`);

    // Insert qty-basis attribute value
    if (qtyBasis) {
      await sql`
        INSERT INTO product_attribute_values (product_id, product_group_attribute_id, numeric_value)
        VALUES (${product.id}, ${qtyBasis.id}, ${qtyVal})
        ON CONFLICT (product_id, product_group_attribute_id)
        DO UPDATE SET numeric_value = EXCLUDED.numeric_value
      `;
      console.log(`  ${qtyBasis.name} = ${qtyVal} ${qtyBasis.unit ?? ''}`);
    }
  }

  console.log('\nDone!');
  await sql.end();
}

main().catch(console.error);
