# RAG + Agentic AI Implementation

## Status: In Progress (2026-01-20)

Adding RAG (Retrieval Augmented Generation) for cited visa answers and agentic AI for smart trip planning.

> **See also:** [Visa System Documentation](./visa-system.md) for the hybrid free + API visa lookup system.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     RAG + Agent Architecture                    │
├─────────────────────────────────────────────────────────────────┤
│  User Message                                                   │
│       ↓                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │ RAG Layer   │    │ Tool Layer  │    │ Rules Layer │        │
│  │ (pgvector)  │    │ (APIs)      │    │ (your code) │        │
│  │             │    │             │    │             │        │
│  │ • Visa docs │    │ • Flights   │    │ • Verdict   │        │
│  │ • Entry req │    │ • Hotels    │    │ • Certainty │        │
│  │ • Safety    │    │ • Weather   │    │ • Budget    │        │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘        │
│         └──────────────────┼──────────────────┘                │
│                            ↓                                    │
│                    ┌───────────────┐                           │
│                    │  Agent Loop   │                           │
│                    │  (DeepSeek)   │                           │
│                    └───────┬───────┘                           │
│                            ↓                                    │
│              ┌─────────────────────────────┐                   │
│              │  Structured Output          │                   │
│              │  { ui: [...], text, cite }  │                   │
│              └─────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Phases

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1** | Quick wins (due dates, caching) | ✅ Complete |
| **Phase 2** | RAG foundation (pgvector, knowledge base) | ✅ Complete |
| **Phase 2.5** | Visa System (free dataset + API enrichment) | ✅ Complete |
| **Phase 3** | Agent loop with tools | 🟡 In Progress |

---

## Phase 1: Quick Wins

### 1A. Due Date Calculator ✅

**File:** `server/services/dueDates.ts`

Computes "Apply visa by X date" based on travel date and processing time:
- `computeApplyByDate()` - returns ISO date string
- `computeDueDate()` - returns full result with urgency level
- `parseTravelStartDate()` - parses various date formats
- `buildVisaDueDates()` - convenience function for visa action items

```typescript
// Usage
import { buildVisaDueDates } from './services/dueDates';

const dueDate = buildVisaDueDates(visaDetails, trip.dates);
// Returns: { applyByDate: "2026-01-08", urgency: "urgent", recommendation: "Apply within this week" }
```

---

## Phase 2: RAG Foundation

### Environment Variables (Required)

```bash
# Add to .env
EMBEDDING_DIM=768                    # Must match your embedding model
OLLAMA_URL=http://localhost:11434    # Local Ollama for embeddings
```

### 2A. Enable pgvector

```bash
docker exec -it voyageai-postgres psql -U voyageai -d voyageai \
  -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 2B. Knowledge Schema

**File:** `shared/knowledgeSchema.ts`

```typescript
// Tables:
// - knowledge_sources: Where content comes from (gov, airline, curated)
// - knowledge_chunks: Searchable content pieces with embeddings

// Key fields:
// - embedding: vector(EMBEDDING_DIM) with HNSW index
// - category: 'visa' | 'entry' | 'safety' | 'transport'
// - trustLevel: 'high' | 'medium' | 'low'
```

### 2C. Embeddings Service

**File:** `server/services/embeddings.ts`

- Local: Ollama with `nomic-embed-text` (free, for dev)
- Production: OpenAI `text-embedding-3-small`
- Runtime validation ensures embedding dimensions match schema

### 2D. RAG Retrieval Endpoint

**File:** `server/routes/knowledge.ts`

```
POST /api/knowledge/search
  Body: { query: string, filters?: { category, destination, passport } }
  Returns: { chunks: Array<{ chunkText, title, url, sourceName, trustLevel, score }> }
```

Uses Drizzle's `cosineDistance()` helper for pgvector queries.

---

## Phase 2.5: Visa System ✅

**Full documentation:** [visa-system.md](./visa-system.md)

### Overview

Hybrid visa lookup using free Passport Index dataset (39,601 routes) as primary source, with optional RapidAPI enrichment.

### Key Files

| File | Purpose |
|------|---------|
| `server/services/passportIndexService.ts` | FREE visa lookup |
| `server/services/passportIndexUpdater.ts` | Auto-update from GitHub |
| `server/services/visaApiService.ts` | RapidAPI enrichment |
| `server/data/passport-index.csv` | Static dataset |

### Endpoints

```
GET /api/knowledge/visa/check?passport=India&destination=Thailand
    → FREE instant lookup (source: passport_index)

