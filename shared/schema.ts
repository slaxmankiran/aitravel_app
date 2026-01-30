import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, real, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql, relations } from "drizzle-orm";

// ============================================================================
// USERS & AUTHENTICATION
// ============================================================================

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password"), // Null for OAuth users
  name: text("name"),
  avatar: text("avatar"),

  // OAuth providers
  googleId: text("google_id").unique(),
  appleId: text("apple_id").unique(),

  // Subscription
  subscriptionTier: text("subscription_tier").default("free"), // 'free', 'pro', 'business'
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  stripeCustomerId: text("stripe_customer_id"),

  // Preferences
  preferredCurrency: text("preferred_currency").default("USD"),
  homeAirport: text("home_airport"),
  travelStyle: jsonb("travel_style"), // { adventure: 0.8, relaxation: 0.5, culture: 0.9 }
  dietaryRestrictions: text("dietary_restrictions").array(),

  // Email preferences
  emailVerified: boolean("email_verified").default(false),
  emailNotifications: boolean("email_notifications").default(true),
  marketingEmails: boolean("marketing_emails").default(false),

  // Stats
  tripsCreated: integer("trips_created").default(0),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // UUID token
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
});

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================================================
// TRIPS
// ============================================================================

export const trips = pgTable("trips", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }), // Null for anonymous trips
  voyageUid: text("voyage_uid"), // Anonymous user ID from localStorage (Item 21: Account-lite)

  // Trip Details
  passport: text("passport").notNull(),
  residence: text("residence"),
  origin: text("origin"),
  destination: text("destination").notNull(),
  dates: text("dates").notNull(),
  budget: integer("budget").notNull(),
  currency: text("currency").default("USD"),
  groupSize: integer("group_size").notNull().default(1),
  adults: integer("adults").notNull().default(1),
  children: integer("children").notNull().default(0),
  infants: integer("infants").notNull().default(0),

  // Trip Preferences
  travelStyle: text("travel_style"), // 'adventure', 'relaxation', 'culture', 'foodie', 'budget'
  accommodationType: text("accommodation_type"), // 'hotel', 'hostel', 'airbnb', 'luxury'
  pacePreference: text("pace_preference"), // 'relaxed', 'moderate', 'packed'
  interests: text("interests").array(), // ['museums', 'beaches', 'nightlife', 'food']

  // AI Outputs
  feasibilityStatus: text("feasibility_status").default("pending"), // 'pending' | 'yes' | 'no' | 'warning' | 'error'
  feasibilityReport: jsonb("feasibility_report"),
  feasibilityError: text("feasibility_error"), // Error message if feasibilityStatus === 'error'
  feasibilityLastRunAt: timestamp("feasibility_last_run_at"), // When the last feasibility check started
  itinerary: jsonb("itinerary"),

  // Itinerary Generation Lock (prevents duplicate generation from multiple tabs)
  itineraryStatus: text("itinerary_status").default("idle"), // 'idle' | 'generating' | 'complete' | 'error'
  itineraryLockedAt: timestamp("itinerary_locked_at"), // When generation lock was acquired
  itineraryLockOwner: text("itinerary_lock_owner"), // UUID of the process that owns the lock

  // Destination Image (fetched via AI during trip creation)
  destinationImageUrl: text("destination_image_url"), // Cached image URL for My Trips cards

  // Template/Sharing
  isPublic: boolean("is_public").default(false),
  isTemplate: boolean("is_template").default(false),
  templateName: text("template_name"),
  templateDescription: text("template_description"),
  templateCategory: text("template_category"), // 'romantic', 'adventure', 'family', 'budget', 'luxury'
  useCount: integer("use_count").default(0), // How many times template was copied
  rating: real("rating"), // Average rating 1-5
  ratingCount: integer("rating_count").default(0),

  // Status
  status: text("status").default("draft"), // 'draft', 'planning', 'booked', 'completed', 'cancelled'
  createdFrom: text("created_from").default("form"), // 'chat' | 'form' | 'demo' - tracks which UI flow created the trip

  // Checklist progress
  checklistProgress: jsonb("checklist_progress"), // { visaApplied: true, flightsBooked: false, ... }

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("trips_user_id_idx").on(table.userId),
  voyageUidIdx: index("trips_voyage_uid_idx").on(table.voyageUid),
  destinationIdx: index("trips_destination_idx").on(table.destination),
  isTemplateIdx: index("trips_is_template_idx").on(table.isTemplate),
}));

