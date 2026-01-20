# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VoyageAI is an AI-powered travel planning application that analyzes trip feasibility, generates personalized itineraries, and provides real-time travel insights. The core value proposition is the "Certainty Engine" - answering "Can I go? What will it truly cost? What's the plan?"

**Last Updated:** 2026-01-19

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (runs on port 3000) |
| `npm run build` | Build for production |
| `npm start` | Run production server |
| `npm run check` | TypeScript type checking |
| `npm run db:push` | Push database schema changes with Drizzle |

## Quick Start

```bash
# Start PostgreSQL container
docker start voyageai-postgres

# Or create new container with pgvector support
docker run -d --name voyageai-postgres \
  -e POSTGRES_USER=voyageai \
  -e POSTGRES_PASSWORD=voyageai \
  -e POSTGRES_DB=voyageai \
  -p 5432:5432 \
  pgvector/pgvector:pg15

# Enable pgvector extension (for RAG)
docker exec -it voyageai-postgres psql -U voyageai -d voyageai \
  -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Start dev server (port 3000)
DATABASE_URL="postgres://voyageai:voyageai@localhost:5432/voyageai" \
DEEPSEEK_API_KEY="sk-xxx" \
PORT=3000 npm run dev

# Push schema changes
DATABASE_URL="postgres://voyageai:voyageai@localhost:5432/voyageai" npx drizzle-kit push
```

## Documentation Index

All documentation is organized in `.claude/docs/`. Files are categorized below:

### Project Status & Planning
- **Overall Status:** @.claude/docs/project-status.md
- **Execution Plan:** @.claude/docs/EXECUTION_PLAN.md (development phases with completion dates)
- **Beta Definition:** @.claude/docs/BETA_DEFINITION.md (beta milestones)
- **Deployment Checklist:** @.claude/docs/DEPLOYMENT_CHECKLIST.md

### Core Architecture
- **Architecture:** @.claude/docs/architecture.md (current state)
- **MVP Architecture:** @.claude/docs/MVP_ARCHITECTURE.md (original vision & wireframes)
- **Website Wireframes:** @.claude/docs/WEBSITE_WIREFRAME_SPEC.md

### Features Documentation
- **Features Overview:** @.claude/docs/features-overview.md
- **Trip Results V1:** @.claude/docs/trip-results-v1.md
- **Certainty Features:** @.claude/docs/certainty-features.md
- **Certainty Breakdown Impl:** @.claude/docs/CERTAINTY_BREAKDOWN_IMPLEMENTATION.md
- **Verdict Rules:** @.claude/docs/VERDICT_RULES.md
- **Version History Impl:** @.claude/docs/VERSION_HISTORY_IMPLEMENTATION.md

### UX & UI
- **UX Improvements:** @.claude/docs/ux-improvements.md
- **UX Polish Summary:** @.claude/docs/UX_POLISH_SUMMARY.md
- **Edit Flow:** @.claude/docs/edit-flow.md

### AI & Planning
- **Change Planner:** @.claude/docs/change-planner.md
- **Change Planner Spec:** @.claude/docs/CHANGE_PLANNER_AGENT_SPEC.md
- **Director Agent:** @.claude/docs/DIRECTOR_AGENT_IMPLEMENTATION_SUMMARY.md
- **Director Agent Tests:** @.claude/docs/DIRECTOR_AGENT_TEST_RESULTS.md
- **RAG + Agentic AI:** @.claude/docs/rag-agentic.md

### Infrastructure
- **Account & Security:** @.claude/docs/account-security.md
- **Streaming System:** @.claude/docs/streaming-system.md

### Research & Testing
- **Competitive Analysis:** @.claude/docs/COMPETITIVE_ANALYSIS_2025.md
- **Browser Tests:** @.claude/docs/BROWSER_VERIFICATION_TESTS.md

---

## Tech Stack Summary

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + TypeScript + Vite + TailwindCSS + Radix UI |
| **Backend** | Express + TypeScript |
| **Database** | PostgreSQL 15 (Drizzle ORM) + pgvector for RAG |
| **AI** | Deepseek API (OpenAI SDK compatible) |
| **Embeddings** | Ollama (nomic-embed-text) or OpenAI-compatible |
| **Routing** | Wouter (client), Express (server) |
| **State** | React Query + WorkingTrip pattern |
| **Animations** | Framer Motion |
| **Maps** | Leaflet + Mapbox |

## Directory Structure

