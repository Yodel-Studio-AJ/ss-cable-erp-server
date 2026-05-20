import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/connection';
import { subCompanies, subCompanyUsers, users } from '../db/schema';
import { AppError } from '../lib/app-error';
import type { AccessTokenPayload } from '../lib/jwt';

// ─── helpers ──────────────────────────────────────────────────────────────────

async function assertSubCompanyExists(id: string) {
  const [sc] = await db.select({ id: subCompanies.id }).from(subCompanies).where(eq(subCompanies.id, id)).limit(1);
  if (!sc) throw new AppError('Sub-company not found', 404);
}

function assertOwnerOrMember(caller: AccessTokenPayload, subCompanyId: string) {
  if (caller.role !== 'owner' && !caller.subCompanyIds.includes(subCompanyId)) {
    throw new AppError('Sub-company not found', 404);
  }
}

// ─── list ─────────────────────────────────────────────────────────────────────

export async function getSubCompanies(caller: AccessTokenPayload) {
  if (caller.role === 'owner') {
    return db.select().from(subCompanies);
  }
  if (caller.subCompanyIds.length === 0) return [];
  return db.select().from(subCompanies).where(inArray(subCompanies.id, caller.subCompanyIds));
}

// ─── single ───────────────────────────────────────────────────────────────────

export async function getSubCompanyById(id: string, caller: AccessTokenPayload) {
  assertOwnerOrMember(caller, id);
  const [sc] = await db.select().from(subCompanies).where(eq(subCompanies.id, id)).limit(1);
  if (!sc) throw new AppError('Sub-company not found', 404);
  return sc;
}

// ─── create ───────────────────────────────────────────────────────────────────

export interface CreateSubCompanyInput {
  name:     string;
  address?: string;
  city?:    string;
  phone?:   string;
}

export async function createSubCompany(input: CreateSubCompanyInput) {
  const [created] = await db.insert(subCompanies).values(input).returning();
  return created;
}

// ─── update ───────────────────────────────────────────────────────────────────

export type UpdateSubCompanyInput = Partial<CreateSubCompanyInput>;

export async function updateSubCompany(id: string, input: UpdateSubCompanyInput) {
  await assertSubCompanyExists(id);
  const [updated] = await db
    .update(subCompanies)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(subCompanies.id, id))
    .returning();
  return updated;
}

// ─── delete ───────────────────────────────────────────────────────────────────

export async function deleteSubCompany(id: string) {
  await assertSubCompanyExists(id);
  await db.delete(subCompanies).where(eq(subCompanies.id, id));
}

// ─── sub-company users (memberships) ──────────────────────────────────────────

export async function getSubCompanyUsers(subCompanyId: string) {
  await assertSubCompanyExists(subCompanyId);

  const rows = await db
    .select({
      userId:      subCompanyUsers.userId,
      isPrimary:   subCompanyUsers.isPrimary,
      joinedAt:    subCompanyUsers.createdAt,
      name:        users.name,
      email:       users.email,
      phoneNumber: users.phoneNumber,
      role:        users.role,
      isActive:    users.isActive,
    })
    .from(subCompanyUsers)
    .innerJoin(users, eq(subCompanyUsers.userId, users.id))
    .where(eq(subCompanyUsers.subCompanyId, subCompanyId));

  return rows;
}

export interface AddUserToSubCompanyInput {
  userId:    string;
  isPrimary: boolean;
}

export async function addUserToSubCompany(subCompanyId: string, input: AddUserToSubCompanyInput) {
  await assertSubCompanyExists(subCompanyId);

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1);
  if (!user) throw new AppError('User not found', 404);

  const [existing] = await db
    .select()
    .from(subCompanyUsers)
    .where(eq(subCompanyUsers.userId, input.userId))
    .limit(1);
  if (existing) throw new AppError('User is already a member of this sub-company', 409);

  const [created] = await db
    .insert(subCompanyUsers)
    .values({ subCompanyId, userId: input.userId, isPrimary: input.isPrimary })
    .returning();

  return created;
}

export async function updateSubCompanyMembership(
  subCompanyId: string,
  userId: string,
  isPrimary: boolean,
) {
  const [membership] = await db
    .select()
    .from(subCompanyUsers)
    .where(eq(subCompanyUsers.userId, userId))
    .limit(1);

  if (!membership || membership.subCompanyId !== subCompanyId) {
    throw new AppError('Membership not found', 404);
  }

  const [updated] = await db
    .update(subCompanyUsers)
    .set({ isPrimary })
    .where(eq(subCompanyUsers.userId, userId))
    .returning();

  return updated;
}

export async function removeUserFromSubCompany(subCompanyId: string, userId: string) {
  const [membership] = await db
    .select()
    .from(subCompanyUsers)
    .where(eq(subCompanyUsers.userId, userId))
    .limit(1);

  if (!membership || membership.subCompanyId !== subCompanyId) {
    throw new AppError('Membership not found', 404);
  }

  await db
    .delete(subCompanyUsers)
    .where(eq(subCompanyUsers.userId, userId));
}
