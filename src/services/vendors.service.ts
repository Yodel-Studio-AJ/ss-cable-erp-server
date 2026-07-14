import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/connection';
import { vendors, vendorProductGroups, vendorBranches, productGroups } from '../db/schema';
import { AppError } from '../lib/app-error';
import type { AccessTokenPayload } from '../lib/jwt';

// ─── vendors ──────────────────────────────────────────────────────────────────

export async function getVendors() {
  const rows = await db.select().from(vendors).orderBy(vendors.companyName);
  if (rows.length === 0) return [];

  const vendorIds = rows.map((v) => v.id);
  const [pgLinks, branchLinks] = await Promise.all([
    db
      .select({ vendorId: vendorProductGroups.vendorId, productGroupId: vendorProductGroups.productGroupId })
      .from(vendorProductGroups)
      .where(inArray(vendorProductGroups.vendorId, vendorIds)),
    db
      .select({ vendorId: vendorBranches.vendorId, subCompanyId: vendorBranches.subCompanyId })
      .from(vendorBranches)
      .where(inArray(vendorBranches.vendorId, vendorIds)),
  ]);

  const pgMap = new Map<string, string[]>();
  for (const l of pgLinks) {
    const list = pgMap.get(l.vendorId) ?? [];
    list.push(l.productGroupId);
    pgMap.set(l.vendorId, list);
  }

  const branchMap = new Map<string, string[]>();
  for (const l of branchLinks) {
    const list = branchMap.get(l.vendorId) ?? [];
    list.push(l.subCompanyId);
    branchMap.set(l.vendorId, list);
  }

  return rows.map((v) => ({
    ...v,
    productGroupIds: pgMap.get(v.id) ?? [],
    branchIds:       branchMap.get(v.id) ?? [],
  }));
}

export async function getVendorById(id: string) {
  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
  if (!vendor) throw new AppError('Vendor not found', 404);

  const [pgLinks, branchLinks] = await Promise.all([
    db
      .select({
        productGroupId: vendorProductGroups.productGroupId,
        name:           productGroups.name,
        type:           productGroups.type,
      })
      .from(vendorProductGroups)
      .innerJoin(productGroups, eq(vendorProductGroups.productGroupId, productGroups.id))
      .where(eq(vendorProductGroups.vendorId, id)),
    db
      .select({ subCompanyId: vendorBranches.subCompanyId })
      .from(vendorBranches)
      .where(eq(vendorBranches.vendorId, id)),
  ]);

  return { ...vendor, productGroups: pgLinks, branchIds: branchLinks.map((b) => b.subCompanyId) };
}

export interface CreateVendorInput {
  companyName:         string;
  vendorType?:         'manufacturer' | 'distributor' | 'wholesaler' | 'trader';
  specialization?:     string;
  gstin?:              string;
  address?:            string;
  city?:               string;
  state?:              string;
  pincode?:            string;
  contactName:         string;
  contactPhone?:       string;
  contactEmail?:       string;
  contactDesignation?: string;
}

export async function createVendor(input: CreateVendorInput, caller: AccessTokenPayload) {
  const [created] = await db
    .insert(vendors)
    .values({ ...input, createdByUserId: caller.sub })
    .returning();
  return { ...created, productGroupIds: [], branchIds: [] };
}

export type UpdateVendorInput = Partial<CreateVendorInput>;

export async function updateVendor(id: string, input: UpdateVendorInput) {
  const [existing] = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.id, id)).limit(1);
  if (!existing) throw new AppError('Vendor not found', 404);

  const [updated] = await db
    .update(vendors)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(vendors.id, id))
    .returning();
  return updated;
}

export async function deleteVendor(id: string) {
  const [existing] = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.id, id)).limit(1);
  if (!existing) throw new AppError('Vendor not found', 404);
  await db.delete(vendors).where(eq(vendors.id, id));
}

// ─── product group links ───────────────────────────────────────────────────────

export async function setVendorProductGroups(vendorId: string, productGroupIds: string[]) {
  const [vendor] = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  if (!vendor) throw new AppError('Vendor not found', 404);

  await db.delete(vendorProductGroups).where(eq(vendorProductGroups.vendorId, vendorId));

  if (productGroupIds.length > 0) {
    await db.insert(vendorProductGroups).values(
      productGroupIds.map((pgId) => ({ vendorId, productGroupId: pgId }))
    );
  }

  return db
    .select({ productGroupId: vendorProductGroups.productGroupId })
    .from(vendorProductGroups)
    .where(eq(vendorProductGroups.vendorId, vendorId));
}

// ─── branch links ─────────────────────────────────────────────────────────────

export async function setVendorBranches(vendorId: string, subCompanyIds: string[]) {
  const [vendor] = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  if (!vendor) throw new AppError('Vendor not found', 404);

  await db.delete(vendorBranches).where(eq(vendorBranches.vendorId, vendorId));

  if (subCompanyIds.length > 0) {
    await db.insert(vendorBranches).values(
      subCompanyIds.map((subCompanyId) => ({ vendorId, subCompanyId }))
    );
  }

  const rows = await db
    .select({ subCompanyId: vendorBranches.subCompanyId })
    .from(vendorBranches)
    .where(eq(vendorBranches.vendorId, vendorId));

  return rows.map((r) => r.subCompanyId);
}
