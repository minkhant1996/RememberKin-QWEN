import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface TokenPayload {
  id: string;
  email: string;
  familyId?: string;
}

export function signToken(payload: TokenPayload): string {
  // Cast required: @types/jsonwebtoken@9 wants StringValue from ms, plain string works at runtime
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as jwt.SignOptions);
}
