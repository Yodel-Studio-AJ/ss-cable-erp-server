import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  const GROUP_ID = '0d24e634-18e7-487c-a596-d9f1e7bc94d0'; // Copper Rods

  // Get attributes with full info
  const attrs = await sql`
    SELECT pga.id as pga_id, pga.formula_alias, pga.is_quantity_basis,
           pga.is_calculated, pga.is_from_input,
           a.name as attr_name, a.unit, a.data_type
    FROM product_group_attributes pga
    JOIN attributes a ON a.id = pga.attribute_id
    WHERE pga.product_group_id = ${GROUP_ID}
    ORDER BY pga.sort_order
  `;

  console.log('Attributes:');
  attrs.forEach(a => console.log(` [${a.formula_alias}] ${a.attr_name} (${a.unit}) calc=${a.is_calculated}`));

  // Map alias → pga_id
  const byAlias: Record<string, string> = {};
  for (const a of attrs) if (a.formula_alias) byAlias[a.formula_alias] = a.pga_id;

  console.log('\nAlias map:', byAlias);

  // Delete existing variants we created before
  await sql`DELETE FROM products WHERE product_group_id = ${GROUP_ID}`;
  console.log('\nCleared old variants.');

  // Copper rod density (standard: 8960 kg/m³)
  const DENSITY = 8960;

  // Variant definitions: name, sku, cross_section_mm2, length_m
  // Weight = density * cross_section * length / 1_000_000 kg
  const variants = [
    { name: '8 mm² Copper Rod', sku: 'CR-8MM2',  xsec: 8,  len: 1000 },
    { name: '10 mm² Copper Rod', sku: 'CR-10MM2', xsec: 10, len: 1000 },
  ];

  for (const v of variants) {
    const weight = DENSITY * v.xsec * v.len / 1_000_000;

    const [product] = await sql`
      INSERT INTO products (product_group_id, name, sku, is_active)
      VALUES (${GROUP_ID}, ${v.name}, ${v.sku}, true)
      RETURNING id, name, sku
    `;
    console.log(`\nCreated: ${product.name} (${product.id})`);

    // Insert values for every non-from_input attr
    const valuesToInsert: { pgaId: string; numericValue: number }[] = [];

    if (byAlias['cross_section']) valuesToInsert.push({ pgaId: byAlias['cross_section'], numericValue: v.xsec });
    if (byAlias['density'])       valuesToInsert.push({ pgaId: byAlias['density'],       numericValue: DENSITY });
    if (byAlias['length'])        valuesToInsert.push({ pgaId: byAlias['length'],         numericValue: v.len });
    // Weight only if it's not calculated
    const weightAttr = attrs.find(a => a.formula_alias === 'weight');
    if (weightAttr && !weightAttr.is_calculated && byAlias['weight']) {
      valuesToInsert.push({ pgaId: byAlias['weight'], numericValue: weight });
    }

    for (const val of valuesToInsert) {
      await sql`
        INSERT INTO product_attribute_values (product_id, product_group_attribute_id, numeric_value)
        VALUES (${product.id}, ${val.pgaId}, ${val.numericValue})
      `;
      const attrName = attrs.find(a => a.pga_id === val.pgaId)?.attr_name;
      console.log(`  ${attrName} = ${val.numericValue}`);
    }
    console.log(`  Weight (computed) ≈ ${weight.toFixed(4)} kg`);
  }

  console.log('\nDone!');
  await sql.end();
}

main().catch(console.error);
