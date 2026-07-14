import { eq } from 'drizzle-orm';
import { db } from '../db/connection';
import { attributes } from '../db/schema';
import { AppError } from '../lib/app-error';

// ─── types ────────────────────────────────────────────────────────────────────

export type AttributeDataType = 'string' | 'number';

export interface CreateAttributeInput {
  name:      string;
  unit?:     string;
  dataType?: AttributeDataType;
}

export type UpdateAttributeInput = Partial<CreateAttributeInput>;

// ─── list ─────────────────────────────────────────────────────────────────────

export async function getAttributes() {
  return db.select().from(attributes).orderBy(attributes.name);
}

// ─── single ───────────────────────────────────────────────────────────────────

export async function getAttributeById(id: string) {
  const [attr] = await db.select().from(attributes).where(eq(attributes.id, id)).limit(1);
  if (!attr) throw new AppError('Attribute not found', 404);
  return attr;
}

// ─── create ───────────────────────────────────────────────────────────────────

export async function createAttribute(input: CreateAttributeInput) {
  const [created] = await db.insert(attributes).values({
    name:     input.name,
    unit:     input.unit ?? null,
    dataType: input.dataType ?? 'number',
  }).returning();
  return created;
}

// ─── update ───────────────────────────────────────────────────────────────────

export async function updateAttribute(id: string, input: UpdateAttributeInput) {
  const [existing] = await db.select({ id: attributes.id }).from(attributes).where(eq(attributes.id, id)).limit(1);
  if (!existing) throw new AppError('Attribute not found', 404);

  const [updated] = await db
    .update(attributes)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(attributes.id, id))
    .returning();
  return updated;
}

// ─── delete ───────────────────────────────────────────────────────────────────

export async function deleteAttribute(id: string) {
  const [existing] = await db.select({ id: attributes.id }).from(attributes).where(eq(attributes.id, id)).limit(1);
  if (!existing) throw new AppError('Attribute not found', 404);
  await db.delete(attributes).where(eq(attributes.id, id));
}
