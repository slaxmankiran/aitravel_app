import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/UserMenu";
import {
  Menu,
  X,
  Home,
  MessageSquare,
  Map,
  Compass,
  Sparkles,
  Bookmark,
  Plus
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/chat", icon: MessageSquare, label: "Plan Trip" },
  { href: "/trips", icon: Map, label: "My Trips" },
  { href: "/explore", icon: Compass, label: "Explore" },
  { href: "/inspiration", icon: Sparkles, label: "Inspiration" },
  { href: "/saved", icon: Bookmark, label: "Saved" },
];

interface MobileNavProps {
  className?: string;
}

export function MobileNav({ className = '' }: MobileNavProps) {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location]);

  // Prevent scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Mobile Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 md:hidden ${className}`}>
        <div className="flex items-center justify-between px-4 h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold font-display shadow-lg">
              V
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-slate-800">VoyageAI</span>
          </Link>

          {/* Menu Button */}
          <button
            onClick={() => setIsOpen(true)}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 z-50 md:hidden"
            />

            {/* Menu Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-[280px] bg-white z-50 md:hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <span className="font-display font-bold text-lg text-slate-800">Menu</span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* New Trip Button */}
              <div className="p-4">
                <Link href="/chat">
                  <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-semibold shadow-lg shadow-amber-500/20">
                    <Plus className="w-5 h-5 mr-2" />
                    Plan New Trip
                  </Button>
                </Link>
              </div>

              {/* Navigation Items */}
              <nav className="flex-1 px-3 py-2 overflow-y-auto">
                <ul className="space-y-1">
                  {NAV_ITEMS.map((item) => {
                    const isActive = location === item.href ||
                      (item.href !== "/" && location.startsWith(item.href));

                    return (
                      <li key={item.href}>
                        <Link href={item.href}>
                          <div
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all cursor-pointer ${
                              isActive
                                ? "bg-amber-50 text-amber-700"
                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            }`}
                          >
                            <item.icon className={`w-5 h-5 ${isActive ? "text-amber-600" : ""}`} />
                            <span>{item.label}</span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              {/* User Section */}
              <div className="p-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <UserMenu />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Navigation Bar (iOS style) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 md:hidden safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-2">
          {NAV_ITEMS.slice(0, 5).map((item) => {
            const isActive = location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));

            return (
              <Link key={item.href} href={item.href}>
                <div className="flex flex-col items-center gap-1 px-3 py-2 cursor-pointer">
                  <item.icon className={`w-5 h-5 ${isActive ? "text-amber-600" : "text-slate-400"}`} />
                  <span className={`text-[10px] font-medium ${isActive ? "text-amber-600" : "text-slate-500"}`}>
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

// Helper component to add proper spacing for mobile nav
export function MobileNavSpacer() {
  return (
    <>
      {/* Top spacer for fixed header */}
      <div className="h-14 md:hidden" />
      {/* Bottom spacer for fixed nav bar */}
      <div className="h-16 md:hidden" />
    </>
  );
}
