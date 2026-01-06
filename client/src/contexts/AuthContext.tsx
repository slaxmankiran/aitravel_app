/**
 * Authentication Context
 * Manages user authentication state across the application
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: number;
  email: string;
  name: string | null;
  avatar: string | null;
  subscriptionTier: string;
  emailVerified: boolean;
  preferredCurrency: string;
  homeAirport: string | null;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<boolean>;
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  authModalView: 'login' | 'register' | 'forgot-password';
  setAuthModalView: (view: 'login' | 'register' | 'forgot-password') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalView, setAuthModalView] = useState<'login' | 'register' | 'forgot-password'>('login');
  const { toast } = useToast();

  // Check for existing session on mount
  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string): Promise<boolean> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: 'Login failed',
          description: data.error || 'Invalid credentials',
          variant: 'destructive',
        });
        return false;
      }

      setUser(data.user);
      setShowAuthModal(false);
      toast({
        title: 'Welcome back!',
        description: `Logged in as ${data.user.email}`,
      });
      return true;
    } catch (err) {
      console.error('Login error:', err);
      toast({
        title: 'Login failed',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
      return false;
    }
  }

  async function register(email: string, password: string, name?: string): Promise<boolean> {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: 'Registration failed',
          description: data.error || 'Could not create account',
          variant: 'destructive',
        });
        return false;
      }

      setUser(data.user);
      setShowAuthModal(false);
      toast({
        title: 'Account created!',
        description: 'Welcome to VoyageAI. Please check your email to verify your account.',
      });
      return true;
    } catch (err) {
      console.error('Registration error:', err);
      toast({
        title: 'Registration failed',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
      return false;
    }
  }

  async function logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      setUser(null);
      toast({
        title: 'Logged out',
        description: 'You have been logged out successfully.',
      });
    } catch (err) {
      console.error('Logout error:', err);
    }
  }

  async function updateUser(updates: Partial<User>): Promise<boolean> {
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        throw new Error('Failed to update profile');
      }

      const data = await res.json();
      setUser(data.user);
      toast({
        title: 'Profile updated',
        description: 'Your changes have been saved.',
      });
      return true;
    } catch (err) {
      console.error('Update user error:', err);
      toast({
        title: 'Update failed',
        description: 'Could not save your changes.',
        variant: 'destructive',
      });
      return false;
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        updateUser,
        showAuthModal,
        setShowAuthModal,
        authModalView,
        setAuthModalView,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
