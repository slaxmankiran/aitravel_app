import { users, trips, type User, type InsertUser, type Trip, type InsertTrip, type FeasibilityReport } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Trip operations
  createTrip(trip: InsertTrip): Promise<Trip>;
  getTrip(id: number): Promise<Trip | undefined>;
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
    const [user] = await db.select().from(users).where(eq(users.username, username));
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

  async getTrip(id: number): Promise<Trip | undefined> {
    const [trip] = await db.select().from(trips).where(eq(trips.id, id));
    return trip;
  }

  async updateTripFeasibility(id: number, status: string, report: FeasibilityReport | null, error?: string): Promise<Trip> {
    const [updatedTrip] = await db
      .update(trips)
      .set({
        feasibilityStatus: status,
        feasibilityReport: report,
        feasibilityError: error || null,
      })
      .where(eq(trips.id, id))
      .returning();
    return updatedTrip;
  }

  async setTripFeasibilityPending(id: number): Promise<Trip> {
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
    return this.users.find(u => u.username === username);
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

  async getTrip(id: number): Promise<Trip | undefined> {
    return this.trips.find(t => t.id === id);
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
