import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq, or } from 'drizzle-orm';
import { db } from '../db/connection';
import { users } from '../db/schema/users';
import { subCompanyUsers } from '../db/schema/subCompanyUsers';
import { signToken } from '../lib/jwt';

const router = Router();

const loginSchema = z.object({
  identifier: z.string().min(1), // email or phone number
  password:   z.string().min(1),
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid request body', errors: parsed.error.flatten() });
    return;
  }

  const { identifier, password } = parsed.data;

  const [user] = await db
    .select()
    .from(users)
    .where(
      or(
        eq(users.email, identifier.toLowerCase()),
        eq(users.phoneNumber, identifier),
      ),
    )
    .limit(1);

  if (!user) {
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ message: 'Account is deactivated' });
    return;
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }

  const memberships = await db
    .select({ subCompanyId: subCompanyUsers.subCompanyId })
    .from(subCompanyUsers)
    .where(eq(subCompanyUsers.userId, user.id));

  const subCompanyIds = memberships.map((m) => m.subCompanyId);

  const token = signToken({ sub: user.id, role: user.role, subCompanyIds });

  res.json({
    token,
    user: {
      id:           user.id,
      name:         user.name,
      email:        user.email,
      phoneNumber:  user.phoneNumber,
      role:         user.role,
      subCompanyIds,
    },
  });
});

export default router;
