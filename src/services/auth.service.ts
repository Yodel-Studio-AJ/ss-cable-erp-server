import { eq, or, count } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '../db/connection';
import { users, subCompanyUsers } from '../db/schema';
import { signToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt';

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// ─── shared helpers ───────────────────────────────────────────────────────────

async function getSubCompanyIds(userId: string): Promise<string[]> {
  const memberships = await db
    .select({ subCompanyId: subCompanyUsers.subCompanyId })
    .from(subCompanyUsers)
    .where(eq(subCompanyUsers.userId, userId));
  return memberships.map((m) => m.subCompanyId);
}

function buildTokenPair(user: { id: string; role: string }, subCompanyIds: string[]) {
  const accessToken = signToken({ sub: user.id, role: user.role, subCompanyIds });
  const refreshToken = signRefreshToken(user.id);
  return { accessToken, refreshToken };
}

// ─── login ────────────────────────────────────────────────────────────────────

export interface LoginInput {
  identifier: string;
  password: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string;
    role: string;
    subCompanyIds: string[];
  };
}

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const [user] = await db
    .select()
    .from(users)
    .where(
      or(
        eq(users.email, input.identifier.toLowerCase()),
        eq(users.phoneNumber, input.identifier),
      ),
    )
    .limit(1);

  if (!user) throw new AuthError('Invalid credentials', 401);
  if (!user.isActive) throw new AuthError('Account is deactivated', 403);

  const passwordMatch = await bcrypt.compare(input.password, user.password);
  if (!passwordMatch) throw new AuthError('Invalid credentials', 401);

  const subCompanyIds = await getSubCompanyIds(user.id);
  const tokens = buildTokenPair(user, subCompanyIds);

  return {
    ...tokens,
    user: { id: user.id, name: user.name, email: user.email, phoneNumber: user.phoneNumber, role: user.role, subCompanyIds },
  };
}

// ─── register (bootstrap — first owner only) ──────────────────────────────────

export interface RegisterInput {
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
}

export async function registerOwner(input: RegisterInput): Promise<AuthResult> {
  const [{ total }] = await db.select({ total: count() }).from(users);
  if (Number(total) > 0) throw new AuthError('Registration is closed. Use the owner account to add users.', 403);

  const passwordHash = await bcrypt.hash(input.password, 12);

  const [newUser] = await db
    .insert(users)
    .values({
      name: input.name,
      email: input.email.toLowerCase(),
      phoneNumber: input.phoneNumber,
      password: passwordHash,
      role: 'owner',
    })
    .returning();

  const tokens = buildTokenPair(newUser, []);

  return {
    ...tokens,
    user: { id: newUser.id, name: newUser.name, email: newUser.email, phoneNumber: newUser.phoneNumber, role: newUser.role, subCompanyIds: [] },
  };
}

// ─── refresh ──────────────────────────────────────────────────────────────────

export interface RefreshResult {
  accessToken: string;
}

export async function refreshAccessToken(token: string): Promise<RefreshResult> {
  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AuthError('Invalid or expired refresh token', 401);
  }

  const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
  if (!user) throw new AuthError('User not found', 401);
  if (!user.isActive) throw new AuthError('Account is deactivated', 403);

  const subCompanyIds = await getSubCompanyIds(user.id);
  const accessToken = signToken({ sub: user.id, role: user.role, subCompanyIds });

  return { accessToken };
}

// ─── me ───────────────────────────────────────────────────────────────────────

export interface MeResult {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: string;
  isActive: boolean;
  subCompanyIds: string[];
  createdAt: Date;
}

export async function getMe(userId: string): Promise<MeResult> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AuthError('User not found', 404);

  const subCompanyIds = await getSubCompanyIds(userId);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role,
    isActive: user.isActive,
    subCompanyIds,
    createdAt: user.createdAt,
  };
}

// ─── change password ──────────────────────────────────────────────────────────

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export async function changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AuthError('User not found', 404);

  const passwordMatch = await bcrypt.compare(input.currentPassword, user.password);
  if (!passwordMatch) throw new AuthError('Current password is incorrect', 401);

  if (input.newPassword.length < 8) throw new AuthError('New password must be at least 8 characters', 400);

  const newHash = await bcrypt.hash(input.newPassword, 12);
  await db
    .update(users)
    .set({ password: newHash, updatedAt: new Date() })
    .where(eq(users.id, userId));
}