// ============================================================================
// COLLABORATIVE PLANNING
// ============================================================================

export const tripCollaborators = pgTable("trip_collaborators", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").references(() => trips.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  email: text("email"), // For invited but not registered users
  role: text("role").default("viewer"), // 'owner', 'editor', 'viewer'
  inviteToken: text("invite_token"),
  invitedAt: timestamp("invited_at").defaultNow(),
  acceptedAt: timestamp("accepted_at"),
});

export const tripComments = pgTable("trip_comments", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").references(() => trips.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  dayIndex: integer("day_index"), // Which day the comment is about (null for general)
  activityIndex: integer("activity_index"), // Which activity (null for day-level)
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tripVotes = pgTable("trip_votes", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").references(() => trips.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  dayIndex: integer("day_index").notNull(),
  activityIndex: integer("activity_index").notNull(),
  vote: text("vote").notNull(), // 'up', 'down'
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================================================
// AI CHAT / CONVERSATIONS
// ============================================================================

export const tripConversations = pgTable("trip_conversations", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").references(() => trips.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  messages: jsonb("messages").notNull().default([]), // [{ role: 'user'|'assistant', content: string, timestamp: Date }]
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================================
// APPLIED PLANS (for shareable change plan links)
// ============================================================================

/**
 * Stores applied plan summaries for shareable links.
 * When a user applies a change plan, we persist a compact summary.
 * Shared links can restore the banner state from this table.
 */
export const tripAppliedPlans = pgTable("trip_applied_plans", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").references(() => trips.id, { onDelete: "cascade" }).notNull(),
  changeId: text("change_id").notNull(),
  source: text("source").notNull(), // "fix_blocker" | "edit_trip" | "undo" | "quick_chip"
  appliedAt: timestamp("applied_at").defaultNow().notNull(),

  // Plan summary (compact, no full trip snapshot)
  detectedChanges: jsonb("detected_changes").notNull().default([]),
  deltaSummary: jsonb("delta_summary").notNull(),
  failures: jsonb("failures"), // nullable
  uiInstructions: jsonb("ui_instructions"), // nullable

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint: one plan per tripId + changeId
  tripChangeUnique: uniqueIndex("trip_applied_plans_trip_change_uniq").on(table.tripId, table.changeId),
  // Index for recent plans queries
  tripAppliedIdx: index("trip_applied_plans_trip_applied_idx").on(table.tripId, table.appliedAt),
}));

// ============================================================================
// TRIP VERSIONS (Version History - Item 18)
// ============================================================================

/**
 * Stores versioned snapshots of a trip for history/restore functionality.
 * Created when:
 *   - Change planner applies a plan
 *   - Apply Fix dispatcher applies a patch
 *   - User clicks "Save version"
 *
 * Snapshot stores TripExportModel-lite for PDF stability across schema changes.
 */
export const tripVersions = pgTable("trip_versions", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").references(() => trips.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),

  // Source of this version
  source: text("source").notNull(), // 'change_plan' | 'next_fix' | 'manual_save' | 'system' | 'restore'

  // Links to change planner identity (for deduplication)
  changeId: text("change_id"), // nullable - manual saves don't have a changeId

  // Optional display name for later "named versions" feature
  label: text("label"),

  // Snapshot of trip state (TripExportModel-lite)
  // Contains: inputs, costs, certainty, itinerary summary
  snapshot: jsonb("snapshot").notNull(),

  // Quick summary for list display (no need to parse snapshot)
  summary: jsonb("summary").notNull(), // { chips: string[], certaintyAfter?: number, totalAfter?: number|null }

  // Optional: pin important versions
  isPinned: boolean("is_pinned").default(false),
}, (table) => ({
  // Index for listing versions by trip
  tripIdIdx: index("trip_versions_trip_id_idx").on(table.tripId),
  // Unique constraint: one version per tripId + changeId (when changeId is present)
  // This prevents duplicates from the same change plan application
  tripChangeIdUnique: uniqueIndex("trip_versions_trip_change_id_uniq")
    .on(table.tripId, table.changeId)
    .where(sql`change_id IS NOT NULL`),
}));

// ============================================================================
// PRICE ALERTS
// ============================================================================

