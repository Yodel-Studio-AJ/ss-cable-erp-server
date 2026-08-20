/**
 * Seed: PVC & XLPE insulation compound raw materials
 *
 * Creates:
 *   1. Shared attributes (density, tensile strength, elongation, etc.)
 *   2. PVC Compound group + variants (Grade A / B / C, Heat Resistant)
 *   3. XLPE Compound group + variants (Standard, HV Grade, Tree Retardant)
 *   4. Two insulation vendors
 *   5. Four purchase orders with line items
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection';
import {
  attributes, productGroups, productGroupAttributes,
  products, productAttributeValues,
  vendors, purchaseOrders, purchaseOrderItems,
} from '../db/schema';

// ─── helpers ──────────────────────────────────────────────────────────────────

async function upsertAttr(name: string, unit: string | null): Promise<string> {
  const [ex] = await db.select({ id: attributes.id }).from(attributes)
    .where(eq(attributes.name, name)).limit(1);
  if (ex) return ex.id;
  const [cr] = await db.insert(attributes).values({ name, unit: unit ?? undefined, dataType: 'number' })
    .returning({ id: attributes.id });
  console.log(`  attr: ${name}`);
  return cr.id;
}

async function upsertGroup(name: string, isProcured: boolean): Promise<string> {
  const [ex] = await db.select({ id: productGroups.id }).from(productGroups)
    .where(eq(productGroups.name, name)).limit(1);
  if (ex) { console.log(`  group exists: ${name}`); return ex.id; }
  const [cr] = await db.insert(productGroups).values({
    name, type: 'raw_material', materialType: 'pvc', isProcured,
  }).returning({ id: productGroups.id });
  console.log(`  group created: ${name} (${cr.id})`);
  return cr.id;
}

async function addPga(groupId: string, attrId: string, opts: {
  isQuantityBasis?: boolean; isCalculated?: boolean; isFromInput?: boolean;
  formulaAlias?: string; sortOrder: number;
}): Promise<string> {
  const [ex] = await db.select({ id: productGroupAttributes.id })
    .from(productGroupAttributes)
    .where(and(
      eq(productGroupAttributes.productGroupId, groupId),
      eq(productGroupAttributes.attributeId, attrId),
    )).limit(1);
  if (ex) return ex.id;
  const [cr] = await db.insert(productGroupAttributes).values({
    productGroupId:  groupId,
    attributeId:     attrId,
    isQuantityBasis: opts.isQuantityBasis ?? false,
    isCalculated:    opts.isCalculated   ?? false,
    isFromInput:     opts.isFromInput    ?? false,
    formulaAlias:    opts.formulaAlias   ?? null,
    sortOrder:       opts.sortOrder,
  }).returning({ id: productGroupAttributes.id });
  return cr.id;
}

async function upsertProduct(name: string, sku: string, groupId: string): Promise<string> {
  const [ex] = await db.select({ id: products.id }).from(products)
    .where(and(eq(products.productGroupId, groupId), eq(products.name, name))).limit(1);
  if (ex) { console.log(`  product exists: ${name}`); return ex.id; }
  const [cr] = await db.insert(products).values({ name, sku, productGroupId: groupId })
    .returning({ id: products.id });
  console.log(`  product created: ${name} (${cr.id})`);
  return cr.id;
}

async function setPav(productId: string, pgaId: string, rawNumeric: string | null, textValue?: string | null) {
  // numericValue column is `numeric` in DB, which Drizzle types as number — cast via unknown
  const numericValue = rawNumeric != null ? (parseFloat(rawNumeric) as unknown as number) : null;
  const [ex] = await db.select({ id: productAttributeValues.id })
    .from(productAttributeValues)
    .where(and(
      eq(productAttributeValues.productId, productId),
      eq(productAttributeValues.productGroupAttributeId, pgaId),
    )).limit(1);
  if (ex) {
    await db.update(productAttributeValues)
      .set({ numericValue, textValue: textValue ?? null })
      .where(eq(productAttributeValues.id, ex.id));
  } else {
    await db.insert(productAttributeValues).values({
      productId, productGroupAttributeId: pgaId,
      numericValue, textValue: textValue ?? null,
    });
  }
}

async function upsertVendor(name: string, type: 'manufacturer' | 'distributor', opts: {
  specialization: string; city: string; state: string;
  contactName: string; contactPhone: string; contactEmail: string; gstin?: string;
}): Promise<string> {
  const [ex] = await db.select({ id: vendors.id }).from(vendors)
    .where(eq(vendors.companyName, name)).limit(1);
  if (ex) { console.log(`  vendor exists: ${name}`); return ex.id; }
  const [cr] = await db.insert(vendors).values({
    companyName:     name,
    vendorType:      type,
    specialization:  opts.specialization,
    city:            opts.city,
    state:           opts.state,
    contactName:     opts.contactName,
    contactPhone:    opts.contactPhone,
    contactEmail:    opts.contactEmail,
    gstin:           opts.gstin ?? null,
  }).returning({ id: vendors.id });
  console.log(`  vendor created: ${name} (${cr.id})`);
  return cr.id;
}

async function createPo(opts: {
  poNumber: string; vendorId: string | null; status: string;
  notes: string; expectedDeliveryDate?: string;
  items: { productId: string; qty: number; unitPrice: number; notes?: string; qtyReceived?: number }[];
}): Promise<void> {
  const [ex] = await db.select({ id: purchaseOrders.id }).from(purchaseOrders)
    .where(eq(purchaseOrders.poNumber, opts.poNumber)).limit(1);
  const poId = ex?.id ?? (await db.insert(purchaseOrders).values({
    poNumber:             opts.poNumber,
    vendorId:             opts.vendorId,
    status:               opts.status,
    notes:                opts.notes,
    expectedDeliveryDate: opts.expectedDeliveryDate ?? null,
  }).returning({ id: purchaseOrders.id }))[0].id;

  if (!ex) {
    for (const item of opts.items) {
      await db.insert(purchaseOrderItems).values({
        purchaseOrderId:  poId,
        productId:        item.productId,
        quantityOrdered:  item.qty,
        unitPrice:        item.unitPrice,
        totalAmount:      item.qty * item.unitPrice,
        quantityReceived: item.qtyReceived ?? 0,
        notes:            item.notes ?? null,
      });
    }
    console.log(`  PO created: ${opts.poNumber} (${opts.items.length} items)`);
  } else {
    console.log(`  PO exists:  ${opts.poNumber}`);
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {

  // ── 1. Shared attributes ───────────────────────────────────────────────────
  console.log('\n── Attributes ────────────────────────────────────────────────');
  const A_WEIGHT    = await upsertAttr('Weight',                 'kg');
  const A_DENSITY   = await upsertAttr('Density',               'g/cm³');
  const A_TENSILE   = await upsertAttr('Tensile Strength',       'MPa');
  const A_ELONG     = await upsertAttr('Elongation at Break',    '%');
  const A_MAX_TEMP  = await upsertAttr('Max Operating Temp',     '°C');
  const A_VOL_RES   = await upsertAttr('Volume Resistivity',     'Ω·cm');
  const A_DIEL      = await upsertAttr('Dielectric Strength',    'kV/mm');
  const A_SHORE_D   = await upsertAttr('Shore D Hardness',       null);
  const A_STANDARD  = await upsertAttr('Compound Standard',      null);
  const A_CROSSLINK = await upsertAttr('Degree of Crosslinking', '%');
  const A_COLOR     = await upsertAttr('Color',                  null);

  // ── 2. PVC Compound group ──────────────────────────────────────────────────
  console.log('\n── PVC Compound group ────────────────────────────────────────');
  const pvcGroupId = await upsertGroup('PVC Insulation Compound', true);

  const pvcPgas = {
    weight:   await addPga(pvcGroupId, A_WEIGHT,   { isQuantityBasis: true, formulaAlias: 'weight',    sortOrder: 0 }),
    density:  await addPga(pvcGroupId, A_DENSITY,  { formulaAlias: 'density',   sortOrder: 1 }),
    tensile:  await addPga(pvcGroupId, A_TENSILE,  { sortOrder: 2 }),
    elong:    await addPga(pvcGroupId, A_ELONG,    { sortOrder: 3 }),
    maxTemp:  await addPga(pvcGroupId, A_MAX_TEMP, { sortOrder: 4 }),
    volRes:   await addPga(pvcGroupId, A_VOL_RES,  { sortOrder: 5 }),
    diel:     await addPga(pvcGroupId, A_DIEL,     { sortOrder: 6 }),
    shoreD:   await addPga(pvcGroupId, A_SHORE_D,  { sortOrder: 7 }),
    standard: await addPga(pvcGroupId, A_STANDARD, { sortOrder: 8 }),
    color:    await addPga(pvcGroupId, A_COLOR,    { sortOrder: 9 }),
  };

  // PVC variants
  // Grade A — IEC 60502-1 Type TM1 (70°C, general purpose, black)
  console.log('\n  PVC variant: Grade A');
  const pvcA = await upsertProduct('Grade A PVC Compound', 'PVC-GRA-A', pvcGroupId);
  await setPav(pvcA, pvcPgas.density,  '1.40');
  await setPav(pvcA, pvcPgas.tensile,  '10');
  await setPav(pvcA, pvcPgas.elong,    '150');
  await setPav(pvcA, pvcPgas.maxTemp,  '70');
  await setPav(pvcA, pvcPgas.volRes,   '1e12');
  await setPav(pvcA, pvcPgas.diel,     '15');
  await setPav(pvcA, pvcPgas.shoreD,   '75');
  await setPav(pvcA, pvcPgas.standard, null, 'IEC 60502-1 TM1');
  await setPav(pvcA, pvcPgas.color,    null, 'Black');

  // Grade B — IEC 60502-1 Type TM2 (70°C, improved cold bend, black)
  console.log('  PVC variant: Grade B');
  const pvcB = await upsertProduct('Grade B PVC Compound', 'PVC-GRA-B', pvcGroupId);
  await setPav(pvcB, pvcPgas.density,  '1.38');
  await setPav(pvcB, pvcPgas.tensile,  '12');
  await setPav(pvcB, pvcPgas.elong,    '200');
  await setPav(pvcB, pvcPgas.maxTemp,  '70');
  await setPav(pvcB, pvcPgas.volRes,   '1e13');
  await setPav(pvcB, pvcPgas.diel,     '18');
  await setPav(pvcB, pvcPgas.shoreD,   '72');
  await setPav(pvcB, pvcPgas.standard, null, 'IEC 60502-1 TM2');
  await setPav(pvcB, pvcPgas.color,    null, 'Black');

  // Grade C — IEC 60502-1 Type ST1 (90°C heat resistant sheath)
  console.log('  PVC variant: Grade C (Heat Resistant)');
  const pvcC = await upsertProduct('Grade C PVC Compound (HR)', 'PVC-GRA-C-HR', pvcGroupId);
  await setPav(pvcC, pvcPgas.density,  '1.42');
  await setPav(pvcC, pvcPgas.tensile,  '15');
  await setPav(pvcC, pvcPgas.elong,    '180');
  await setPav(pvcC, pvcPgas.maxTemp,  '90');
  await setPav(pvcC, pvcPgas.volRes,   '1e13');
  await setPav(pvcC, pvcPgas.diel,     '20');
  await setPav(pvcC, pvcPgas.shoreD,   '78');
  await setPav(pvcC, pvcPgas.standard, null, 'IEC 60502-1 ST1');
  await setPav(pvcC, pvcPgas.color,    null, 'Grey');

  // Grade D — Flame Retardant (LSOH-PVC blend, 70°C)
  console.log('  PVC variant: Grade D (Flame Retardant)');
  const pvcD = await upsertProduct('Grade D PVC Compound (FR)', 'PVC-GRA-D-FR', pvcGroupId);
  await setPav(pvcD, pvcPgas.density,  '1.50');
  await setPav(pvcD, pvcPgas.tensile,  '10');
  await setPav(pvcD, pvcPgas.elong,    '150');
  await setPav(pvcD, pvcPgas.maxTemp,  '70');
  await setPav(pvcD, pvcPgas.volRes,   '1e12');
  await setPav(pvcD, pvcPgas.diel,     '15');
  await setPav(pvcD, pvcPgas.shoreD,   '80');
  await setPav(pvcD, pvcPgas.standard, null, 'IEC 60754-1 FR/LSOH');
  await setPav(pvcD, pvcPgas.color,    null, 'Red');

  // ── 3. XLPE Compound group ─────────────────────────────────────────────────
  console.log('\n── XLPE Compound group ───────────────────────────────────────');
  const xlpeGroupId = await upsertGroup('XLPE Insulation Compound', true);

  const xlpePgas = {
    weight:    await addPga(xlpeGroupId, A_WEIGHT,    { isQuantityBasis: true, formulaAlias: 'weight',    sortOrder: 0 }),
    density:   await addPga(xlpeGroupId, A_DENSITY,   { formulaAlias: 'density',   sortOrder: 1 }),
    tensile:   await addPga(xlpeGroupId, A_TENSILE,   { sortOrder: 2 }),
    elong:     await addPga(xlpeGroupId, A_ELONG,     { sortOrder: 3 }),
    maxTemp:   await addPga(xlpeGroupId, A_MAX_TEMP,  { sortOrder: 4 }),
    volRes:    await addPga(xlpeGroupId, A_VOL_RES,   { sortOrder: 5 }),
    diel:      await addPga(xlpeGroupId, A_DIEL,      { sortOrder: 6 }),
    crosslink: await addPga(xlpeGroupId, A_CROSSLINK, { sortOrder: 7 }),
    standard:  await addPga(xlpeGroupId, A_STANDARD,  { sortOrder: 8 }),
    color:     await addPga(xlpeGroupId, A_COLOR,     { sortOrder: 9 }),
  };

  // XLPE variant: Standard 90°C (IEC 60502-1 XLPE, for LV/MV cables)
  console.log('\n  XLPE variant: Standard 90°C');
  const xlpeStd = await upsertProduct('XLPE Insulation Compound (90°C)', 'XLPE-STD-90', xlpeGroupId);
  await setPav(xlpeStd, xlpePgas.density,   '0.930');
  await setPav(xlpeStd, xlpePgas.tensile,   '12.5');
  await setPav(xlpeStd, xlpePgas.elong,     '200');
  await setPav(xlpeStd, xlpePgas.maxTemp,   '90');
  await setPav(xlpeStd, xlpePgas.volRes,    '1e14');
  await setPav(xlpeStd, xlpePgas.diel,      '25');
  await setPav(xlpeStd, xlpePgas.crosslink, '70');
  await setPav(xlpeStd, xlpePgas.standard,  null, 'IEC 60502-1 XLPE');
  await setPav(xlpeStd, xlpePgas.color,     null, 'Natural');

  // XLPE variant: HV Grade (for MV 6–35 kV cables, higher crosslink)
  console.log('  XLPE variant: HV Grade');
  const xlpeHv = await upsertProduct('XLPE HV Grade Compound', 'XLPE-HV-35KV', xlpeGroupId);
  await setPav(xlpeHv, xlpePgas.density,   '0.920');
  await setPav(xlpeHv, xlpePgas.tensile,   '14');
  await setPav(xlpeHv, xlpePgas.elong,     '250');
  await setPav(xlpeHv, xlpePgas.maxTemp,   '90');
  await setPav(xlpeHv, xlpePgas.volRes,    '1e16');
  await setPav(xlpeHv, xlpePgas.diel,      '35');
  await setPav(xlpeHv, xlpePgas.crosslink, '75');
  await setPav(xlpeHv, xlpePgas.standard,  null, 'IEC 60840 / IEC 62067');
  await setPav(xlpeHv, xlpePgas.color,     null, 'Natural');

  // XLPE variant: Tree Retardant (TR-XLPE) — inhibits water treeing
  console.log('  XLPE variant: Tree Retardant (TR-XLPE)');
  const xlpeTr = await upsertProduct('TR-XLPE Compound', 'XLPE-TR-90', xlpeGroupId);
  await setPav(xlpeTr, xlpePgas.density,   '0.925');
  await setPav(xlpeTr, xlpePgas.tensile,   '13');
  await setPav(xlpeTr, xlpePgas.elong,     '300');
  await setPav(xlpeTr, xlpePgas.maxTemp,   '90');
  await setPav(xlpeTr, xlpePgas.volRes,    '1e15');
  await setPav(xlpeTr, xlpePgas.diel,      '30');
  await setPav(xlpeTr, xlpePgas.crosslink, '72');
  await setPav(xlpeTr, xlpePgas.standard,  null, 'IEC 60502-2 TR-XLPE');
  await setPav(xlpeTr, xlpePgas.color,     null, 'Natural');

  // ── 4. Vendors ─────────────────────────────────────────────────────────────
  console.log('\n── Vendors ───────────────────────────────────────────────────');
  const vendorPolychem = await upsertVendor('Polychem Polymers Pvt Ltd', 'manufacturer', {
    specialization: 'PVC & Polymer compounds for cable industry',
    city:           'Pune',
    state:          'Maharashtra',
    contactName:    'Rajesh Mehta',
    contactPhone:   '+91-9876543210',
    contactEmail:   'sales@polychempolymers.in',
    gstin:          '27AABCP1234F1ZK',
  });
  const vendorReliance = await upsertVendor('Reliance Polymers & Chemicals', 'distributor', {
    specialization: 'XLPE, PE and specialty cable compounds',
    city:           'Mumbai',
    state:          'Maharashtra',
    contactName:    'Sneha Iyer',
    contactPhone:   '+91-9123456789',
    contactEmail:   'sneha.iyer@reliancepolymers.com',
    gstin:          '27AAECR5678G1ZP',
  });

  // ── 5. Purchase Orders ─────────────────────────────────────────────────────
  console.log('\n── Purchase Orders ───────────────────────────────────────────');

  // PO-INS-001 — confirmed, Grade A + Grade B PVC from Polychem
  await createPo({
    poNumber:             'PO-INS-001',
    vendorId:             vendorPolychem,
    status:               'confirmed',
    notes:                'Q4 insulation compound stock — mix of Grade A and Grade B PVC.',
    expectedDeliveryDate: '2026-09-05',
    items: [
      { productId: pvcA, qty: 500, unitPrice: 185,  notes: 'Grade A TM1 black compound' },
      { productId: pvcB, qty: 300, unitPrice: 210,  notes: 'Grade B TM2 black compound — improved cold bend' },
    ],
  });

  // PO-INS-002 — draft, XLPE Standard from Reliance
  await createPo({
    poNumber:             'PO-INS-002',
    vendorId:             vendorReliance,
    status:               'draft',
    notes:                'Tentative order for XLPE compound, pending technical approval.',
    expectedDeliveryDate: '2026-09-20',
    items: [
      { productId: xlpeStd, qty: 800, unitPrice: 320, notes: 'Standard 90°C XLPE — LV cable production' },
    ],
  });

  // PO-INS-003 — delivered, Grade C HR PVC from Polychem
  await createPo({
    poNumber:             'PO-INS-003',
    vendorId:             vendorPolychem,
    status:               'delivered',
    notes:                'Heat resistant PVC for sheath grade. Delivered and quality checked.',
    expectedDeliveryDate: '2026-07-15',
    items: [
      { productId: pvcC, qty: 400, unitPrice: 235, notes: 'HR Grade ST1 — grey sheath compound', qtyReceived: 400 },
      { productId: pvcD, qty: 200, unitPrice: 265, notes: 'FR Grade — red flame retardant sheath', qtyReceived: 200 },
    ],
  });

  // PO-INS-004 — in_transit, XLPE HV Grade from Reliance
  await createPo({
    poNumber:             'PO-INS-004',
    vendorId:             vendorReliance,
    status:               'in_transit',
    notes:                'XLPE HV grade for MV cable project. Shipped from Mumbai warehouse.',
    expectedDeliveryDate: '2026-08-28',
    items: [
      { productId: xlpeHv, qty: 600, unitPrice: 490, notes: 'HV Grade for 11kV / 33kV cable insulation' },
      { productId: xlpeTr, qty: 200, unitPrice: 420, notes: 'TR-XLPE for water-tree resistant insulation' },
    ],
  });

  // PO-INS-005 — draft, restock of Grade A from Polychem
  await createPo({
    poNumber:             'PO-INS-005',
    vendorId:             vendorPolychem,
    status:               'draft',
    notes:                'Restock order for Grade A PVC — production forecast for next quarter.',
    expectedDeliveryDate: '2026-10-10',
    items: [
      { productId: pvcA, qty: 1000, unitPrice: 182, notes: 'Bulk order — 3% rate reduction negotiated' },
    ],
  });

  console.log('\n✅ PVC & XLPE insulation materials seeded successfully.');
  console.log(`
Summary
───────
Groups:   PVC Insulation Compound, XLPE Insulation Compound
Variants: Grade A, B, C(HR), D(FR) PVC  |  Standard, HV, TR-XLPE
Vendors:  Polychem Polymers (manufacturer), Reliance Polymers (distributor)
POs:      PO-INS-001 (confirmed) · PO-INS-002 (draft)
          PO-INS-003 (delivered) · PO-INS-004 (in_transit)
          PO-INS-005 (draft)
  `);
}

main().catch(console.error).finally(() => process.exit());
