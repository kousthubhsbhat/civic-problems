import { Request, Response } from 'express';
import { dataAccess } from '../services/dataAccess';
import { hashPassword, comparePassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { registerSchema, loginSchema } from '../validators/authValidators';
import { AuthenticatedRequest, UserRole } from '../types';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = registerSchema.parse(req.body);

    const existingUser = await dataAccess.findUserByEmail(validated.email);

    if (existingUser) {
      res.status(409).json({
        success: false,
        error: 'A user with this email address already exists.'
      });
      return;
    }

    const passwordHash = await hashPassword(validated.password);

    const newUser = await dataAccess.createUser({
      name: validated.name.trim(),
      email: validated.email.toLowerCase(),
      passwordHash,
      role: (validated.role as any) || 'Citizen',
      departmentId: validated.departmentId || null
    });

    const token = signToken({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role as UserRole,
      departmentId: newUser.departmentId
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      token,
      user: newUser
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: err.errors
      });
      return;
    }
    res.status(500).json({ success: false, error: err.message || 'Internal registration error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = loginSchema.parse(req.body);

    const user = await dataAccess.findUserByEmail(validated.email);

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
      return;
    }

    const isValid = await comparePassword(validated.password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
      return;
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      departmentId: user.departmentId
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId,
        department: user.department ? { departmentName: user.department.departmentName } : null,
        createdAt: user.createdAt
      }
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: err.errors
      });
      return;
    }
    res.status(500).json({ success: false, error: err.message || 'Internal login error' });
  }
};

export const logout = (req: Request, res: Response): void => {
  res.clearCookie('token');
  res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
};

export const getMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized.' });
      return;
    }

    const user = await dataAccess.findUserById(req.user.id);

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};
