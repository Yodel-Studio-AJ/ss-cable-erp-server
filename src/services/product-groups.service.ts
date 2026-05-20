import { eq } from 'drizzle-orm';
import { db } from '../db/connection';
import { productGroups } from '../db/schema';
import { AppError } from '../lib/app-error';

// ─── types ────────────────────────────────────────────────────────────────────

export type ProductGroupType = 'raw_material' | 'intermediate' | 'finished_goods' | 'processed_product';
export type MaterialType     = 'metal' | 'pvc' | 'mixed';

export interface CreateProductGroupInput {
  name:         string;
  type:         ProductGroupType;
  isProcured:   boolean;
  materialType: MaterialType;
}

export type UpdateProductGroupInput = Partial<CreateProductGroupInput>;

// ─── helpers ──────────────────────────────────────────────────────────────────

async function assertExists(id: string) {
  const [pg] = await db.select({ id: productGroups.id }).from(productGroups).where(eq(productGroups.id, id)).limit(1);
  if (!pg) throw new AppError('Product group not found', 404);
}

// ─── list ─────────────────────────────────────────────────────────────────────

export async function getProductGroups() {
  return db.select().from(productGroups);
}

// ─── single ───────────────────────────────────────────────────────────────────

export async function getProductGroupById(id: string) {
  const [pg] = await db.select().from(productGroups).where(eq(productGroups.id, id)).limit(1);
  if (!pg) throw new AppError('Product group not found', 404);
  return pg;
}

// ─── create ───────────────────────────────────────────────────────────────────

export async function createProductGroup(input: CreateProductGroupInput) {
  const [created] = await db.insert(productGroups).values(input).returning();
  return created;
}

// ─── update ───────────────────────────────────────────────────────────────────

export async function updateProductGroup(id: string, input: UpdateProductGroupInput) {
  await assertExists(id);
  const [updated] = await db
    .update(productGroups)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(productGroups.id, id))
    .returning();
  return updated;
}

// ─── delete ───────────────────────────────────────────────────────────────────

export async function deleteProductGroup(id: string) {
  await assertExists(id);
  await db.delete(productGroups).where(eq(productGroups.id, id));
}