export const priceAlerts = pgTable("price_alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  tripId: integer("trip_id").references(() => trips.id, { onDelete: "cascade" }),

  type: text("type").notNull(), // 'flight', 'hotel'

  // Search parameters
  origin: text("origin"),
  destination: text("destination").notNull(),
  departureDate: text("departure_date"),
  returnDate: text("return_date"),
  adults: integer("adults").default(1),

  // Price tracking
  initialPrice: real("initial_price"),
  currentPrice: real("current_price"),
  lowestPrice: real("lowest_price"),
  targetPrice: real("target_price"), // Alert when price drops below this
  currency: text("currency").default("USD"),

  // Alert settings
  isActive: boolean("is_active").default(true),
  alertThreshold: real("alert_threshold").default(10), // Alert when drops by X%
  lastChecked: timestamp("last_checked"),
  lastAlertSent: timestamp("last_alert_sent"),

  // Price history
  priceHistory: jsonb("price_history").default([]), // [{ price: number, timestamp: Date }]

  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("price_alerts_user_id_idx").on(table.userId),
  isActiveIdx: index("price_alerts_is_active_idx").on(table.isActive),
}));

// ============================================================================
// PACKING LISTS
// ============================================================================

export const packingLists = pgTable("packing_lists", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").references(() => trips.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),

  items: jsonb("items").notNull().default([]), // [{ category: string, name: string, quantity: number, packed: boolean }]

  // AI-generated based on
  destination: text("destination"),
  climate: text("climate"), // 'tropical', 'cold', 'temperate', 'desert'
  duration: integer("duration"), // days
  activities: text("activities").array(), // ['hiking', 'beach', 'business']

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================================
// SUBSCRIPTIONS & BILLING
// ============================================================================

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),

  plan: text("plan").notNull(), // 'pro', 'business'
  status: text("status").notNull(), // 'active', 'cancelled', 'past_due', 'expired'

  // Stripe
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),

  // Billing
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================================
// AFFILIATE TRACKING
// ============================================================================

export const affiliateClicks = pgTable("affiliate_clicks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  tripId: integer("trip_id").references(() => trips.id, { onDelete: "set null" }),

  linkType: text("link_type").notNull(), // 'flight', 'hotel', 'activity', 'insurance'
  provider: text("provider").notNull(), // 'skyscanner', 'booking', 'viator', etc.
  url: text("url"),

  // Conversion tracking
  clickedAt: timestamp("clicked_at").defaultNow(),
  convertedAt: timestamp("converted_at"),
  conversionValue: real("conversion_value"),
  commission: real("commission"),
});

// ============================================================================
// B2B API KEYS
// ============================================================================

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),

  // Key details
  key: text("key").notNull().unique(), // Format: sk_live_xxx or sk_test_xxx
  name: text("name").notNull(), // Display name for the key
  description: text("description"),

  // Permissions and limits
  permissions: jsonb("permissions").default(['read']), // Array: ['read', 'write', 'trips', 'feasibility', 'itinerary']
  rateLimit: integer("rate_limit").default(1000), // Requests per day
  tier: text("tier").default("free"), // 'free', 'pro', 'business', 'enterprise'

  // Usage tracking
  usageCount: integer("usage_count").default(0),
  usageResetAt: timestamp("usage_reset_at"),
  lastUsedAt: timestamp("last_used_at"),

  // Status
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"), // Optional expiration

  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================================
// EMAIL NOTIFICATIONS
// ============================================================================

export const emailQueue = pgTable("email_queue", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),

  type: text("type").notNull(), // 'welcome', 'price_alert', 'trip_reminder', 'collaboration_invite'
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  htmlBody: text("html_body"),

  // Metadata
  metadata: jsonb("metadata"), // Additional data for templates

  // Status
  status: text("status").default("pending"), // 'pending', 'sent', 'failed'
  sentAt: timestamp("sent_at"),
  error: text("error"),
  retryCount: integer("retry_count").default(0),

  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================================================
// WEATHER CACHE
// ============================================================================

export const weatherCache = pgTable("weather_cache", {
  id: serial("id").primaryKey(),
  destination: text("destination").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD

  // Weather data
  tempHigh: real("temp_high"),
  tempLow: real("temp_low"),
  condition: text("condition"), // 'sunny', 'cloudy', 'rainy', etc.
  precipitation: real("precipitation"), // percentage
  humidity: real("humidity"),
  icon: text("icon"),

  fetchedAt: timestamp("fetched_at").defaultNow(),
}, (table) => ({
  destDateIdx: index("weather_cache_dest_date_idx").on(table.destination, table.date),
}));

