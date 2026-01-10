import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/UserMenu";
import {
  MessageSquare,
  Map,
  Compass,
  Bookmark,
  Sparkles,
  Plus,
  ChevronLeft,
  ChevronRight,
  Home
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SidebarProps {
  className?: string;
}

const NAV_ITEMS = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/chat", icon: MessageSquare, label: "Chat" },
  { href: "/trips", icon: Map, label: "My Trips" },
  { href: "/explore", icon: Compass, label: "Explore" },
  { href: "/inspiration", icon: Sparkles, label: "Inspiration" },
  { href: "/saved", icon: Bookmark, label: "Saved" },
];

export function Sidebar({ className }: SidebarProps) {
  const [location] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 72 : 240 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "fixed left-0 top-0 h-screen bg-white border-r border-slate-200 flex-col z-40 hidden md:flex",
        className
      )}
    >
      {/* Logo */}
      <div className="p-4 border-b border-slate-100">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-lg font-bold font-display shadow-lg shadow-amber-500/20 flex-shrink-0">
            V
          </div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="font-display font-bold text-xl tracking-tight text-slate-800 overflow-hidden whitespace-nowrap"
              >
                VoyageAI
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* New Trip Button */}
      <div className="p-4">
        <Link href="/chat">
          <Button
            className={cn(
              "w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-semibold shadow-lg shadow-amber-500/20 transition-all",
              isCollapsed ? "px-3" : "px-4"
            )}
          >
            <Plus className="w-5 h-5" />
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="ml-2 overflow-hidden whitespace-nowrap"
                >
                  New Trip
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));

            return (
              <li key={item.href}>
                <Link href={item.href}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all cursor-pointer",
                      isActive
                        ? "bg-amber-50 text-amber-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-amber-600")} />
                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          className="overflow-hidden whitespace-nowrap"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Recent Trips Section */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-3 border-t border-slate-100"
          >
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Recent Trips
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white text-xs">
                  JP
                </div>
                <span className="text-sm text-slate-600 truncate">Tokyo Adventure</span>
              </div>
              <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-400 to-pink-400 flex items-center justify-center text-white text-xs">
                  FR
                </div>
                <span className="text-sm text-slate-600 truncate">Paris Getaway</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Section */}
      <div className={cn(
        "p-4 border-t border-slate-100 flex items-center",
        isCollapsed ? "justify-center" : "justify-between"
      )}>
        <UserMenu />

        {/* Collapse Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
    </motion.aside>
  );
}

// Layout wrapper that includes sidebar
export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <main className="md:ml-[240px] min-h-screen transition-all pt-14 md:pt-0 pb-16 md:pb-0">
        {children}
      </main>
    </div>
  );
}
