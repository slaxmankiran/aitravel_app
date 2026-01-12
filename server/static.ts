import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { storage } from "./storage";

// ============================================================================
// OG META TAGS FOR SHARE PAGES (Production)
// ============================================================================

/**
 * Generate OG meta tags for a shared trip.
 */
function generateShareOGTags(trip: {
  destination: string;
  startDate?: string | null;
  endDate?: string | null;
  groupSize?: number | null;
  travelStyle?: string | null;
}): string {
  const title = `${trip.destination} Trip | VoyageAI`;
  const description = `AI-powered travel plan for ${trip.destination}. ${trip.groupSize || 1} traveler${(trip.groupSize || 1) > 1 ? 's' : ''}, ${trip.travelStyle || 'moderate'} style. Plan your own trip with VoyageAI.`;

  return `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:site_name" content="VoyageAI" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
  `;
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", async (req, res) => {
    const url = req.originalUrl;
    const indexPath = path.resolve(distPath, "index.html");

    // Check if this is a share page request
    const shareMatch = url.match(/^\/share\/(\d+)/);
    if (shareMatch) {
      const tripId = parseInt(shareMatch[1], 10);
      try {
        const trip = await storage.getTrip(tripId);
        if (trip) {
          // Read index.html and inject OG tags
          let html = fs.readFileSync(indexPath, "utf-8");
          const ogTags = generateShareOGTags({
            destination: trip.destination,
            startDate: trip.startDate,
            endDate: trip.endDate,
            groupSize: trip.groupSize,
            travelStyle: trip.travelStyle,
          });
          html = html.replace('</head>', `${ogTags}</head>`);
          return res.status(200).set({ "Content-Type": "text/html" }).send(html);
        }
      } catch (err) {
        console.error('[OGTags] Failed to fetch trip:', err);
      }
    }

    // Default: serve index.html
    res.sendFile(indexPath);
  });
}