// ============================================================================
// ZOD SCHEMAS FOR VALIDATION
// ============================================================================

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  tripsCreated: true,
  lastLoginAt: true,
});

export const insertTripSchema = createInsertSchema(trips).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  feasibilityStatus: true,
  feasibilityReport: true,
  itinerary: true,
  useCount: true,
  rating: true,
  ratingCount: true,
});

export const insertPriceAlertSchema = createInsertSchema(priceAlerts).omit({
  id: true,
  createdAt: true,
  lastChecked: true,
  lastAlertSent: true,
  priceHistory: true,
});

export const insertPackingListSchema = createInsertSchema(packingLists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================================================
// TYPES
// ============================================================================

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Session = typeof sessions.$inferSelect;

export type Trip = typeof trips.$inferSelect;
export type InsertTrip = z.infer<typeof insertTripSchema>;

export type TripCollaborator = typeof tripCollaborators.$inferSelect;
export type TripComment = typeof tripComments.$inferSelect;
export type TripConversation = typeof tripConversations.$inferSelect;

export type PriceAlert = typeof priceAlerts.$inferSelect;
export type InsertPriceAlert = z.infer<typeof insertPriceAlertSchema>;

export type PackingList = typeof packingLists.$inferSelect;
export type InsertPackingList = z.infer<typeof insertPackingListSchema>;

export type Subscription = typeof subscriptions.$inferSelect;
export type AffiliateClick = typeof affiliateClicks.$inferSelect;
export type WeatherCache = typeof weatherCache.$inferSelect;

// Trip Versions
export type TripVersion = typeof tripVersions.$inferSelect;
export type InsertTripVersion = typeof tripVersions.$inferInsert;

// ============================================================================
// VERSION HISTORY TYPES (Item 18)
// ============================================================================

/**
 * Source of a version creation
 */
export type VersionSource = 'change_plan' | 'next_fix' | 'manual_save' | 'system' | 'restore';

/**
 * Snapshot stored in trip_versions.snapshot
 * This is a TripExportModel-lite for PDF stability across schema changes.
 */
export interface VersionSnapshot {
  // Trip inputs
  inputs: {
    passport: string;
    destination: string;
    dates: string;
    budget: number;
    currency: string;
    groupSize: number;
    adults: number;
    children: number;
    infants: number;
    travelStyle?: string;
    origin?: string;
  };

  // Cost breakdown
  costs: {
    grandTotal: number | null;
    perPerson: number | null;
    currency: string;
    rows: Array<{
      category: string;
      amount: number | null;
      note?: string;
    }>;
  };

  // Certainty state
  certainty: {
    score: number;
    visaRisk: 'low' | 'medium' | 'high';
    bufferDays?: number;
    verdict: 'yes' | 'no' | 'warning';
  };

  // Itinerary summary (compact, not full activities)
  itinerarySummary: {
    totalDays: number;
    dayHeadings: string[]; // ["Day 1: Arrival", "Day 2: Temple Tours", ...]
    totalActivities: number;
  };

  // Optional: full itinerary for restore (can be large)
  itinerary?: any; // Full itinerary JSON for restore functionality
}

/**
 * Summary stored in trip_versions.summary for quick list display
 */
export interface VersionSummary {
  chips: string[]; // ["+3 buffer days", "Cost -$120", "Visa risk lowered"]
  certaintyAfter?: number;
  totalAfter?: number | null;
  source?: string; // Display-friendly source label
}

/**
 * Full version record for API responses
 */
export interface TripVersionResponse {
  id: number;
  tripId: number;
  createdAt: string;
  source: VersionSource;
  changeId?: string;
  label?: string;
  summary: VersionSummary;
  snapshot: VersionSnapshot;
  isPinned: boolean;
}

/**
 * Request body for creating a version
 */
export interface CreateVersionRequest {
  source: VersionSource;
  changeId?: string;
  label?: string;
  snapshot: VersionSnapshot;
  summary: VersionSummary;
}

// ============================================================================
// API TYPES
// ============================================================================

export interface FeasibilityReport {
  schemaVersion: number; // Current: 2. Prevents silent breakage when fields change.
  overall: "yes" | "no" | "warning";
  score: number;
  breakdown: {
    accessibility?: { status: "accessible" | "restricted" | "impossible"; reason: string };
    visa: { status: "ok" | "issue"; reason: string };
    budget: { status: "ok" | "tight" | "impossible"; estimatedCost: number; reason: string };
    safety: { status: "safe" | "caution" | "danger"; reason: string };
  };
  summary: string;
  visaDetails?: VisaDetails; // Server-generated visa details (single source of truth)
  generatedAt: string; // ISO date when this analysis was run
  expiresAt?: string; // ISO date when this analysis should be refreshed (e.g., +7 days)
}

// Current feasibility report schema version
export const FEASIBILITY_SCHEMA_VERSION = 2;

// Alternative destination (shown when HARD_BLOCKER)
export interface Alternative {
  destination: string;
  destinationCode: string;
  city: string;
  flag: string;
  visaType: 'visa_free' | 'voa' | 'e_visa' | 'embassy';  // Internal enum for logic/analytics
  visaStatus: 'visa_free' | 'visa_on_arrival' | 'e_visa' | 'embassy_visa' | 'requires_verification';  // User-facing display
  visaLabel: string;
  processingDays: number;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  // Curation metadata - controls product behavior
  isCurated: boolean;                              // First-class product switch
  curationLevel?: 'manual' | 'auto';               // How curation was determined
  lastReviewedAt?: string;                         // ISO date of last human review
  // Behavior tied to isCurated:
  // - Non-curated: rough cost range, short explanation, certainty cap ≤75, affiliate optional
  // - Curated: tight cost range, rich explanation, certainty cap ≤90, affiliate yes
}

// Legacy alias for backward compatibility
export type { Alternative as AlternativeDestination };

// ============================================================================
// MVP CERTAINTY ENGINE TYPES
// ============================================================================

export interface VisaTiming {
  daysUntilTrip: number;
  businessDaysUntilTrip: number;
  processingDaysNeeded: number;
  hasEnoughTime: boolean;
  urgency: 'ok' | 'tight' | 'risky' | 'impossible';
  recommendation: string;
}

export interface VisaDetails {
  required: boolean;
  type: 'visa_free' | 'visa_on_arrival' | 'e_visa' | 'embassy_visa' | 'not_allowed' | 'requires_verification';
  name?: string;
  processingDays: {
    minimum: number;
    maximum: number;
    expedited?: number;
  };
  cost: {
    government: number;
    service?: number;
    expedited?: number;
    currency: string;
    totalPerPerson: number;
    breakdownLabel?: string; // e.g., "Gov't fee + service charge"
    accuracy: 'curated' | 'estimated';
  };
  documentsRequired: string[];
  applicationMethod: 'online' | 'embassy' | 'vfs' | 'on_arrival';
  applicationUrl?: string;
  timing?: VisaTiming;
  affiliateLink?: string;
  lastVerified?: string; // ISO date string when data was last verified
  sources?: Array<{ title: string; url: string }>;
  confidenceLevel: 'high' | 'medium' | 'low';
}

export interface CertaintyScoreBreakdown {
  accessibility: {
    score: number; // 0-25
    status: 'ok' | 'warning' | 'blocker';
    reason: string;
  };
  visa: {
    score: number; // 0-30
    status: 'ok' | 'warning' | 'blocker';
    reason: string;
    timingOk: boolean;
  };
  safety: {
    score: number; // 0-25
    status: 'ok' | 'warning' | 'blocker';
    reason: string;
  };
  budget: {
    score: number; // 0-20
    status: 'ok' | 'warning' | 'blocker';
    reason: string;
  };
}

export interface CertaintyScore {
  score: number; // 0-100
  verdict: 'GO' | 'POSSIBLE' | 'DIFFICULT' | 'NO';
  summary: string;
  breakdown: CertaintyScoreBreakdown;
  blockers: string[];
  warnings: string[];
}

export interface EntryCosts {
  visa: {
    required: boolean;
    costPerPerson: number;
    totalCost: number;
    note: string;
    affiliateLink?: string;
  };
  insurance: {
    required: boolean;
    recommended: boolean;
    estimatedCost: number;
    note: string;
    affiliateLink?: string;
  };
  total: number;
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  dueInfo?: string; // "5-7 days processing"
  estimatedCost?: string; // "₹3,500/person"
  affiliateLink?: string;
  affiliateLabel?: string;
  completed: boolean;
}

export interface TrueCostBreakdown {
  currency: string;
  currencySymbol: string;
  tripCosts: {
    flights: { total: number; perPerson: number; note: string };
    accommodation: { total: number; perNight: number; nights: number };
    activities: { total: number; note: string };
    food: { total: number; perDay: number };
    localTransport: { total: number; note: string };
    subtotal: number;
  };
  entryCosts: EntryCosts;
  grandTotal: number;
  perPerson: number;
  budgetStatus: 'under' | 'on_track' | 'over';
  budgetDifference?: number;
}

// Affiliate links configuration
export const AFFILIATE_LINKS = {
  visa: {
    ivisa: 'https://www.ivisa.com/?utm_source=voyageai&utm_medium=affiliate',
    visaHQ: 'https://www.visahq.com/?utm_source=voyageai',
  },
  insurance: {
    safetywing: 'https://safetywing.com/nomad-insurance/?referenceID=voyageai',
    worldNomads: 'https://www.worldnomads.com/?affiliate=voyageai',
  },
  flights: {
    skyscanner: 'https://www.skyscanner.com/?associate=voyageai',
    googleFlights: 'https://www.google.com/travel/flights',
  },
  hotels: {
    booking: 'https://www.booking.com/?aid=voyageai',
    agoda: 'https://www.agoda.com/?cid=voyageai',
  },
  activities: {
    viator: 'https://www.viator.com/?pid=voyageai',
    getYourGuide: 'https://www.getyourguide.com/?partner_id=voyageai',
  }
} as const;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface PackingItem {
  category: string;
  name: string;
  quantity: number;
  packed: boolean;
  essential: boolean;
}

export interface ChecklistProgress {
  visaApplied?: boolean;
  visaApproved?: boolean;
  flightsBooked?: boolean;
  hotelsBooked?: boolean;
  activitiesBooked?: boolean;
  insurancePurchased?: boolean;
  packingComplete?: boolean;
}

export interface WeatherForecast {
  date: string;
  tempHigh: number;
  tempLow: number;
  condition: string;
  precipitation: number;
  icon: string;
}

export type CreateTripRequest = InsertTrip;
export type TripResponse = Trip;

// ============================================================================
// SUBSCRIPTION TIERS
// ============================================================================

export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    price: 0,
    features: {
      tripsPerMonth: 3,
      priceAlerts: 1,
      collaborators: 0,
      chatMessages: 10,
      templates: false,
      prioritySupport: false,
    }
  },
  pro: {
    name: 'Pro',
    price: 49, // per year
    features: {
      tripsPerMonth: -1, // unlimited
      priceAlerts: 10,
      collaborators: 5,
      chatMessages: -1,
      templates: true,
      prioritySupport: false,
    }
  },
  business: {
    name: 'Business',
    price: 199, // per year
    features: {
      tripsPerMonth: -1,
      priceAlerts: -1,
      collaborators: -1,
      chatMessages: -1,
      templates: true,
      prioritySupport: true,
      apiAccess: true,
      whiteLabel: true,
    }
  }
} as const;

