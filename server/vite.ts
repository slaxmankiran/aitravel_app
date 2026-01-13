import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { storage } from "./storage";

// ============================================================================
// OG META TAGS FOR SHARE PAGES
// ============================================================================

/**
 * Generate OG meta tags for a shared trip.
 * These are injected into index.html for social media previews.
 */
function generateShareOGTags(trip: {
  destination: string;
  dates?: string | null;
  groupSize?: number | null;
  travelStyle?: string | null;
}): string {
  const title = `${trip.destination} Trip | VoyageAI`;
  const description = `AI-powered travel plan for ${trip.destination}. ${trip.groupSize || 1} traveler${(trip.groupSize || 1) > 1 ? 's' : ''}, ${trip.travelStyle || 'moderate'} style. Plan your own trip with VoyageAI.`;
  const url = "https://voyageai.app"; // Replace with actual domain

  return `
    <title>${title}</title>
    <meta name="description" content="${description}" />

    <!-- Open Graph -->
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:site_name" content="VoyageAI" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
  `;
}

/**
 * Check if request is from a social media crawler.
 */
function isSocialCrawler(userAgent: string): boolean {
  const crawlers = [
    'facebookexternalhit',
    'Facebot',
    'Twitterbot',
    'LinkedInBot',
    'WhatsApp',
    'Slackbot',
    'TelegramBot',
    'Discord',
    'Googlebot',
    'bingbot',
  ];
  return crawlers.some(crawler => userAgent.toLowerCase().includes(crawler.toLowerCase()));
}

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );

      // Inject OG meta tags for share pages (for social media crawlers)
      const shareMatch = url.match(/^\/share\/(\d+)/);
      if (shareMatch) {
        const tripId = parseInt(shareMatch[1], 10);
        try {
          const trip = await storage.getTrip(tripId);
          if (trip) {
            const ogTags = generateShareOGTags({
              destination: trip.destination,
              dates: trip.dates,
              groupSize: trip.groupSize,
              travelStyle: trip.travelStyle,
            });
            // Inject OG tags into <head>
            template = template.replace('</head>', `${ogTags}</head>`);
          }
        } catch (err) {
          console.error('[OGTags] Failed to fetch trip:', err);
          // Continue without OG tags
        }
      }

      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
