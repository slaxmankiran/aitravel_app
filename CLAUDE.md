# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VoyageAI is an AI-powered travel planning application that analyzes trip feasibility, generates personalized itineraries, and provides real-time travel insights. The core value proposition is the "Certainty Engine" - answering "Can I go? What will it truly cost? What's the plan?"

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

# Start dev server (port 3000)
DATABASE_URL="postgres://voyageai:voyageai@localhost:5432/voyageai" PORT=3000 npm run dev

# Push schema changes
DATABASE_URL="postgres://voyageai:voyageai@localhost:5432/voyageai" npx drizzle-kit push
```

## Documentation Index

Detailed documentation is organized into topic-specific files:

### Project Status
- **Overall Status:** @.claude/docs/project-status.md

### Core Architecture & Setup
- **Architecture:** @.claude/docs/architecture.md

### Features Documentation
- **Trip Results V1:** @.claude/docs/trip-results-v1.md
- **Features Overview:** @.claude/docs/features-overview.md
- **Certainty Features:** @.claude/docs/certainty-features.md

### UX & UI
- **UX Improvements:** @.claude/docs/ux-improvements.md
- **Edit Flow:** @.claude/docs/edit-flow.md

### AI & Planning
- **Change Planner:** @.claude/docs/change-planner.md
- **RAG + Agentic AI:** @.claude/docs/rag-agentic.md

### Infrastructure
- **Account & Security:** @.claude/docs/account-security.md
- **Streaming System:** @.claude/docs/streaming-system.md

---

## Tech Stack Summary

| Layer    | Technology                                 |
|----------|--------------------------------------------|
| Frontend | React 18 + TypeScript + Vite + TailwindCSS |
| Backend  | Express + TypeScript                       |
| Database | PostgreSQL 15 (Drizzle ORM)                |
| AI       | Deepseek API (OpenAI SDK compatible)       |
| State    | React Query                                |
| Routing  | Wouter (client), Express (server)          |

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

.claude/docs/      # Claude Code documentation (imported above)
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

## API Patterns

- All API routes prefixed with `/api`
- Trip processing is async with progress polling
- Chat endpoints support itinerary modifications with confirmation flow
- Authentication uses cookie-based sessions + `x-voyage-uid` header for anonymous users
- SSE streaming at `/api/trips/:id/itinerary/stream`