// ============================================================================
// CHANGE PLANNER AGENT TYPES
// See: docs/CHANGE_PLANNER_AGENT_SPEC.md for full specification
// ============================================================================

/**
 * Fields that can be changed by the user after seeing results
 */
export type ChangeableField =
  | "dates"
  | "budget"
  | "origin"
  | "destination"
  | "passport"
  | "travelers"
  | "preferences"
  | "constraints";

/**
 * Modules that can be recomputed based on changes
 */
export type RecomputableModule =
  | "visa"
  | "flights"
  | "hotels"
  | "itinerary"
  | "certainty"
  | "action_items";

/**
 * Severity of a detected change
 */
export type ChangeSeverity = "low" | "medium" | "high";

/**
 * UI sections that can be highlighted after changes
 */
export type HighlightableSection = "ActionItems" | "CostBreakdown" | "Itinerary" | "VisaCard";

/**
 * Toast notification tones
 */
export type ToastTone = "success" | "warning" | "error";

/**
 * Banner tones for change results
 */
export type BannerTone = "green" | "amber" | "red";

/**
 * User trip input for change detection
 */
export interface UserTripInput {
  dates: {
    start: string;  // ISO date
    end: string;    // ISO date
    duration: number;
  };
  budget: {
    total: number;
    perPerson?: number;
    currency: string;
  };
  origin: {
    city: string;
    airport?: string;
    country: string;
  };
  destination: {
    city: string;
    country: string;
  };
  passport: string;  // Country code
  travelers: {
    total: number;
    adults: number;
    children: number;
    infants: number;
  };
  preferences: {
    pace: "relaxed" | "moderate" | "packed";
    interests: string[];
    hotelClass: "budget" | "mid" | "luxury";
  };
  constraints: string[];
}

