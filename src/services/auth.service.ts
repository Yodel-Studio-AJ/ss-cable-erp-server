import { eq, or } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '../db/connection';
import { users, subCompanyUsers } from '../db/schema';
import { signToken } from '../lib/jwt';

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface LoginInput {
  identifier: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string;
    role: string;
    subCompanyIds: string[];
  };
}

export async function loginUser(input: LoginInput): Promise<LoginResult> {
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

  const memberships = await db
    .select({ subCompanyId: subCompanyUsers.subCompanyId })
    .from(subCompanyUsers)
    .where(eq(subCompanyUsers.userId, user.id));

  const subCompanyIds = memberships.map((m) => m.subCompanyId);
  const token = signToken({ sub: user.id, role: user.role, subCompanyIds });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      subCompanyIds,
    },
  };
}
