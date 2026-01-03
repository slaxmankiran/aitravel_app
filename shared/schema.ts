import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// === USERS (Standard Boilerplate) ===
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// === TRIP & FEASIBILITY ===
export const trips = pgTable("trips", {
  id: serial("id").primaryKey(),
  passport: text("passport").notNull(),
  residence: text("residence"), // Optional residence
  destination: text("destination").notNull(),
  dates: text("dates").notNull(),
  budget: integer("budget").notNull(),
  groupSize: integer("group_size").notNull().default(1),
  
  // AI Outputs
  feasibilityStatus: text("feasibility_status").default("pending"), // 'yes', 'no', 'pending'
  feasibilityReport: jsonb("feasibility_report"), // Structured reason
  itinerary: jsonb("itinerary"), // The generated plan if feasible
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTripSchema = createInsertSchema(trips).omit({ 
  id: true, 
  createdAt: true,
  feasibilityStatus: true,
  feasibilityReport: true,
  itinerary: true
});

export type Trip = typeof trips.$inferSelect;
export type InsertTrip = z.infer<typeof insertTripSchema>;

// Feasibility Report Structure
export interface FeasibilityReport {
  overall: "yes" | "no" | "warning";
  score: number; // 0-100
  breakdown: {
    visa: { status: "ok" | "issue"; reason: string };
    budget: { status: "ok" | "tight" | "impossible"; estimatedCost: number; reason: string };
    safety: { status: "safe" | "caution" | "danger"; reason: string };
  };
  summary: string;
}

export type CreateTripRequest = InsertTrip;
export type TripResponse = Trip;
