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
  updateTripFeasibility(id: number, status: string, report: FeasibilityReport): Promise<Trip>;
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

  async updateTripFeasibility(id: number, status: string, report: FeasibilityReport): Promise<Trip> {
    const [updatedTrip] = await db
      .update(trips)
      .set({ 
        feasibilityStatus: status,
        feasibilityReport: report 
      })
      .where(eq(trips.id, id))
      .returning();
    return updatedTrip;
  }
}

export const storage = new DatabaseStorage();
