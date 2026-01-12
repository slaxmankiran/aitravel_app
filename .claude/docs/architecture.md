# Architecture

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + Radix UI
- **Backend**: Express + TypeScript
- **Database**: PostgreSQL 15 (Docker container: `voyageai-postgres`) via Drizzle ORM
- **AI**: OpenAI SDK configured for Deepseek API
- **Routing**: Wouter (client), Express (server)
- **State**: React Query for data fetching

## Development Setup
```bash
# Start PostgreSQL container
docker start voyageai-postgres

# Or create new container
docker run -d --name voyageai-postgres \
  -e POSTGRES_USER=voyageai \
  -e POSTGRES_PASSWORD=voyageai \
  -e POSTGRES_DB=voyageai \
  -p 5432:5432 \
  postgres:15-alpine

# Start dev server (port 3000)
DATABASE_URL="postgres://voyageai:voyageai@localhost:5432/voyageai" PORT=3000 npm run dev

# Push schema changes
DATABASE_URL="postgres://voyageai:voyageai@localhost:5432/voyageai" npx drizzle-kit push
```

## Directory Structure
```
client/src/
  pages/           # Page components (Home, CreateTrip, TripDetails, etc.)
  components/      # Reusable UI components
  contexts/        # React contexts (AuthContext)
  hooks/           # Custom React hooks
  lib/             # Utilities (queryClient, etc.)

server/
  index.ts         # Express server entry point
  routes.ts        # Main API routes + trip processing logic
  storage.ts       # Database operations
  db.ts            # Database connection
  routes/          # Feature-specific route handlers
  services/        # Business logic (aiAgent, flightApi, hotelApi, agentChat)

shared/
  schema.ts        # Drizzle schema + Zod validation + TypeScript types
```

## Key Data Flow

1. **Trip Creation**: `POST /api/trips` → feasibility analysis → flight/hotel search → AI itinerary generation
2. **Progress Tracking**: In-memory `tripProgressStore` tracks multi-step processing; clients poll `/api/trips/:id/progress`
3. **AI Chat**: `/api/trips/:id/chat` for itinerary modifications via natural language

## Database Schema Highlights

- `trips` - Core trip data with feasibility reports and itineraries stored as JSONB
- `users` - Authentication with optional OAuth (Google, Apple)
- `tripConversations` - Chat history per trip
- `priceAlerts` - Flight/hotel price monitoring
- Drizzle config auto-selects SQLite (local) or PostgreSQL (DATABASE_URL)

## AI Integration

- Uses OpenAI SDK pointed at Deepseek API (`DEEPSEEK_API_KEY`)
- `server/services/aiAgent.ts` - Coordinates, attractions, cost estimates, destination intelligence
- `server/services/agentChat.ts` - Conversational itinerary modifications
- `server/routes.ts` - Feasibility analysis and itinerary generation prompts

## Certainty Score System (MVP)

The app calculates a 0-100 certainty score based on:
- Accessibility (0-25 pts)
- Visa requirements (0-30 pts) - weighted higher
- Safety (0-25 pts)
- Budget adequacy (0-20 pts)

Types defined in `shared/schema.ts`: `CertaintyScore`, `VisaDetails`, `VisaTiming`, `EntryCosts`, `TrueCostBreakdown`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DEEPSEEK_API_KEY` | Yes | API key for AI (Deepseek/OpenAI-compatible) |
| `SERP_API_KEY` | No | SerpAPI for flight searches |
| `DATABASE_URL` | No | PostgreSQL connection (uses SQLite if not set) |
| `SQLITE_DB_PATH` | No | Custom SQLite path (default: ./dev.db) |
| `EMBEDDING_DIM` | No | RAG embedding dimension (default: 768) |
| `OLLAMA_URL` | No | Local Ollama for embeddings |

## API Patterns

- All API routes prefixed with `/api`
- Trip processing is async with progress polling
- Chat endpoints support itinerary modifications with confirmation flow
- Authentication uses cookie-based sessions
