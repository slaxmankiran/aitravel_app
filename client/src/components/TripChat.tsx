/**
 * Trip Chat Component
 * AI-powered conversational interface for refining trip itineraries
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  MessageCircle,
  Send,
  Loader2,
  X,
  Bot,
  User,
  Sparkles,
  ChevronUp,
  RefreshCw,
  Check,
  AlertCircle,
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  pendingChanges?: PendingChanges;
}

interface PendingChanges {
  id: string;
  preview: {
    description: string;
    items: string[];
    estimatedCostChange: number;
  };
}

interface TripContext {
  destination: string;
  dates: string;
  budget: number;
  currency: string;
  travelers: number;
}

interface TripChatProps {
  tripId: number;
  destination: string;
  tripContext?: TripContext;
  onTripUpdate?: (updatedData: {
    itinerary?: any;
    budgetBreakdown?: any;
    mapMarkers?: any[];
  }) => void;
}

// Quick suggestion buttons for common refinements
const QUICK_SUGGESTIONS = [
  'Add more food recommendations',
  'Include budget-friendly options',
  'Add cultural experiences',
  'Suggest nightlife spots',
  'Add kid-friendly activities',
  'Include hidden gems',
];

export function TripChat({ tripId, destination, tripContext, onTripUpdate }: TripChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);
  const [activePendingChange, setActivePendingChange] = useState<PendingChanges | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Load conversation history on mount
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      loadConversation();
    }
  }, [isOpen]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  async function loadConversation() {
    try {
      const res = await fetch(`/api/trips/${tripId}/chat`);
      if (res.ok) {
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })));
          setShowSuggestions(false);
        }
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
    }
  }

  async function handleSend(messageText?: string) {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setShowSuggestions(false);
    setIsLoading(true);

    try {
      const res = await fetch(`/api/trips/${tripId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        throw new Error('Failed to get response');
      }

      const data = await res.json();

      // Handle response format
      const responseMessage = typeof data.response === 'object'
        ? data.response.message
        : data.response;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseMessage,
        timestamp: new Date(),
        pendingChanges: data.pendingChanges || undefined,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Update dynamic suggestions from AI response
      if (data.response?.suggestions?.length > 0) {
        setDynamicSuggestions(data.response.suggestions);
      }

      // If there are pending changes, store them for confirmation
      if (data.pendingChanges) {
        setActivePendingChange(data.pendingChanges);
      }
    } catch (err) {
      console.error('Chat error:', err);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });

      // Remove the user message if request failed
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  }

  // Confirm and apply pending changes
  async function handleConfirmChanges() {
    if (!activePendingChange) return;

    setIsConfirming(true);

    try {
      const res = await fetch(`/api/trips/${tripId}/chat/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeId: activePendingChange.id }),
      });

      if (!res.ok) {
        throw new Error('Failed to apply changes');
      }

      const data = await res.json();

      toast({
        title: 'Changes Applied!',
        description: activePendingChange.preview.description,
      });

      // Notify parent to refresh the UI with updated data
      if (data.updatedData) {
        onTripUpdate?.(data.updatedData);
      }

      // Clear pending change
      setActivePendingChange(null);

      // Add confirmation message
      const confirmMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `✅ Done! ${activePendingChange.preview.description}. Your itinerary has been updated.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, confirmMessage]);

    } catch (err) {
      console.error('Confirm error:', err);
      toast({
        title: 'Error',
        description: 'Failed to apply changes. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsConfirming(false);
    }
  }

  // Reject pending changes
  async function handleRejectChanges() {
    if (!activePendingChange) return;

    try {
      await fetch(`/api/trips/${tripId}/chat/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeId: activePendingChange.id }),
      });

      // Add rejection message
      const rejectMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'No problem! I won\'t make those changes. What else can I help you with?',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, rejectMessage]);

    } catch (err) {
      console.error('Reject error:', err);
    }

    setActivePendingChange(null);
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Floating Chat Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-emerald-500 text-white shadow-lg shadow-primary/30 flex items-center justify-center"
          >
            <MessageCircle className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-6rem)] bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Trip Assistant</h3>
                  <p className="text-xs text-slate-400">
                    {tripContext
                      ? `${destination} • ${tripContext.travelers} traveler${tripContext.travelers > 1 ? 's' : ''} • ${tripContext.currency} ${tripContext.budget.toLocaleString()}`
                      : `Refine your ${destination} trip`
                    }
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Welcome message if no messages */}
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <Bot className="w-12 h-12 text-primary mx-auto mb-3" />
                  <h4 className="font-medium text-white mb-2">
                    How can I help with your trip?
                  </h4>
                  <p className="text-sm text-slate-400">
                    Ask me to add activities, change plans, or get recommendations.
                  </p>
                </div>
              )}

              {/* Messages list */}
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-primary text-white rounded-tr-sm'
                        : 'bg-slate-800 text-slate-100 rounded-tl-sm'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className="text-[10px] opacity-60 mt-1">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center">
                      <User className="w-4 h-4 text-slate-300" />
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestions - show initial or dynamic (hide when pending changes exist) */}
            {!isLoading && !activePendingChange && (showSuggestions && messages.length === 0 || dynamicSuggestions.length > 0) && (
              <div className="px-4 pb-2">
                <div className="flex flex-wrap gap-2">
                  {(dynamicSuggestions.length > 0 ? dynamicSuggestions : QUICK_SUGGESTIONS).slice(0, 4).map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setDynamicSuggestions([]); // Clear after use
                        handleSend(suggestion);
                      }}
                      disabled={isLoading}
                      className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full transition-colors border border-slate-700 hover:border-slate-600"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Changes Confirmation Panel - Fixed at bottom */}
            <AnimatePresence>
              {activePendingChange && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="mx-3 mb-2 p-3 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl max-h-40 flex flex-col"
                >
                  {/* Header - always visible */}
                  <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                    <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                      <AlertCircle className="w-3 h-3 text-amber-400" />
                    </div>
                    <h4 className="text-xs font-semibold text-white">
                      {activePendingChange.preview.items.length} change{activePendingChange.preview.items.length > 1 ? 's' : ''} proposed
                    </h4>
                    {activePendingChange.preview.estimatedCostChange > 0 && (
                      <span className="text-xs text-amber-300 ml-auto">
                        +${activePendingChange.preview.estimatedCostChange}
                      </span>
                    )}
                  </div>

                  {/* Scrollable items - only if more than 2 */}
                  {activePendingChange.preview.items.length > 2 && (
                    <div className="overflow-y-auto max-h-16 mb-2 pr-1 scrollbar-thin">
                      {activePendingChange.preview.items.slice(0, 5).map((item, idx) => (
                        <p key={idx} className="text-[10px] text-amber-100/70 truncate">• {item}</p>
                      ))}
                      {activePendingChange.preview.items.length > 5 && (
                        <p className="text-[10px] text-amber-300">...and {activePendingChange.preview.items.length - 5} more</p>
                      )}
                    </div>
                  )}

                  {/* Buttons - always visible */}
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={handleConfirmChanges}
                      disabled={isConfirming}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs h-7 flex-1"
                    >
                      {isConfirming ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-3 h-3 mr-1" />
                          Apply
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleRejectChanges}
                      disabled={isConfirming}
                      className="text-slate-300 hover:text-white hover:bg-slate-700 text-xs h-7"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input */}
            <div className="p-4 border-t border-slate-700 bg-slate-800">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything about your trip..."
                  disabled={isLoading}
                  className="flex-1 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Minimized chat trigger for the trip page
 */
export function TripChatTrigger({
  tripId,
  destination,
  tripContext,
  onTripUpdate,
}: {
  tripId: number;
  destination: string;
  tripContext?: TripContext;
  onTripUpdate?: (updatedData: { itinerary?: any; budgetBreakdown?: any; mapMarkers?: any[] }) => void;
}) {
  return (
    <TripChat
      tripId={tripId}
      destination={destination}
      tripContext={tripContext}
      onTripUpdate={onTripUpdate}
    />
  );
}
