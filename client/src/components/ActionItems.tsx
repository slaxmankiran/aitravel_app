import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, ExternalLink, Clock, DollarSign, ChevronDown, ChevronUp, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ActionItem } from "@shared/schema";

interface Props {
  items: ActionItem[];
  onToggleComplete?: (id: string, completed: boolean) => void;
}

export function ActionItemsChecklist({ items, onToggleComplete }: Props) {
  const [localItems, setLocalItems] = useState<ActionItem[]>(items);
  const [isExpanded, setIsExpanded] = useState(true);

  const completedCount = localItems.filter(item => item.completed).length;
  const progress = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  const handleToggle = (id: string) => {
    setLocalItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
    const item = localItems.find(i => i.id === id);
    if (item && onToggleComplete) {
      onToggleComplete(id, !item.completed);
    }
  };

  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return 'border-l-red-500 bg-red-50/30';
      case 'medium': return 'border-l-amber-500 bg-amber-50/30';
      case 'low': return 'border-l-slate-400 bg-slate-50/30';
    }
  };

  const getPriorityBadge = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-amber-100 text-amber-700';
      case 'low': return 'bg-slate-100 text-slate-600';
    }
  };

  // Sort items: incomplete first, then by priority
  const sortedItems = [...localItems].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="shadow-lg overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Action Items</CardTitle>
                <p className="text-sm text-slate-500">
                  {completedCount} of {items.length} completed
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mt-3">
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, delay: 0.2 }}
              />
            </div>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="pt-0">
            <div className="space-y-3">
              {sortedItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`border-l-4 rounded-lg p-4 transition-all duration-200 ${
                    item.completed
                      ? 'border-l-emerald-500 bg-emerald-50/50 opacity-60'
                      : getPriorityColor(item.priority)
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox with animation */}
                    <motion.button
                      onClick={() => handleToggle(item.id)}
                      className="mt-0.5 shrink-0 relative"
                      whileTap={{ scale: 0.9 }}
                    >
                      <motion.div
                        initial={false}
                        animate={item.completed ? {
                          scale: [1, 1.3, 1],
                          transition: { duration: 0.3 }
                        } : {}}
                      >
                        {item.completed ? (
                          <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          >
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          </motion.div>
                        ) : (
                          <Circle className="w-5 h-5 text-slate-400 hover:text-indigo-500 transition-colors" />
                        )}
                      </motion.div>
                      {/* Celebration particles when completing */}
                      {item.completed && (
                        <>
                          <motion.div
                            className="absolute inset-0 pointer-events-none"
                            initial={{ opacity: 1 }}
                            animate={{ opacity: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                          >
                            {[...Array(6)].map((_, i) => (
                              <motion.div
                                key={i}
                                className="absolute w-1.5 h-1.5 rounded-full bg-emerald-400"
                                style={{ left: '50%', top: '50%' }}
                                initial={{ scale: 0, x: 0, y: 0 }}
                                animate={{
                                  scale: [0, 1, 0],
                                  x: Math.cos(i * 60 * Math.PI / 180) * 15,
                                  y: Math.sin(i * 60 * Math.PI / 180) * 15,
                                }}
                                transition={{ duration: 0.4, delay: i * 0.02 }}
                              />
                            ))}
                          </motion.div>
                        </>
                      )}
                    </motion.button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={`font-medium ${item.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                          {item.title}
                        </h4>
                        {!item.completed && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPriorityBadge(item.priority)}`}>
                            {item.priority}
                          </span>
                        )}
                      </div>

                      <p className={`text-sm mt-1 ${item.completed ? 'text-slate-400' : 'text-slate-600'}`}>
                        {item.description}
                      </p>

                      {/* Meta info */}
                      {!item.completed && (item.dueInfo || item.estimatedCost) && (
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                          {item.dueInfo && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {item.dueInfo}
                            </span>
                          )}
                          {item.estimatedCost && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              {item.estimatedCost}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Affiliate Link */}
                      {!item.completed && item.affiliateLink && (
                        <div className="mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                            className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                          >
                            <a href={item.affiliateLink} target="_blank" rel="noopener noreferrer">
                              {item.affiliateLabel || 'Get Started'}
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* All Done Message */}
            {completedCount === items.length && items.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center"
              >
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="font-medium text-emerald-700">All tasks completed!</p>
                <p className="text-sm text-emerald-600">You're ready for your trip.</p>
              </motion.div>
            )}
          </CardContent>
        )}
      </Card>
    </motion.div>
  );
}
