/**
 * Trip Collaboration Components
 * Invite collaborators, share trips, add comments and votes
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  UserPlus,
  Share2,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Send,
  Copy,
  Check,
  X,
  Mail,
  Crown,
  Edit3,
  Eye,
  Loader2,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface Collaborator {
  id: number;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  inviteStatus: 'pending' | 'accepted' | 'declined';
  invitedAt: string;
  acceptedAt?: string;
}

interface Comment {
  id: number;
  tripId: number;
  authorName: string;
  content: string;
  dayNumber?: number;
  activityId?: string;
  createdAt: string;
}

interface CollaborationPanelProps {
  tripId: number;
  destination: string;
}

const ROLE_ICONS = {
  owner: Crown,
  editor: Edit3,
  viewer: Eye,
};

const ROLE_LABELS = {
  owner: 'Owner',
  editor: 'Can Edit',
  viewer: 'View Only',
};

export function CollaborationPanel({ tripId, destination }: CollaborationPanelProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'collaborators' | 'comments'>('collaborators');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('viewer');
  const [isInviting, setIsInviting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchCollaborators();
    fetchComments();
  }, [tripId]);

  async function fetchCollaborators() {
    try {
      const res = await fetch(`/api/trips/${tripId}/collaborators`);
      if (res.ok) {
        const data = await res.json();
        setCollaborators(data.collaborators || []);
      }
    } catch (err) {
      console.error('Failed to fetch collaborators:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchComments() {
    try {
      const res = await fetch(`/api/trips/${tripId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send invite');
      }

      const data = await res.json();
      setCollaborators([...collaborators, data.collaborator]);
      setInviteEmail('');
      setShowInviteForm(false);

      toast({
        title: 'Invitation sent!',
        description: `${inviteEmail} has been invited to collaborate.`,
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to send invitation',
        variant: 'destructive',
      });
    } finally {
      setIsInviting(false);
    }
  }

  async function handleRemoveCollaborator(id: number) {
    try {
      const res = await fetch(`/api/trips/${tripId}/collaborators/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to remove collaborator');

      setCollaborators(collaborators.filter(c => c.id !== id));

      toast({
        title: 'Collaborator removed',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to remove collaborator',
        variant: 'destructive',
      });
    }
  }

  async function handleAddComment() {
    if (!newComment.trim()) return;

    setIsCommenting(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newComment,
        }),
      });

      if (!res.ok) throw new Error('Failed to add comment');

      const data = await res.json();
      setComments([data.comment, ...comments]);
      setNewComment('');
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to add comment',
        variant: 'destructive',
      });
    } finally {
      setIsCommenting(false);
    }
  }

  async function handleDeleteComment(id: number) {
    try {
      const res = await fetch(`/api/trips/${tripId}/comments/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete comment');

      setComments(comments.filter(c => c.id !== id));
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to delete comment',
        variant: 'destructive',
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/20 rounded-lg">
              <Users className="w-5 h-5 text-violet-500" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Collaboration</h3>
              <p className="text-xs text-slate-400">
                {collaborators.length} collaborator{collaborators.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <ShareButton tripId={tripId} destination={destination} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setActiveTab('collaborators')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'collaborators'
              ? 'text-white border-b-2 border-primary'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4 inline-block mr-2" />
          People
        </button>
        <button
          onClick={() => setActiveTab('comments')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'comments'
              ? 'text-white border-b-2 border-primary'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <MessageSquare className="w-4 h-4 inline-block mr-2" />
          Comments ({comments.length})
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <AnimatePresence mode="wait">
          {activeTab === 'collaborators' ? (
            <motion.div
              key="collaborators"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {/* Invite Form */}
              <AnimatePresence>
                {showInviteForm ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 bg-slate-700/50 rounded-xl mb-3">
                      <div className="flex gap-2 mb-3">
                        <input
                          type="email"
                          placeholder="Enter email address"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-600 border-none rounded-lg text-white text-sm placeholder:text-slate-400"
                        />
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}
                          className="px-3 py-2 bg-slate-600 border-none rounded-lg text-white text-sm"
                        >
                          <option value="viewer">View Only</option>
                          <option value="editor">Can Edit</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleInvite}
                          disabled={isInviting || !inviteEmail.trim()}
                          size="sm"
                          className="flex-1"
                        >
                          {isInviting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Mail className="w-4 h-4 mr-2" />
                              Send Invite
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => setShowInviteForm(false)}
                          size="sm"
                          variant="outline"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <Button
                      onClick={() => setShowInviteForm(true)}
                      variant="outline"
                      className="w-full border-dashed"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Invite Collaborator
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Collaborator List */}
              {collaborators.length === 0 ? (
                <div className="text-center py-6">
                  <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">
                    No collaborators yet. Invite someone to plan together!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {collaborators.map((collab) => {
                    const RoleIcon = ROLE_ICONS[collab.role];
                    return (
                      <div
                        key={collab.id}
                        className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
                            <span className="text-sm font-medium text-white">
                              {collab.email[0].toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm text-white">{collab.email}</p>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <RoleIcon className="w-3 h-3" />
                              <span>{ROLE_LABELS[collab.role]}</span>
                              {collab.inviteStatus === 'pending' && (
                                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                                  Pending
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {collab.role !== 'owner' && (
                          <button
                            onClick={() => handleRemoveCollaborator(collab.id)}
                            className="p-1 hover:bg-slate-600 rounded"
                          >
                            <X className="w-4 h-4 text-slate-400" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="comments"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {/* New Comment Form */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                  className="flex-1 px-3 py-2 bg-slate-700 border-none rounded-lg text-white text-sm placeholder:text-slate-500"
                />
                <Button
                  onClick={handleAddComment}
                  disabled={isCommenting || !newComment.trim()}
                  size="sm"
                >
                  {isCommenting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {/* Comments List */}
              {comments.length === 0 ? (
                <div className="text-center py-6">
                  <MessageSquare className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">
                    No comments yet. Start the conversation!
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="p-3 bg-slate-700/50 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center">
                            <span className="text-xs font-medium text-white">
                              {comment.authorName[0].toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-white">
                            {comment.authorName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="p-1 hover:bg-slate-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3 text-slate-400" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-slate-300">{comment.content}</p>
                      {comment.dayNumber && (
                        <span className="inline-block mt-2 px-2 py-0.5 bg-slate-600 rounded text-xs text-slate-400">
                          Day {comment.dayNumber}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Share Button Component
 */
function ShareButton({
  tripId,
  destination,
}: {
  tripId: number;
  destination: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  async function generateShareLink() {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'viewer' }),
      });

      if (!res.ok) throw new Error('Failed to generate link');

      const data = await res.json();
      setShareUrl(data.shareUrl);
      setIsOpen(true);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to generate share link',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Link copied!' });
  }

  return (
    <>
      <Button
        onClick={generateShareLink}
        disabled={isLoading}
        size="sm"
        variant="outline"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </>
        )}
      </Button>

      {/* Share Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Share Trip</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-slate-700 rounded"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <p className="text-sm text-slate-400 mb-4">
                Share your trip to {destination} with friends and family.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-3 py-2 bg-slate-700 border-none rounded-lg text-white text-sm"
                />
                <Button onClick={copyToClipboard}>
                  {copied ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>

              <p className="text-xs text-slate-500 mt-3">
                Anyone with this link can view the trip details.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Activity Vote Component
 */
export function ActivityVote({
  tripId,
  activityId,
  initialVotes = { up: 0, down: 0 },
}: {
  tripId: number;
  activityId: string;
  initialVotes?: { up: number; down: number };
}) {
  const [votes, setVotes] = useState(initialVotes);
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
  const { toast } = useToast();

  async function handleVote(vote: 'up' | 'down') {
    try {
      const res = await fetch(`/api/trips/${tripId}/votes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType: 'activity',
          itemId: activityId,
          vote,
        }),
      });

      if (!res.ok) throw new Error('Failed to vote');

      // Update local state
      if (userVote === vote) {
        // Remove vote
        setVotes({
          ...votes,
          [vote]: votes[vote] - 1,
        });
        setUserVote(null);
      } else {
        // Add/change vote
        const newVotes = { ...votes };
        if (userVote) {
          newVotes[userVote] -= 1;
        }
        newVotes[vote] += 1;
        setVotes(newVotes);
        setUserVote(vote);
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to record vote',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleVote('up')}
        className={`p-1 rounded transition-colors ${
          userVote === 'up'
            ? 'bg-green-500/20 text-green-500'
            : 'hover:bg-slate-600 text-slate-400'
        }`}
      >
        <ThumbsUp className="w-4 h-4" />
      </button>
      <span className="text-xs text-slate-400 min-w-[20px] text-center">
        {votes.up - votes.down}
      </span>
      <button
        onClick={() => handleVote('down')}
        className={`p-1 rounded transition-colors ${
          userVote === 'down'
            ? 'bg-red-500/20 text-red-500'
            : 'hover:bg-slate-600 text-slate-400'
        }`}
      >
        <ThumbsDown className="w-4 h-4" />
      </button>
    </div>
  );
}
