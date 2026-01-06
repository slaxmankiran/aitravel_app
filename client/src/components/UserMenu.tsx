/**
 * User Menu Component
 * Shows user avatar with dropdown for profile/logout or Sign In button
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  User,
  LogOut,
  Settings,
  CreditCard,
  Plane,
  Bell,
  Crown,
  ChevronDown,
} from 'lucide-react';

export function UserMenu() {
  const { user, isAuthenticated, isLoading, logout, setShowAuthModal, setAuthModalView } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleSignIn = () => {
    setAuthModalView('login');
    setShowAuthModal(true);
  };

  const handleSignUp = () => {
    setAuthModalView('register');
    setShowAuthModal(true);
  };

  if (isLoading) {
    return (
      <div className="w-8 h-8 rounded-full bg-slate-700 animate-pulse" />
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignIn}
          className="text-white/80 hover:text-white hover:bg-white/10"
        >
          Sign In
        </Button>
        <Button
          size="sm"
          onClick={handleSignUp}
          className="bg-primary hover:bg-primary/90 text-white"
        >
          Get Started
        </Button>
      </div>
    );
  }

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email.slice(0, 2).toUpperCase();

  const isPro = user?.subscriptionTier === 'pro' || user?.subscriptionTier === 'business';

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-auto p-1 pr-2 hover:bg-white/10 rounded-full flex items-center gap-2"
        >
          {/* Avatar */}
          <div className="relative">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name || 'User'}
                className="w-8 h-8 rounded-full object-cover border-2 border-white/20"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center text-white text-sm font-medium">
                {initials}
              </div>
            )}
            {isPro && (
              <div className="absolute -bottom-0.5 -right-0.5 bg-amber-500 rounded-full p-0.5">
                <Crown className="w-2.5 h-2.5 text-white" />
              </div>
            )}
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-white/60" />
        </Button>
      </DropdownMenuTrigger>

      <AnimatePresence>
        {isOpen && (
          <DropdownMenuContent
            align="end"
            className="w-64 bg-slate-900 border-slate-700 text-white"
            asChild
            forceMount
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none text-white">
                    {user?.name || 'Traveler'}
                  </p>
                  <p className="text-xs leading-none text-slate-400">
                    {user?.email}
                  </p>
                  {isPro && (
                    <div className="flex items-center gap-1 mt-1">
                      <Crown className="w-3 h-3 text-amber-500" />
                      <span className="text-xs text-amber-500 font-medium">
                        {user?.subscriptionTier === 'business' ? 'Business' : 'Pro'} Member
                      </span>
                    </div>
                  )}
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator className="bg-slate-700" />

              <DropdownMenuItem className="text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer">
                <Plane className="mr-2 h-4 w-4" />
                My Trips
              </DropdownMenuItem>

              <DropdownMenuItem className="text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer">
                <Bell className="mr-2 h-4 w-4" />
                Price Alerts
              </DropdownMenuItem>

              <DropdownMenuItem className="text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-slate-700" />

              {!isPro && (
                <DropdownMenuItem className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 cursor-pointer">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Upgrade to Pro
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                onClick={() => logout()}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </motion.div>
          </DropdownMenuContent>
        )}
      </AnimatePresence>
    </DropdownMenu>
  );
}
