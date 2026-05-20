import { eq, inArray } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '../db/connection';
import { users, subCompanyUsers } from '../db/schema';
import { AppError } from '../lib/app-error';
import type { AccessTokenPayload } from '../lib/jwt';

export { AppError };

// columns returned in list/detail responses — password never included
const userColumns = {
  id:          users.id,
  name:        users.name,
  email:       users.email,
  phoneNumber: users.phoneNumber,
  role:        users.role,
  isActive:    users.isActive,
  createdAt:   users.createdAt,
  updatedAt:   users.updatedAt,
};

// ─── helpers ──────────────────────────────────────────────────────────────────

async function assertUserExists(id: string) {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  if (!user) throw new AppError('User not found', 404);
  return user;
}

async function userIdsForAdmin(subCompanyIds: string[]): Promise<string[]> {
  if (subCompanyIds.length === 0) return [];
  const rows = await db
    .select({ userId: subCompanyUsers.userId })
    .from(subCompanyUsers)
    .where(inArray(subCompanyUsers.subCompanyId, subCompanyIds));
  return [...new Set(rows.map((r) => r.userId))];
}

// ─── list ─────────────────────────────────────────────────────────────────────

export async function getUsers(caller: AccessTokenPayload) {
  let userRows;
  if (caller.role === 'owner') {
    userRows = await db.select(userColumns).from(users);
  } else {
    const ids = await userIdsForAdmin(caller.subCompanyIds);
    if (ids.length === 0) return [];
    userRows = await db.select(userColumns).from(users).where(inArray(users.id, ids));
  }

  if (userRows.length === 0) return [];

  const userIds = userRows.map((u) => u.id);
  const memberships = await db
    .select({ userId: subCompanyUsers.userId, subCompanyId: subCompanyUsers.subCompanyId })
    .from(subCompanyUsers)
    .where(inArray(subCompanyUsers.userId, userIds));

  const membershipMap = new Map<string, string[]>();
  for (const m of memberships) {
    const list = membershipMap.get(m.userId) ?? [];
    list.push(m.subCompanyId);
    membershipMap.set(m.userId, list);
  }

  return userRows.map((u) => ({ ...u, subCompanyIds: membershipMap.get(u.id) ?? [] }));
}

// ─── single ───────────────────────────────────────────────────────────────────

export async function getUserById(id: string, caller: AccessTokenPayload) {
  if (caller.role !== 'owner') {
    const ids = await userIdsForAdmin(caller.subCompanyIds);
    if (!ids.includes(id)) throw new AppError('User not found', 404);
  }

  const [user] = await db.select(userColumns).from(users).where(eq(users.id, id)).limit(1);
  if (!user) throw new AppError('User not found', 404);

  const memberships = await db
    .select({ subCompanyId: subCompanyUsers.subCompanyId, isPrimary: subCompanyUsers.isPrimary })
    .from(subCompanyUsers)
    .where(eq(subCompanyUsers.userId, id));

  return { ...user, subCompanies: memberships };
}

// ─── create ───────────────────────────────────────────────────────────────────

export interface CreateUserInput {
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: 'owner' | 'admin' | 'floor_manager' | 'member';
}

const ADMIN_ALLOWED_ROLES = ['floor_manager', 'member'] as const;

export async function createUser(input: CreateUserInput, caller: AccessTokenPayload) {
  if (caller.role !== 'owner' && !ADMIN_ALLOWED_ROLES.includes(input.role as any)) {
    throw new AppError('Admins can only create floor_manager or member accounts', 403);
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const [created] = await db
    .insert(users)
    .values({
      name:        input.name,
      email:       input.email.toLowerCase(),
      phoneNumber: input.phoneNumber,
      password:    passwordHash,
      role:        input.role,
    })
    .returning(userColumns);

  return created;
}

// ─── update ───────────────────────────────────────────────────────────────────

export interface UpdateUserInput {
  name?:        string;
  email?:       string;
  phoneNumber?: string;
  role?:        'owner' | 'admin' | 'floor_manager' | 'member';
  isActive?:    boolean;
}

export async function updateUser(id: string, input: UpdateUserInput, caller: AccessTokenPayload) {
  if (caller.role !== 'owner') {
    const ids = await userIdsForAdmin(caller.subCompanyIds);
    if (!ids.includes(id)) throw new AppError('User not found', 404);
    if (input.role) throw new AppError('Admins cannot change user roles', 403);
  }

  await assertUserExists(id);

  const [updated] = await db
    .update(users)
    .set({ ...input, email: input.email?.toLowerCase(), updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning(userColumns);

  return updated;
}

// ─── delete ───────────────────────────────────────────────────────────────────

export async function deleteUser(id: string) {
  await assertUserExists(id);
  await db.delete(users).where(eq(users.id, id));
}
