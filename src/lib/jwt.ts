import jwt from 'jsonwebtoken';

export interface JwtPayload {
  sub: string;         // user id
  role: string;
  subCompanyIds: string[];
}

const secret = process.env.JWT_SECRET!;
const expiresIn = (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'];

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, secret, { expiresIn });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, secret) as JwtPayload;
}