/**
 * A single detected change between previous and current input
 */
export interface DetectedChange {
  field: ChangeableField;
  before: any;
  after: any;
  impact: RecomputableModule[];
  severity: ChangeSeverity;
}

/**
 * Plan for what to recompute
 */
export interface RecomputePlan {
  modulesToRecompute: RecomputableModule[];
  cacheKeysToInvalidate: string[];
  apiCalls: Array<{
    name: string;
    endpointKey: string;
    dependsOn?: string[];
    priority: 1 | 2 | 3;
  }>;
}

/**
 * Summary of deltas between before and after states
 */
export interface DeltaSummary {
  certainty: {
    before: number;
    after: number;
    reason: string;
  };
  totalCost: {
    before: number;
    after: number;
    delta: number;
    notes: string[];
  };
  blockers: {
    before: number;
    after: number;
    resolved: string[];
    new: string[];
  };
  itinerary: {
    dayCountBefore: number;
    dayCountAfter: number;
    majorDiffs: string[];
  };
}

/**
 * Instructions for the UI on how to render the change results
 */
export interface UIInstructions {
  banner: {
    tone: BannerTone;
    title: string;
    subtitle?: string;
  };
  highlightSections: HighlightableSection[];
  toasts?: Array<{
    tone: ToastTone;
    message: string;
  }>;
}

