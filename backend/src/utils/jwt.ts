import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { TokenUserPayload } from '../types';

export const signToken = (payload: TokenUserPayload): string => {
  return jwt.sign(payload, ENV.JWT_SECRET, {
    expiresIn: ENV.JWT_EXPIRES_IN as any
  });
};

export const verifyToken = (token: string): TokenUserPayload => {
  return jwt.verify(token, ENV.JWT_SECRET) as TokenUserPayload;
};