```
client/src/
  pages/              # 14 page components
    TripResultsV1.tsx   # Premium results (1,716 lines)
    CreateTrip.tsx      # Multi-step form (2,344 lines)
    ChatTripV2.tsx      # Chat planning (982 lines)
    FeasibilityResults.tsx, MyTrips.tsx, TripShareView.tsx, etc.

  components/
    results/          # Results page components (25+ files)
    results-v1/       # Day cards, activity rows
    chat/             # Chat modals and pills
    ui/               # 45+ Radix/shadcn primitives

  hooks/              # 10 custom hooks
    useItineraryStream.ts   # SSE streaming
    useChangePlanner.ts     # Change planning
    useTripViewModel.ts     # Server/working trip split
    useTripVersions.ts      # Version history

  lib/                # 20+ utilities
    verdict.ts           # GO/POSSIBLE/DIFFICULT logic
    certaintyBreakdown.ts, comparePlans.ts, analytics.ts, voyageUid.ts

server/
  index.ts            # Express entry point
  routes.ts           # Main API hub (5,573 lines)
  storage.ts          # IStorage interface + implementations
  db.ts               # PostgreSQL/SQLite abstraction

  routes/             # Feature-specific routes (15 files)
    chat.ts, changePlan.ts, versions.ts, knowledge.ts
    auth.ts, collaboration.ts, templates.ts, etc.

  services/           # Business logic (20+ files)
    aiAgent.ts           # AI travel intelligence
    changePlannerAgent.ts # Agentic change planning
    agentChat.ts         # Conversational modifications
    streamingItinerary.ts # SSE day-by-day generation
    itineraryLock.ts     # Concurrency protection
    embeddings.ts        # RAG embeddings
    visaService.ts       # Visa lookup with RAG
    feasibilityCache.ts  # LRU caching

  middleware/
    rateLimiter.ts    # Rate limiting + admin protection

shared/
  schema.ts           # 15 Drizzle tables + types
  knowledgeSchema.ts  # 2 pgvector tables for RAG

.claude/docs/         # Claude Code documentation
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DEEPSEEK_API_KEY` | Yes | API key for AI (Deepseek/OpenAI-compatible) |
| `DATABASE_URL` | Prod | PostgreSQL connection (uses SQLite if not set) |
| `ADMIN_TOKEN` | Prod | Admin token for protected endpoints (ingest, delete) |
| `NODE_ENV` | No | Set to `production` for strict security |
| `SERP_API_KEY` | No | SerpAPI for flight searches |
| `SQLITE_DB_PATH` | No | Custom SQLite path (default: ./dev.db) |
| `EMBEDDING_DIM` | No | RAG embedding dimension (default: 768) |
| `OLLAMA_URL` | No | Local Ollama for embeddings |
| `STREAMING_ITINERARY_ENABLED` | No | Enable SSE streaming (default: true) |

## Current Feature Status

| Feature | Status |
|---------|--------|
| Planning Loop | ✅ Complete |
| Verdict System | ✅ Complete |
| Change Planner | ✅ Complete |
| Streaming Itinerary | ✅ Production Ready |
| Account-lite (voyage_uid) | ✅ Complete |
| Share View | ✅ Complete |
| RAG Foundation | ✅ Complete |
| Agent Loop | 🟡 In Progress |
| **Phase 5: Production Hardening** | ✅ Complete |
| - SSE Heartbeat + Last-Event-ID | ✅ |
| - Concurrency Lock | ✅ |
| - Rate Limiting | ✅ |
| - Admin Token Protection | ✅ |
| **Phase 6: Observability & Guardrails** | ✅ Complete |
| - Stream Summary Logging | ✅ |
| - Generation Budget Guard | ✅ |
| - Metrics Endpoint | ✅ |
| - Database Persistence Bug Fix (2026-01-19) | ✅ |

## API Patterns

- All API routes prefixed with `/api`
- Trip processing is async with progress polling
- Chat endpoints support itinerary modifications with confirmation flow
- Authentication uses cookie-based sessions + `x-voyage-uid` header for anonymous users
- SSE streaming at `/api/trips/:id/itinerary/stream`

## Database Schema (17 Tables)

| Category | Tables |
|----------|--------|
| **Core** | `users`, `sessions`, `trips`, `tripConversations`, `tripVersions`, `tripAppliedPlans` |
| **Collaboration** | `tripCollaborators`, `tripComments`, `tripVotes` |
| **Travel Features** | `priceAlerts`, `packingLists`, `weatherCache` |
| **Knowledge (RAG)** | `knowledgeDocuments` (pgvector), `knowledgeSources` |

## Key Data Flows

1. **Trip Creation → Results**: `POST /api/trips` → feasibility analysis (async) → `GET /api/trips/:id/itinerary/stream` (SSE)
2. **Change Planning**: User edits → `POST /api/change-plan` → delta computation → optimistic UI update
3. **AI Chat**: `POST /api/trips/:id/chat` → propose changes → `POST /confirm` → apply changes

## Recent Bug Fixes

### Database Persistence Fix (2026-01-19)
- **Issue**: Feasibility data overwritten to `pending` after successful save
- **Cause**: `fetchAndStoreDestinationImage()` called `updateTrip()` which reset feasibility fields
- **Fix**: Added `updateTripImage()` method that only updates the image field
- **Files**: `server/storage.ts`, `server/routes.ts`
