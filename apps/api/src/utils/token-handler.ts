import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

export const getUserIdFromRequest = (req: Request): string => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    throw new Error('No token provided');
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key-here',
    ) as { sub: string };
    return decoded.sub;
  } catch (error) {
    console.error('Error verifying token:', error);
    throw new Error('Invalid token');
  }
};

export const getUserRoleFromRequest = (req: Request): string => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    throw new Error('No token provided');
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key-here',
    ) as { role: string };
    return decoded.role;
  } catch (error) {
    console.error('Error verifying token:', error);
    throw new Error('Invalid token');
  }
};
