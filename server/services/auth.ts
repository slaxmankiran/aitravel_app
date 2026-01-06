/**
 * Authentication Service
 * Handles user registration, login, sessions, and JWT tokens
 */

import { randomBytes, createHash } from 'crypto';
import { z } from 'zod';

// ============================================================================
// CONFIGURATION
// ============================================================================

const AUTH_CONFIG = {
  sessionDuration: 30 * 24 * 60 * 60 * 1000, // 30 days
  passwordMinLength: 8,
  tokenExpiry: 24 * 60 * 60 * 1000, // 24 hours for email verification/reset tokens
};

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(AUTH_CONFIG.passwordMinLength, `Password must be at least ${AUTH_CONFIG.passwordMinLength} characters`),
  name: z.string().min(1, 'Name is required').optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(AUTH_CONFIG.passwordMinLength),
});

// ============================================================================
// PASSWORD HASHING (Simple but secure - no bcrypt dependency)
// ============================================================================

const SALT_LENGTH = 32;
const HASH_ITERATIONS = 10000;

/**
 * Hash a password with a random salt
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const hash = createHash('sha512')
    .update(salt + password)
    .digest('hex');

  // Store as salt:hash
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a stored hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, originalHash] = storedHash.split(':');
  if (!salt || !originalHash) return false;

  const hash = createHash('sha512')
    .update(salt + password)
    .digest('hex');

  return hash === originalHash;
}

// ============================================================================
// TOKEN GENERATION
// ============================================================================

/**
 * Generate a secure random token
 */
export function generateToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Generate a session token (UUID-like)
 */
export function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

// ============================================================================
// IN-MEMORY STORAGE (Replace with database in production)
// ============================================================================

