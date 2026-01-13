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
// In-memory fallback for local development. When `USE_IN_MEMORY_DB` is set
// the app will not attempt to query Postgres/SQLite and will instead store
// data in memory. Useful for quickly running the app without a DB.
export class InMemoryStorage implements IStorage {
  private users: User[] = [];
  private trips: Trip[] = [];
  private nextId = 1;

  async getUser(id: number): Promise<User | undefined> {
    return this.users.find(u => u.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Note: Users table doesn't have username column, using email as fallback
    return this.users.find(u => u.email === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user: any = { id: this.nextId++, ...insertUser };
    this.users.push(user);
    return user;
  }

  async createTrip(trip: InsertTrip): Promise<Trip> {
    const newTrip: any = {
      id: this.nextId++,
      ...trip,
      feasibilityStatus: "pending",
      feasibilityReport: null,
      itinerary: null,
      createdAt: new Date().toISOString(),
    };
    this.trips.push(newTrip);
    return newTrip;
  }

  async updateTrip(id: number, tripData: Partial<InsertTrip>): Promise<Trip | null> {
    const trip = this.trips.find(t => t.id === id) as any;
    if (!trip) return null;

    // Update trip fields and reset feasibility/itinerary
    Object.assign(trip, tripData, {
      feasibilityStatus: 'pending',
      feasibilityReport: null,
      feasibilityError: null,
      itinerary: null,
      updatedAt: new Date().toISOString(),
    });
    return trip;
  }

  async getTrip(id: number): Promise<Trip | undefined> {
    return this.trips.find(t => t.id === id);
  }

  async listTrips(): Promise<Trip[]> {
    return [...this.trips].sort((a, b) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }

  async listTripsByUid(voyageUid: string, limit = 20): Promise<Trip[]> {
    return this.trips
      .filter(t => (t as any).voyageUid === voyageUid)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, limit);
  }

  // Adopt an orphan trip (soft backfill) - only updates if voyageUid is currently null
  async adoptTrip(id: number, voyageUid: string): Promise<Trip | null> {
    const trip = this.trips.find(t => t.id === id) as any;
    if (!trip) return null;
    if (trip.voyageUid !== null && trip.voyageUid !== undefined) return null; // Already owned
    trip.voyageUid = voyageUid;
    return trip;
  }

  // Delete trip from memory
  async deleteTrip(id: number): Promise<void> {
    const index = this.trips.findIndex(t => t.id === id);
    if (index !== -1) {
      this.trips.splice(index, 1);
    }
  }

  async updateTripFeasibility(id: number, status: string, report: FeasibilityReport | null, error?: string): Promise<Trip> {
    const trip = this.trips.find(t => t.id === id) as any;
    if (!trip) throw new Error("Trip not found");
    trip.feasibilityStatus = status;
    trip.feasibilityReport = report;
    trip.feasibilityError = error || null;
    return trip;
  }

  async setTripFeasibilityPending(id: number): Promise<Trip> {
    const trip = this.trips.find(t => t.id === id) as any;
    if (!trip) throw new Error("Trip not found");
    trip.feasibilityStatus = 'pending';
    trip.feasibilityError = null;
    trip.feasibilityLastRunAt = new Date();
    return trip;
  }

  async updateTripItinerary(id: number, itinerary: any): Promise<Trip> {
    const trip = this.trips.find(t => t.id === id) as any;
    if (!trip) throw new Error("Trip not found");
    trip.itinerary = itinerary;
    return trip;
  }
}

export const storage: IStorage = process.env.USE_IN_MEMORY_DB
  ? new InMemoryStorage()
  : new DatabaseStorage();
