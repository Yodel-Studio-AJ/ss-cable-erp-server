import jwt from 'jsonwebtoken';

export interface AccessTokenPayload {
  sub: string;
  role: string;
  subCompanyIds: string[];
}

export interface RefreshTokenPayload {
  sub: string;
  tokenType: 'refresh';
}

// backward-compat alias
export type JwtPayload = AccessTokenPayload;

const secret = process.env.JWT_SECRET!;
const accessExpiresIn = (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as jwt.SignOptions['expiresIn'];
const refreshExpiresIn = (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'];

export function signToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, secret, { expiresIn: accessExpiresIn });
}

export function signRefreshToken(sub: string): string {
  const payload: RefreshTokenPayload = { sub, tokenType: 'refresh' };
  return jwt.sign(payload, secret, { expiresIn: refreshExpiresIn });
}

export function verifyToken(token: string): AccessTokenPayload {
  return jwt.verify(token, secret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, secret) as RefreshTokenPayload;
  if (payload.tokenType !== 'refresh') throw new Error('Not a refresh token');
  return payload;
}