interface StoredUser {
  id: number;
  email: string;
  password: string | null;
  name: string | null;
  avatar: string | null;
  googleId: string | null;
  subscriptionTier: string;
  emailVerified: boolean;
  emailNotifications: boolean;
  preferredCurrency: string;
  homeAirport: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface StoredSession {
  id: string;
  userId: number;
  expiresAt: Date;
  createdAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

interface StoredToken {
  id: number;
  userId: number;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

// In-memory stores
const usersStore = new Map<number, StoredUser>();
const sessionsStore = new Map<string, StoredSession>();
const emailVerificationTokens = new Map<string, StoredToken>();
const passwordResetTokens = new Map<string, StoredToken>();

let userIdCounter = 1;
let tokenIdCounter = 1;

// ============================================================================
// USER OPERATIONS
// ============================================================================

export interface CreateUserInput {
  email: string;
  password?: string;
  name?: string;
  googleId?: string;
}

export interface UserResponse {
  id: number;
  email: string;
  name: string | null;
  avatar: string | null;
  subscriptionTier: string;
  emailVerified: boolean;
  preferredCurrency: string;
  homeAirport: string | null;
  createdAt: Date;
}

/**
 * Create a new user
 */
export async function createUser(input: CreateUserInput): Promise<UserResponse> {
  // Check if email already exists
  const existingUser = Array.from(usersStore.values()).find(u => u.email === input.email);
  if (existingUser) {
    throw new Error('Email already registered');
  }

  const user: StoredUser = {
    id: userIdCounter++,
    email: input.email,
    password: input.password ? hashPassword(input.password) : null,
    name: input.name || null,
    avatar: null,
    googleId: input.googleId || null,
    subscriptionTier: 'free',
    emailVerified: !!input.googleId, // Auto-verify OAuth users
    emailNotifications: true,
    preferredCurrency: 'USD',
    homeAirport: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  usersStore.set(user.id, user);
  console.log(`[Auth] User created: ${user.email} (ID: ${user.id})`);

  return sanitizeUser(user);
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<StoredUser | null> {
  return Array.from(usersStore.values()).find(u => u.email === email) || null;
}

/**
 * Get user by ID
 */
export async function getUserById(id: number): Promise<UserResponse | null> {
  const user = usersStore.get(id);
  return user ? sanitizeUser(user) : null;
}

/**
 * Update user
 */
export async function updateUser(id: number, updates: Partial<StoredUser>): Promise<UserResponse | null> {
  const user = usersStore.get(id);
  if (!user) return null;

  const updatedUser = {
    ...user,
    ...updates,
    updatedAt: new Date(),
  };
  usersStore.set(id, updatedUser);
  return sanitizeUser(updatedUser);
}

/**
 * Remove sensitive data from user object
 */
function sanitizeUser(user: StoredUser): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    subscriptionTier: user.subscriptionTier,
    emailVerified: user.emailVerified,
    preferredCurrency: user.preferredCurrency,
    homeAirport: user.homeAirport,
    createdAt: user.createdAt,
  };
}

// ============================================================================
// SESSION OPERATIONS
// ============================================================================

export interface SessionInfo {
  id: string;
  user: UserResponse;
  expiresAt: Date;
}

/**
 * Create a new session
 */
export async function createSession(
  userId: number,
  userAgent?: string,
  ipAddress?: string
): Promise<SessionInfo> {
  const user = usersStore.get(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + AUTH_CONFIG.sessionDuration);

  const session: StoredSession = {
    id: sessionId,
    userId,
    expiresAt,
    createdAt: new Date(),
    userAgent,
    ipAddress,
  };

  sessionsStore.set(sessionId, session);
  console.log(`[Auth] Session created for user ${userId}`);

  return {
    id: sessionId,
    user: sanitizeUser(user),
    expiresAt,
  };
}

/**
 * Validate a session and return user info
 */
export async function validateSession(sessionId: string): Promise<SessionInfo | null> {
  const session = sessionsStore.get(sessionId);
  if (!session) return null;

  // Check if expired
  if (session.expiresAt < new Date()) {
    sessionsStore.delete(sessionId);
    return null;
  }

  const user = usersStore.get(session.userId);
  if (!user) {
    sessionsStore.delete(sessionId);
    return null;
  }

  return {
    id: session.id,
    user: sanitizeUser(user),
    expiresAt: session.expiresAt,
  };
}

/**
 * Invalidate a session (logout)
 */
export async function invalidateSession(sessionId: string): Promise<boolean> {
  const deleted = sessionsStore.delete(sessionId);
  if (deleted) {
    console.log(`[Auth] Session invalidated: ${sessionId.substring(0, 8)}...`);
  }
  return deleted;
}

/**
 * Invalidate all sessions for a user
 */
export async function invalidateAllUserSessions(userId: number): Promise<number> {
  let count = 0;
  const entries = Array.from(sessionsStore.entries());
  for (const [id, session] of entries) {
    if (session.userId === userId) {
      sessionsStore.delete(id);
      count++;
    }
  }
  console.log(`[Auth] Invalidated ${count} sessions for user ${userId}`);
  return count;
}

// ============================================================================
// EMAIL VERIFICATION
// ============================================================================

/**
 * Create email verification token
 */
export async function createEmailVerificationToken(userId: number): Promise<string> {
  const token = generateToken();
  const tokenRecord: StoredToken = {
    id: tokenIdCounter++,
    userId,
    token,
    expiresAt: new Date(Date.now() + AUTH_CONFIG.tokenExpiry),
    createdAt: new Date(),
  };

  emailVerificationTokens.set(token, tokenRecord);
  return token;
}

/**
 * Verify email with token
 */
export async function verifyEmail(token: string): Promise<boolean> {
  const tokenRecord = emailVerificationTokens.get(token);
  if (!tokenRecord) return false;

  // Check if expired
  if (tokenRecord.expiresAt < new Date()) {
    emailVerificationTokens.delete(token);
    return false;
  }

  // Update user
  const user = usersStore.get(tokenRecord.userId);
  if (user) {
    user.emailVerified = true;
    user.updatedAt = new Date();
    usersStore.set(user.id, user);
  }

  // Delete token
  emailVerificationTokens.delete(token);
  console.log(`[Auth] Email verified for user ${tokenRecord.userId}`);
  return true;
}

// ============================================================================
// PASSWORD RESET
// ============================================================================

/**
 * Create password reset token
 */
export async function createPasswordResetToken(email: string): Promise<string | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;

  const token = generateToken();
  const tokenRecord: StoredToken = {
    id: tokenIdCounter++,
    userId: user.id,
    token,
    expiresAt: new Date(Date.now() + AUTH_CONFIG.tokenExpiry),
    createdAt: new Date(),
  };

  passwordResetTokens.set(token, tokenRecord);
  return token;
}

/**
 * Reset password with token
 */
export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const tokenRecord = passwordResetTokens.get(token);
  if (!tokenRecord) return false;

  // Check if expired
  if (tokenRecord.expiresAt < new Date()) {
    passwordResetTokens.delete(token);
    return false;
  }

  // Update user password
  const user = usersStore.get(tokenRecord.userId);
  if (user) {
    user.password = hashPassword(newPassword);
    user.updatedAt = new Date();
    usersStore.set(user.id, user);
  }

  // Delete token and invalidate all sessions
  passwordResetTokens.delete(token);
  await invalidateAllUserSessions(tokenRecord.userId);
  console.log(`[Auth] Password reset for user ${tokenRecord.userId}`);
  return true;
}

// ============================================================================
// LOGIN
// ============================================================================

export interface LoginResult {
  success: boolean;
  session?: SessionInfo;
  error?: string;
}

/**
 * Login with email and password
 */
export async function login(
  email: string,
  password: string,
  userAgent?: string,
  ipAddress?: string
): Promise<LoginResult> {
  const user = await getUserByEmail(email);

  if (!user) {
    return { success: false, error: 'Invalid email or password' };
  }

  if (!user.password) {
    return { success: false, error: 'Please use Google sign-in for this account' };
  }

  if (!verifyPassword(password, user.password)) {
    return { success: false, error: 'Invalid email or password' };
  }

  const session = await createSession(user.id, userAgent, ipAddress);
  console.log(`[Auth] User logged in: ${email}`);

  return { success: true, session };
}

// ============================================================================
// OAUTH (Simplified)
// ============================================================================

/**
 * Login or register with Google
 */
export async function googleAuth(
  googleId: string,
  email: string,
  name?: string,
  avatar?: string,
  userAgent?: string,
  ipAddress?: string
): Promise<LoginResult> {
  // Check if user exists with this Google ID
  let user = Array.from(usersStore.values()).find(u => u.googleId === googleId);

  if (!user) {
    // Check if email exists (link accounts)
    user = Array.from(usersStore.values()).find(u => u.email === email);

    if (user) {
      // Link Google to existing account
      user.googleId = googleId;
      user.emailVerified = true;
      if (avatar && !user.avatar) user.avatar = avatar;
      user.updatedAt = new Date();
      usersStore.set(user.id, user);
    } else {
      // Create new user
      const newUser = await createUser({ email, googleId, name });
      user = usersStore.get(newUser.id)!;
      if (avatar) {
        user.avatar = avatar;
        usersStore.set(user.id, user);
      }
    }
  }

  const session = await createSession(user.id, userAgent, ipAddress);
  console.log(`[Auth] Google login: ${email}`);

  return { success: true, session };
}

// ============================================================================
// MIDDLEWARE HELPERS
// ============================================================================

/**
 * Extract session ID from request headers
 */
export function getSessionIdFromHeaders(headers: Record<string, string | string[] | undefined>): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = headers['authorization'] || headers['Authorization'];
  if (authHeader) {
    const token = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    if (token.startsWith('Bearer ')) {
      return token.substring(7);
    }
  }

  // Check cookie
  const cookieHeader = headers['cookie'] || headers['Cookie'];
  if (cookieHeader) {
    const cookies = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
    const match = cookies.match(/session=([^;]+)/);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Get authenticated user from request
 */
export async function getAuthenticatedUser(
  headers: Record<string, string | string[] | undefined>
): Promise<UserResponse | null> {
  const sessionId = getSessionIdFromHeaders(headers);
  if (!sessionId) return null;

  const session = await validateSession(sessionId);
  return session?.user || null;
}
