/**
 * Authentication Routes
 * Handles user registration, login, logout, and session management
 */

import { Router, type Request, type Response } from 'express';
import {
  registerSchema,
  loginSchema,
  resetPasswordSchema,
  createUser,
  login,
  validateSession,
  invalidateSession,
  getSessionIdFromHeaders,
  createEmailVerificationToken,
  verifyEmail,
  createPasswordResetToken,
  resetPassword,
  getUserById,
  updateUser,
  googleAuth,
  type UserResponse,
  type SessionInfo,
} from '../services/auth';

const router = Router();

// Cookie options for session
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  path: '/',
};

/**
 * POST /api/auth/register
 * Create a new user account
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);

    const user = await createUser({
      email: data.email,
      password: data.password,
      name: data.name,
    });

    // Auto-login after registration
    const { session } = await login(
      data.email,
      data.password,
      req.headers['user-agent'],
      req.ip
    );

    if (!session) {
      return res.status(500).json({ error: 'Failed to create session' });
    }

    // Create email verification token
    const verifyToken = await createEmailVerificationToken(user.id);
    console.log(`[Auth] Verification token for ${user.email}: ${verifyToken}`);

    // Set session cookie
    res.cookie('session', session.id, SESSION_COOKIE_OPTIONS);

    res.json({
      success: true,
      user: session.user,
      sessionId: session.id,
      message: 'Account created successfully. Please verify your email.',
    });
  } catch (err: any) {
    console.error('[Auth] Registration error:', err);

    if (err.message === 'Email already registered') {
      return res.status(409).json({ error: 'Email already registered' });
    }

    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.errors[0]?.message || 'Invalid input' });
    }

    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and create session
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);

    const result = await login(
      data.email,
      data.password,
      req.headers['user-agent'],
      req.ip
    );

    if (!result.success || !result.session) {
      return res.status(401).json({ error: result.error || 'Invalid credentials' });
    }

    // Set session cookie
    res.cookie('session', result.session.id, SESSION_COOKIE_OPTIONS);

    res.json({
      success: true,
      user: result.session.user,
      sessionId: result.session.id,
    });
  } catch (err: any) {
    console.error('[Auth] Login error:', err);

    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.errors[0]?.message || 'Invalid input' });
    }

    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/logout
 * Invalidate session and clear cookie
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionIdFromHeaders(req.headers as Record<string, string | string[] | undefined>);

    if (sessionId) {
      await invalidateSession(sessionId);
    }

    res.clearCookie('session', { path: '/' });
    res.json({ success: true });
  } catch (err) {
    console.error('[Auth] Logout error:', err);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionIdFromHeaders(req.headers as Record<string, string | string[] | undefined>);

    if (!sessionId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const session = await validateSession(sessionId);

    if (!session) {
      res.clearCookie('session', { path: '/' });
      return res.status(401).json({ error: 'Session expired' });
    }

    res.json({
      user: session.user,
      expiresAt: session.expiresAt,
    });
  } catch (err) {
    console.error('[Auth] Get user error:', err);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

/**
 * PUT /api/auth/me
 * Update current user profile
 */
router.put('/me', async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionIdFromHeaders(req.headers as Record<string, string | string[] | undefined>);

    if (!sessionId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const session = await validateSession(sessionId);

    if (!session) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const allowedUpdates = ['name', 'preferredCurrency', 'homeAirport', 'emailNotifications'];
    const updates: Record<string, any> = {};

    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const updatedUser = await updateUser(session.user.id, updates);

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: updatedUser });
  } catch (err) {
    console.error('[Auth] Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * POST /api/auth/verify-email
 * Verify email with token
 */
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    const success = await verifyEmail(token);

    if (!success) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (err) {
    console.error('[Auth] Verify email error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const token = await createPasswordResetToken(email);

    // Always return success to prevent email enumeration
    if (token) {
      // In production, send email here
      console.log(`[Auth] Password reset token for ${email}: ${token}`);
    }

    res.json({
      success: true,
      message: 'If an account exists with this email, you will receive reset instructions.'
    });
  } catch (err) {
    console.error('[Auth] Forgot password error:', err);
    res.status(500).json({ error: 'Request failed' });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const data = resetPasswordSchema.parse(req.body);

    const success = await resetPassword(data.token, data.password);

    if (!success) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err: any) {
    console.error('[Auth] Reset password error:', err);

    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.errors[0]?.message || 'Invalid input' });
    }

    res.status(500).json({ error: 'Reset failed' });
  }
});

/**
 * POST /api/auth/google
 * Google OAuth callback
 */
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { googleId, email, name, avatar } = req.body;

    if (!googleId || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await googleAuth(
      googleId,
      email,
      name,
      avatar,
      req.headers['user-agent'],
      req.ip
    );

    if (!result.success || !result.session) {
      return res.status(500).json({ error: 'Google auth failed' });
    }

    res.cookie('session', result.session.id, SESSION_COOKIE_OPTIONS);

    res.json({
      success: true,
      user: result.session.user,
      sessionId: result.session.id,
    });
  } catch (err) {
    console.error('[Auth] Google auth error:', err);
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

export default router;
