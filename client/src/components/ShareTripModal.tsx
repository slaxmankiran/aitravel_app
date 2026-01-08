import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  X,
  Link2,
  Copy,
  Check,
  Mail,
  MessageCircle,
  Twitter,
  Facebook,
  Users,
  Globe,
  Lock,
  QrCode,
  Send
} from "lucide-react";

interface ShareTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: number;
  tripTitle: string;
  tripDestination: string;
}

type ShareVisibility = 'private' | 'anyone_with_link' | 'public';

export function ShareTripModal({
  isOpen,
  onClose,
  tripId,
  tripTitle,
  tripDestination,
}: ShareTripModalProps) {
  const [copied, setCopied] = useState(false);
  const [visibility, setVisibility] = useState<ShareVisibility>('anyone_with_link');
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Generate shareable link
  const shareableLink = `${window.location.origin}/trips/${tripId}?share=true`;

  // Copy link to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Share via different platforms
  const shareVia = (platform: string) => {
    const text = `Check out my trip plan to ${tripDestination}!`;
    const encodedText = encodeURIComponent(text);
    const encodedUrl = encodeURIComponent(shareableLink);

    const shareUrls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      email: `mailto:?subject=${encodeURIComponent(`Trip to ${tripDestination}`)}&body=${encodedText}%0A%0A${encodedUrl}`,
    };

    if (shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank', 'width=600,height=400');
    }
  };

  // Add collaborator
  const addCollaborator = () => {
    if (emailInput && emailInput.includes('@')) {
      setCollaborators(prev => [...prev, emailInput]);
      setEmailInput('');
    }
  };

  // Send invites
  const sendInvites = async () => {
    if (collaborators.length === 0) return;

    setIsSending(true);
    // Simulate sending invites
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSending(false);
    setCollaborators([]);
    // In a real app, this would call an API to send email invites
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      setCollaborators([]);
      setEmailInput('');
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-display font-bold text-lg text-slate-900">
                Share Trip
              </h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-6">
              {/* Trip Preview */}
              <div className="p-3 bg-slate-50 rounded-xl flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-lg font-bold">
                  {tripDestination.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{tripTitle || tripDestination}</p>
                  <p className="text-sm text-slate-500">{tripDestination}</p>
                </div>
              </div>

              {/* Visibility Options */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-3 block">
                  Who can view this trip?
                </label>
                <div className="space-y-2">
                  <button
                    onClick={() => setVisibility('private')}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors text-left ${
                      visibility === 'private'
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      visibility === 'private' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Private</p>
                      <p className="text-xs text-slate-500">Only you can view</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setVisibility('anyone_with_link')}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors text-left ${
                      visibility === 'anyone_with_link'
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      visibility === 'anyone_with_link' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <Link2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Anyone with link</p>
                      <p className="text-xs text-slate-500">Share via link</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setVisibility('public')}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors text-left ${
                      visibility === 'public'
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      visibility === 'public' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Public</p>
                      <p className="text-xs text-slate-500">Visible to everyone</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Share Link */}
              {visibility !== 'private' && (
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Shareable link
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 px-3 py-2 bg-slate-100 rounded-lg text-sm text-slate-600 truncate">
                      {shareableLink}
                    </div>
                    <Button
                      onClick={copyToClipboard}
                      className={`rounded-lg transition-colors ${
                        copied
                          ? 'bg-green-500 hover:bg-green-500 text-white'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              )}

              {/* Invite Collaborators */}
              {visibility !== 'private' && (
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Invite collaborators
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addCollaborator()}
                      placeholder="Enter email address"
                      className="flex-1 px-3 py-2 bg-slate-100 border-0 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                    <Button
                      onClick={addCollaborator}
                      variant="outline"
                      className="rounded-lg"
                    >
                      Add
                    </Button>
                  </div>

                  {/* Collaborator Tags */}
                  {collaborators.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {collaborators.map((email, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-sm rounded-full"
                        >
                          {email}
                          <button
                            onClick={() => setCollaborators(prev => prev.filter((_, i) => i !== index))}
                            className="w-4 h-4 rounded-full hover:bg-amber-200 flex items-center justify-center"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {collaborators.length > 0 && (
                    <Button
                      onClick={sendInvites}
                      disabled={isSending}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl"
                    >
                      {isSending ? (
                        <>Sending invites...</>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Send Invites ({collaborators.length})
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}

              {/* Share via Social */}
              {visibility !== 'private' && (
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-3 block">
                    Share via
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => shareVia('twitter')}
                      className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors flex flex-col items-center gap-1"
                    >
                      <Twitter className="w-5 h-5 text-[#1DA1F2]" />
                      <span className="text-xs text-slate-600">Twitter</span>
                    </button>
                    <button
                      onClick={() => shareVia('facebook')}
                      className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors flex flex-col items-center gap-1"
                    >
                      <Facebook className="w-5 h-5 text-[#4267B2]" />
                      <span className="text-xs text-slate-600">Facebook</span>
                    </button>
                    <button
                      onClick={() => shareVia('whatsapp')}
                      className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors flex flex-col items-center gap-1"
                    >
                      <MessageCircle className="w-5 h-5 text-[#25D366]" />
                      <span className="text-xs text-slate-600">WhatsApp</span>
                    </button>
                    <button
                      onClick={() => shareVia('email')}
                      className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors flex flex-col items-center gap-1"
                    >
                      <Mail className="w-5 h-5 text-slate-600" />
                      <span className="text-xs text-slate-600">Email</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex justify-end">
              <Button
                onClick={onClose}
                variant="outline"
                className="rounded-xl"
              >
                Done
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
