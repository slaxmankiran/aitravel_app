/**
 * Collaboration Routes
 * Share trips and plan together with others
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { validateSession, getSessionIdFromHeaders } from '../services/auth';
import { queueEmail } from '../services/email';

const router = Router();

// In-memory storage for collaborations
interface TripCollaborator {
  id: number;
  tripId: number;
  email: string;
  userId?: number;
  role: 'owner' | 'editor' | 'viewer';
  inviteToken?: string;
  inviteStatus: 'pending' | 'accepted' | 'declined';
  invitedAt: Date;
  acceptedAt?: Date;
}

interface TripComment {
  id: number;
  tripId: number;
  userId?: number;
  authorName: string;
  authorEmail: string;
  content: string;
  dayNumber?: number;
  activityId?: string;
  createdAt: Date;
  updatedAt?: Date;
}

interface TripVote {
  id: number;
  tripId: number;
  userId?: number;
  voterEmail: string;
  itemType: 'activity' | 'accommodation' | 'restaurant';
  itemId: string;
  vote: 'up' | 'down';
  createdAt: Date;
}

const collaborators = new Map<number, TripCollaborator>();
const comments = new Map<number, TripComment>();
const votes = new Map<number, TripVote>();
let collaboratorIdCounter = 1;
let commentIdCounter = 1;
let voteIdCounter = 1;

// Validation schemas
const inviteSchema = z.object({
  tripId: z.number(),
  email: z.string().email(),
  role: z.enum(['editor', 'viewer']).default('viewer'),
  message: z.string().optional(),
});

const commentSchema = z.object({
  tripId: z.number(),
  content: z.string().min(1).max(1000),
  dayNumber: z.number().optional(),
  activityId: z.string().optional(),
});

const voteSchema = z.object({
  tripId: z.number(),
  itemType: z.enum(['activity', 'accommodation', 'restaurant']),
  itemId: z.string(),
  vote: z.enum(['up', 'down']),
});

/**
 * POST /api/trips/:id/collaborators
 * Invite a collaborator to a trip
 */
router.post('/:id/collaborators', async (req: Request, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);
    const data = inviteSchema.parse({ ...req.body, tripId });

    // Verify trip exists
    const trip = await storage.getTrip(tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Check for existing invitation
    const existing = Array.from(collaborators.values()).find(
      c => c.tripId === tripId && c.email === data.email
    );

    if (existing) {
      return res.status(400).json({ error: 'User already invited' });
    }

    // Generate invite token
    const inviteToken = generateInviteToken();

    // Create collaborator record
    const collaborator: TripCollaborator = {
      id: collaboratorIdCounter++,
      tripId,
      email: data.email,
      role: data.role,
      inviteToken,
      inviteStatus: 'pending',
      invitedAt: new Date(),
    };

    collaborators.set(collaborator.id, collaborator);

    // Send invitation email
    const inviteUrl = `${process.env.APP_URL || 'http://localhost:3000'}/trips/${tripId}/join?token=${inviteToken}`;

    // Queue invitation email
    const emailSubject = `You're invited to plan a trip to ${trip.destination}`;
    const emailText = `You've been invited to collaborate on a trip to ${trip.destination}!\n\n${data.message || ''}\n\nRole: ${data.role}\n\nJoin here: ${inviteUrl}`;
    const emailHtml = `
      <h2>You're invited!</h2>
      <p>You've been invited to collaborate on a trip to <strong>${trip.destination}</strong>!</p>
      ${data.message ? `<p>${data.message}</p>` : ''}
      <p>Role: ${data.role === 'editor' ? 'Can Edit' : 'View Only'}</p>
      <p><a href="${inviteUrl}" style="background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">Join Trip Planning</a></p>
    `;

    queueEmail({
      to: data.email,
      type: 'collaboration-invite',
      template: { subject: emailSubject, text: emailText, html: emailHtml },
    });

    console.log(`[Collaboration] Invited ${data.email} to trip ${tripId} as ${data.role}`);

    res.json({
      success: true,
      collaborator: sanitizeCollaborator(collaborator),
    });
  } catch (err: any) {
    console.error('[Collaboration] Invite error:', err);

    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.errors[0]?.message || 'Invalid input' });
    }

    res.status(500).json({ error: 'Failed to invite collaborator' });
  }
});

/**
 * GET /api/trips/:id/collaborators
 * Get all collaborators for a trip
 */
