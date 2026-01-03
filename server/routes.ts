import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import { FeasibilityReport } from "@shared/schema";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.post(api.trips.create.path, async (req, res) => {
    try {
      const input = api.trips.create.input.parse(req.body);
      
      // 1. Save initial trip details
      const trip = await storage.createTrip(input);

      // 2. Trigger Async Feasibility Analysis
      // Note: In a real production app, this might be a background job.
      // Here we'll await it for simplicity or fire-and-forget if we want fast response.
      // Let's await it to return the report immediately for the UI.
      
      const prompt = `
        Analyze the feasibility of this trip:
        Passport: ${input.passport}
        Residence: ${input.residence || "Same as passport"}
        Destination: ${input.destination}
        Dates: ${input.dates}
        Budget: ${input.budget} USD
        Group Size: ${input.groupSize}

        Provide a JSON response with the following structure:
        {
          "overall": "yes" | "no" | "warning",
          "score": number (0-100),
          "breakdown": {
            "visa": { "status": "ok" | "issue", "reason": "string" },
            "budget": { "status": "ok" | "tight" | "impossible", "estimatedCost": number, "reason": "string" },
            "safety": { "status": "safe" | "caution" | "danger", "reason": "string" }
          },
          "summary": "string"
        }
        
        Strictly valid JSON.
      `;

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-5.1",
          messages: [
            { role: "system", content: "You are an expert travel feasibility analyzer. You check visa requirements, budget realism, and safety risks." },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" }
        });

        const report = JSON.parse(response.choices[0].message.content || "{}") as FeasibilityReport;
        
        // Update trip with report
        const updatedTrip = await storage.updateTripFeasibility(trip.id, report.overall, report);
        
        res.status(201).json(updatedTrip);
      } catch (aiError) {
        console.error("AI Analysis failed:", aiError);
        // Return trip without report if AI fails, client can handle pending state
        res.status(201).json(trip);
      }

    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get(api.trips.get.path, async (req, res) => {
    const trip = await storage.getTrip(Number(req.params.id));
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }
    res.json(trip);
  });

  // Seed Data
  const existingTrip = await storage.getTrip(1);
  if (!existingTrip) {
    await storage.createTrip({
      passport: "United States",
      destination: "Japan",
      dates: "2024-05-01 to 2024-05-14",
      budget: 3000,
      groupSize: 1,
    });
    console.log("Seeded database with initial trip");
  }

  return httpServer;
}
