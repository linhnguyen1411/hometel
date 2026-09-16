import { Router } from 'express';
import { AuthService } from '../services/authService.js';
import { sendSuccess, sendError } from '../utils/responseHelper.js';
import { authenticate, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { UserRepository } from '../db/repositories/userRepository.js';

export const authRouter = Router();

// POST /api/v1/auth/login
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return sendError(res, 'VALIDATION_ERROR', 'Email and password are required', 400);
    }

    const result = await AuthService.login(email, password);
    return sendSuccess(res, result);
  } catch (error: any) {
    if (error.message === 'INVALID_CREDENTIALS') {
      return sendError(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }
    if (error.message === 'ACCOUNT_INACTIVE') {
      return sendError(res, 'ACCOUNT_INACTIVE', 'Account is suspended or inactive', 403);
    }
    return sendError(res, 'INTERNAL_ERROR', error.message || 'Login failed', 500);
  }
});

// POST /api/v1/auth/register
authRouter.post('/register', async (req, res) => {
  try {
    const { email, password, fullName, phone } = req.body;
    if (!email || !password || !fullName) {
      return sendError(res, 'VALIDATION_ERROR', 'Email, password, and fullName are required', 400);
    }
    if (password.length < 6) {
      return sendError(res, 'VALIDATION_ERROR', 'Password must be at least 6 characters', 400);
    }

    const result = await AuthService.registerTenant({ email, password, fullName, phone });
    return sendSuccess(res, result, 201);
  } catch (error: any) {
    if (error.message === 'EMAIL_EXISTS') {
      return sendError(res, 'EMAIL_EXISTS', 'Email address is already registered', 409);
    }
    return sendError(res, 'INTERNAL_ERROR', error.message || 'Registration failed', 500);
  }
});

// POST /api/v1/auth/refresh
authRouter.post('/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return sendError(res, 'VALIDATION_ERROR', 'Refresh token is required', 400);
    }

    const result = AuthService.refreshAccessToken(refreshToken);
    return sendSuccess(res, result);
  } catch (error: any) {
    return sendError(res, 'REFRESH_FAILED', error.message || 'Unable to refresh token', 401);
  }
});

// POST /api/v1/auth/logout
authRouter.post('/logout', (req, res) => {
  const { refreshToken } = req.body;
  AuthService.logout(refreshToken);
  return sendSuccess(res, { message: 'Logged out successfully' });
});

// GET /api/v1/auth/me
authRouter.get('/me', authenticate, (req: AuthenticatedRequest, res) => {
  const user = UserRepository.findById(req.user!.userId);
  if (!user) {
    return sendError(res, 'USER_NOT_FOUND', 'User profile not found', 404);
  }

  const { password_hash, ...safeUser } = user;
  return sendSuccess(res, {
    ...safeUser,
    memberships: req.user!.memberships
  });
});
