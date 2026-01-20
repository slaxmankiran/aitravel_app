import { users, trips, type User, type InsertUser, type Trip, type InsertTrip, type FeasibilityReport } from "@shared/schema";
import { db, pool } from "./db";
import { eq, desc, isNull, and } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Trip operations
  createTrip(trip: InsertTrip): Promise<Trip>;
  updateTrip(id: number, trip: Partial<InsertTrip>): Promise<Trip | null>; // Update existing trip
  getTrip(id: number): Promise<Trip | undefined>;
  listTrips(): Promise<Trip[]>; // List all trips (for demo lookup)
  listTripsByUid(voyageUid: string, limit?: number): Promise<Trip[]>; // List trips by anonymous user ID
  adoptTrip(id: number, voyageUid: string): Promise<Trip | null>; // Adopt orphan trip (soft backfill)
  deleteTrip(id: number): Promise<void>; // Permanently delete trip and associated data
  updateTripFeasibility(id: number, status: string, report: FeasibilityReport | null, error?: string): Promise<Trip>;
  setTripFeasibilityPending(id: number): Promise<Trip>; // Sets pending status with timestamp
  updateTripItinerary(id: number, itinerary: any): Promise<Trip>;
  updateTripImage(id: number, imageUrl: string): Promise<Trip | null>; // Updates ONLY the image, preserves feasibility
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Note: Users table doesn't have username column, using email as fallback
    const [user] = await db.select().from(users).where(eq(users.email, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createTrip(trip: InsertTrip): Promise<Trip> {
    const [newTrip] = await db.insert(trips).values(trip).returning();
    return newTrip;
  }

  async updateTrip(id: number, tripData: Partial<InsertTrip>): Promise<Trip | null> {
    // Reset feasibility and itinerary when trip details change
    const [updatedTrip] = await db
      .update(trips)
      .set({
        ...tripData,
        feasibilityStatus: 'pending',
        feasibilityReport: null,
        feasibilityError: null,
        itinerary: null,
        updatedAt: new Date(),
      })
      .where(eq(trips.id, id))
      .returning();
    return updatedTrip || null;
  }

  async getTrip(id: number): Promise<Trip | undefined> {
    const [trip] = await db.select().from(trips).where(eq(trips.id, id));
    return trip;
  }

  async listTrips(): Promise<Trip[]> {
    return db.select().from(trips).orderBy(desc(trips.createdAt));
  }

  async listTripsByUid(voyageUid: string, limit = 20): Promise<Trip[]> {
    return db
      .select()
      .from(trips)
      .where(eq(trips.voyageUid, voyageUid))
      .orderBy(desc(trips.createdAt))
      .limit(limit);
  }

  // Adopt an orphan trip (soft backfill) - only updates if voyageUid is currently null
  async adoptTrip(id: number, voyageUid: string): Promise<Trip | null> {
    const [updatedTrip] = await db
      .update(trips)
      .set({ voyageUid })
      .where(and(eq(trips.id, id), isNull(trips.voyageUid)))
      .returning();
    return updatedTrip || null;
  }

  // Delete trip and associated data (conversations, comments, etc.)
  async deleteTrip(id: number): Promise<void> {
    // Note: If there are foreign key constraints, they should be set to CASCADE DELETE
    // For now, just delete the trip - associated data will be orphaned
    // TODO: Add explicit cleanup for tripConversations, tripComments, etc.
    await db.delete(trips).where(eq(trips.id, id));
  }

  // Update ONLY the destination image - preserves all other fields including feasibility
  async updateTripImage(id: number, imageUrl: string): Promise<Trip | null> {
    console.log(`[Storage] updateTripImage: id=${id}`);
    const [updatedTrip] = await db
      .update(trips)
      .set({
        destinationImageUrl: imageUrl,
        updatedAt: new Date(),
      })
      .where(eq(trips.id, id))
      .returning();
    return updatedTrip || null;
  }

  async updateTripFeasibility(id: number, status: string, report: FeasibilityReport | null, error?: string): Promise<Trip> {
    console.log(`[Storage] updateTripFeasibility: id=${id}, status=${status}`);

    try {
      const [result] = await db
        .update(trips)
        .set({
          feasibilityStatus: status,
          feasibilityReport: report,
          feasibilityError: error || null,
        })
        .where(eq(trips.id, id))
        .returning();

      if (!result) {
        console.error(`[Storage] ERROR: Trip ${id} not found after update`);
        throw new Error(`Trip ${id} not found after update`);
      }
      console.log(`[Storage] Update successful: ${result.feasibilityStatus}`);
      return result;
    } catch (err) {
      console.error(`[Storage] updateTripFeasibility FAILED:`, err);
      throw err;
    }
  }

  async setTripFeasibilityPending(id: number): Promise<Trip> {
    console.log(`[Storage] setTripFeasibilityPending: id=${id}`);
    const [updatedTrip] = await db
      .update(trips)
      .set({
        feasibilityStatus: 'pending',
        feasibilityError: null,
        feasibilityLastRunAt: new Date(),
      })
      .where(eq(trips.id, id))
      .returning();
    return updatedTrip;
  }

  async updateTripItinerary(id: number, itinerary: any): Promise<Trip> {
    const [updatedTrip] = await db
      .update(trips)
      .set({ itinerary })
      .where(eq(trips.id, id))
      .returning();
    return updatedTrip;
  }
}
// Always use PostgreSQL (Supabase) - no in-memory fallback
export const storage: IStorage = new DatabaseStorage();