/**
 * Updated action item from change planner
 */
export interface ChangePlannerActionItem {
  key: string;
  label: string;
  category: "required" | "recommended";
  type: string;
  completed: boolean;
  reason?: string;
}

/**
 * Updated data from the change planner
 */
export interface UpdatedData {
  visa?: any;
  flights?: any;
  hotels?: any;
  itinerary?: any;
  actionItems: ChangePlannerActionItem[];
  costBreakdown?: any;
}

/**
 * Fix option suggestion when blockers exist
 */
export interface FixOption {
  title: string;
  changePatch: Partial<UserTripInput>;
  expectedOutcome: {
    certaintyAfter: number;
    blockersAfter: number;
    costDelta: number;
  };
  confidence: "high" | "medium" | "low";
}

/**
 * Main response from the Change Planner Agent
 */
export interface ChangePlannerResponse {
  changeId: string;
  detectedChanges: DetectedChange[];
  recomputePlan: RecomputePlan;
  deltaSummary: DeltaSummary;
  uiInstructions: UIInstructions;
  updatedData: UpdatedData;
  fixOptions?: FixOption[];
  failures?: ModuleFailure[];
}

/**
 * Partial failure information when some modules fail
 */
export interface ModuleFailure {
  module: RecomputableModule;
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
}

/**
 * Response with partial failures
 */
export interface ChangePlannerResponseWithFailures extends ChangePlannerResponse {
  failures: ModuleFailure[];
}

/**
 * Analytics event payloads for change tracking
 */
export interface TripChangeStartedEvent {
  changeFields: ChangeableField[];
  source: "edit_trip" | "quick_chip" | "fix_blocker";
  currentCertainty: number;
}

export interface TripChangePlannedEvent {
  modulesToRecompute: RecomputableModule[];
  severityMax: ChangeSeverity;
  predictedBlockerDelta: number;
  predictedCostDelta: number;
}

export interface TripChangeAppliedEvent {
  certaintyBefore: number;
  certaintyAfter: number;
  blockersBefore: number;
  blockersAfter: number;
  costBefore: number;
  costAfter: number;
  durationMs: number;
}

export interface TripChangeFailedEvent {
  moduleFailed: RecomputableModule;
  errorCode: string;
  partialApplied: boolean;
}

export interface FixOptionEvent {
  optionTitle: string;
  confidence: "high" | "medium" | "low";
  outcomeDeltas: {
    certainty: number;
    blockers: number;
    cost: number;
  };
}