router.get('/:id/collaborators', async (req: Request, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);

    const tripCollaborators = Array.from(collaborators.values())
      .filter(c => c.tripId === tripId)
      .map(sanitizeCollaborator);

    res.json({ collaborators: tripCollaborators });
  } catch (err) {
    console.error('[Collaboration] Get collaborators error:', err);
    res.status(500).json({ error: 'Failed to get collaborators' });
  }
});

/**
 * POST /api/trips/:id/join
 * Accept an invitation
 */
router.post('/:id/join', async (req: Request, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Invite token required' });
    }

    // Find invitation by token
    const collaborator = Array.from(collaborators.values()).find(
      c => c.tripId === tripId && c.inviteToken === token
    );

    if (!collaborator) {
      return res.status(404).json({ error: 'Invalid or expired invitation' });
    }

    if (collaborator.inviteStatus === 'accepted') {
      return res.status(400).json({ error: 'Invitation already accepted' });
    }

    // Accept invitation
    collaborator.inviteStatus = 'accepted';
    collaborator.acceptedAt = new Date();
    collaborator.inviteToken = undefined; // Clear token after use

    // Link to user account if authenticated
    const sessionId = getSessionIdFromHeaders(req.headers as Record<string, string | string[] | undefined>);
    if (sessionId) {
      const session = await validateSession(sessionId);
      if (session) {
        collaborator.userId = session.user.id;
      }
    }

    console.log(`[Collaboration] ${collaborator.email} joined trip ${tripId}`);

    res.json({
      success: true,
      message: 'Successfully joined trip',
      tripId,
    });
  } catch (err) {
    console.error('[Collaboration] Join error:', err);
    res.status(500).json({ error: 'Failed to join trip' });
  }
});

/**
 * DELETE /api/trips/:id/collaborators/:collaboratorId
 * Remove a collaborator
 */
router.delete('/:id/collaborators/:collaboratorId', async (req: Request, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);
    const collaboratorId = parseInt(req.params.collaboratorId);

    const collaborator = collaborators.get(collaboratorId);

    if (!collaborator || collaborator.tripId !== tripId) {
      return res.status(404).json({ error: 'Collaborator not found' });
    }

    collaborators.delete(collaboratorId);

    console.log(`[Collaboration] Removed collaborator ${collaboratorId} from trip ${tripId}`);

    res.json({ success: true });
  } catch (err) {
    console.error('[Collaboration] Remove error:', err);
    res.status(500).json({ error: 'Failed to remove collaborator' });
  }
});

/**
 * POST /api/trips/:id/comments
 * Add a comment to a trip
 */
router.post('/:id/comments', async (req: Request, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);
    const data = commentSchema.parse({ ...req.body, tripId });

    // Get author info
    let authorName = 'Anonymous';
    let authorEmail = 'anonymous@example.com';

    const sessionId = getSessionIdFromHeaders(req.headers as Record<string, string | string[] | undefined>);
    if (sessionId) {
      const session = await validateSession(sessionId);
      if (session) {
        authorName = session.user.name || session.user.email.split('@')[0];
        authorEmail = session.user.email;
      }
    }

    const comment: TripComment = {
      id: commentIdCounter++,
      tripId,
      authorName,
      authorEmail,
      content: data.content,
      dayNumber: data.dayNumber,
      activityId: data.activityId,
      createdAt: new Date(),
    };

    comments.set(comment.id, comment);

    console.log(`[Collaboration] New comment on trip ${tripId} by ${authorEmail}`);

    res.json({
      success: true,
      comment: sanitizeComment(comment),
    });
  } catch (err: any) {
    console.error('[Collaboration] Comment error:', err);

    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.errors[0]?.message || 'Invalid input' });
    }

    res.status(500).json({ error: 'Failed to add comment' });
  }
});

/**
 * GET /api/trips/:id/comments
 * Get all comments for a trip
 */