GET /api/knowledge/visa/check?passport=India&destination=Thailand&enrich=true
    → RapidAPI for embassy links, exchange rates (costs 1 API call)

GET /api/knowledge/visa/index-stats
    → Dataset freshness and stats

POST /api/knowledge/visa/update-index  (admin)
    → Manual refresh from GitHub
```

### Auto-Update

- On startup: Checks if dataset > 7 days old, updates if stale
- GitHub source updated every 2-4 weeks by maintainer
- Zero cost for updates (just downloads CSV)

---

## Phase 3: Agent Loop (In Progress)

### Tool Definitions

```typescript
// server/services/agentTools.ts
- getVisaFactsRAG: Get visa info with citations
- computeVerdict: Run certainty engine
- getFlightEstimate: Fetch flight pricing
- getHotelEstimate: Fetch hotel pricing
- getWeather: Seasonal weather summary
```

### Agent Endpoint

```
POST /api/trips/:id/assistant
  Body: { message: string }
  Returns: { ui: { cards: [...] }, text: string, citations: [...] }
```

---

## Local Development Setup

```bash
# 1. Database (Supabase recommended)
# - Create project at supabase.com
# - Enable pgvector in SQL Editor: CREATE EXTENSION IF NOT EXISTS vector;
# - Add DATABASE_URL to .env (use pooler connection string)

# 2. Optional: Install Ollama for local embeddings (macOS)
brew install ollama
ollama pull nomic-embed-text  # 768-dim embeddings
ollama serve  # Runs on localhost:11434

# 3. Set environment variables in .env
DATABASE_URL="postgresql://..."  # From Supabase
DEEPSEEK_API_KEY="sk-..."
EMBEDDING_DIM=768
OLLAMA_URL=http://localhost:11434  # Optional

# 4. Push schema changes
npx drizzle-kit push

# 5. Start server (visa dataset auto-downloads on first run)
npm run dev
```

---

## Files Created/Modified

| File | Purpose | Status |
|------|---------|--------|
| `server/services/dueDates.ts` | Due date calculator | ✅ Created |
| `shared/knowledgeSchema.ts` | pgvector tables | ✅ Created |
| `server/services/embeddings.ts` | Ollama/OpenAI embeddings | ✅ Created |
| `server/routes/knowledge.ts` | RAG search + visa endpoints | ✅ Created |
| `server/services/passportIndexService.ts` | FREE visa lookup (39k routes) | ✅ Created |
| `server/services/passportIndexUpdater.ts` | Auto-update from GitHub | ✅ Created |
| `server/services/visaApiService.ts` | RapidAPI enrichment | ✅ Created |
| `server/data/passport-index.csv` | Static visa dataset | ✅ Auto-downloaded |
| `server/services/agentTools.ts` | Agent tool definitions | 🟡 In Progress |
| `server/services/agentLoop.ts` | Agent orchestration | ⬜ Pending |
| `server/services/streamingItinerary.ts` | SSE streaming service | ✅ Production Hardened |

---

## Knowledge Ingestion

### Manual Ingestion

```bash
# Ingest a single document
npx tsx server/scripts/ingestDocument.ts \
  --url "https://example.gov/visa-requirements" \
  --category "visa" \
  --destination "Thailand" \
  --passport "USA"
```

### Source Quality Tiers

| Trust Level | Source Type | Examples |
|-------------|-------------|----------|
| High | Government, Official | state.gov, embassy sites |
| Medium | Curated, Verified | iVisa, VisaGuide |
| Low | Community, User | Travel blogs, forums |

---

## Trust Contract

RAG answers include:
1. **Source attribution** - Where the info came from
2. **Freshness indicator** - When source was last verified
3. **Confidence level** - Based on source trust tier
4. **Fallback behavior** - Defaults to safe conservative answers