router.get('/:id/comments', async (req: Request, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);
    const dayNumber = req.query.day ? parseInt(req.query.day as string) : undefined;

    let tripComments = Array.from(comments.values())
      .filter(c => c.tripId === tripId);

    if (dayNumber !== undefined) {
      tripComments = tripComments.filter(c => c.dayNumber === dayNumber);
    }

    // Sort by newest first
    tripComments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    res.json({
      comments: tripComments.map(sanitizeComment),
    });
  } catch (err) {
    console.error('[Collaboration] Get comments error:', err);
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

/**
 * DELETE /api/trips/:id/comments/:commentId
 * Delete a comment
 */
router.delete('/:id/comments/:commentId', async (req: Request, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);
    const commentId = parseInt(req.params.commentId);

    const comment = comments.get(commentId);

    if (!comment || comment.tripId !== tripId) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Verify ownership
    const sessionId = getSessionIdFromHeaders(req.headers as Record<string, string | string[] | undefined>);
    if (sessionId) {
      const session = await validateSession(sessionId);
      if (session && comment.authorEmail !== session.user.email) {
        return res.status(403).json({ error: 'Not authorized to delete this comment' });
      }
    }

    comments.delete(commentId);

    res.json({ success: true });
  } catch (err) {
    console.error('[Collaboration] Delete comment error:', err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

/**
 * POST /api/trips/:id/votes
 * Vote on an activity/item
 */
router.post('/:id/votes', async (req: Request, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);
    const data = voteSchema.parse({ ...req.body, tripId });

    // Get voter info
    let voterEmail = 'anonymous@example.com';

    const sessionId = getSessionIdFromHeaders(req.headers as Record<string, string | string[] | undefined>);
    if (sessionId) {
      const session = await validateSession(sessionId);
      if (session) {
        voterEmail = session.user.email;
      }
    }

    // Check for existing vote
    const existing = Array.from(votes.values()).find(
      v => v.tripId === tripId &&
           v.itemId === data.itemId &&
           v.voterEmail === voterEmail
    );

    if (existing) {
      // Update existing vote
      existing.vote = data.vote;
      return res.json({
        success: true,
        vote: existing,
        updated: true,
      });
    }

    // Create new vote
    const vote: TripVote = {
      id: voteIdCounter++,
      tripId,
      voterEmail,
      itemType: data.itemType,
      itemId: data.itemId,
      vote: data.vote,
      createdAt: new Date(),
    };

    votes.set(vote.id, vote);

    res.json({
      success: true,
      vote,
    });
  } catch (err: any) {
    console.error('[Collaboration] Vote error:', err);

    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.errors[0]?.message || 'Invalid input' });
    }

    res.status(500).json({ error: 'Failed to record vote' });
  }
});

/**
 * GET /api/trips/:id/votes
 * Get vote counts for a trip
 */
router.get('/:id/votes', async (req: Request, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);

    const tripVotes = Array.from(votes.values())
      .filter(v => v.tripId === tripId);

    // Aggregate votes by item
    const voteCounts: Record<string, { up: number; down: number }> = {};

    for (const vote of tripVotes) {
      if (!voteCounts[vote.itemId]) {
        voteCounts[vote.itemId] = { up: 0, down: 0 };
      }
      voteCounts[vote.itemId][vote.vote]++;
    }

    res.json({
      votes: voteCounts,
      totalVotes: tripVotes.length,
    });
  } catch (err) {
    console.error('[Collaboration] Get votes error:', err);
    res.status(500).json({ error: 'Failed to get votes' });
  }
});

/**
 * POST /api/trips/:id/share
 * Generate a shareable link
 */
router.post('/:id/share', async (req: Request, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);
    const { role = 'viewer' } = req.body;

    // Verify trip exists
    const trip = await storage.getTrip(tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Generate share token
    const shareToken = generateShareToken();

    // Store share link (in production, save to database)
    // For now, we'll encode the info in the URL

    const shareUrl = `${process.env.APP_URL || 'http://localhost:3000'}/trips/${tripId}/view?share=${shareToken}&role=${role}`;

    console.log(`[Collaboration] Generated share link for trip ${tripId}`);

    res.json({
      success: true,
      shareUrl,
      expiresIn: '7 days',
    });
  } catch (err) {
    console.error('[Collaboration] Share error:', err);
    res.status(500).json({ error: 'Failed to generate share link' });
  }
});

// Helper functions

function generateInviteToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let token = '';
  for (let i = 0; i < 24; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function generateShareToken(): string {
  const chars = 'abcdefghijkmnopqrstuvwxyz23456789';
  let token = '';
  for (let i = 0; i < 12; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function sanitizeCollaborator(c: TripCollaborator): Omit<TripCollaborator, 'inviteToken'> {
  const { inviteToken, ...rest } = c;
  return rest;
}

function sanitizeComment(c: TripComment): Omit<TripComment, 'authorEmail'> & { authorEmail?: string } {
  // Only include email for the comment author when authenticated
  return c;
}

export default router;
