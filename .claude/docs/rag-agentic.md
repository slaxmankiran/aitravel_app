# RAG + Agentic AI Implementation

## Status: In Progress (2026-01-12)

Adding RAG (Retrieval Augmented Generation) for cited visa answers and agentic AI for smart trip planning.

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
# 1. Enable pgvector
docker exec -it voyageai-postgres psql -U voyageai -d voyageai \
  -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 2. Install Ollama (macOS)
brew install ollama
ollama pull nomic-embed-text  # 768-dim embeddings

# 3. Start Ollama
ollama serve  # Runs on localhost:11434

# 4. Set environment
echo "EMBEDDING_DIM=768" >> .env
echo "OLLAMA_URL=http://localhost:11434" >> .env

# 5. Push schema changes
DATABASE_URL="postgres://voyageai:voyageai@localhost:5432/voyageai" npx drizzle-kit push
```

---

## Files Created/Modified

| File | Purpose | Status |
|------|---------|--------|
| `server/services/dueDates.ts` | Due date calculator | ✅ Created |
| `shared/knowledgeSchema.ts` | pgvector tables | ✅ Created |
| `server/services/embeddings.ts` | Ollama/OpenAI embeddings | ✅ Created |
| `server/routes/knowledge.ts` | RAG search endpoint | ✅ Created |
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
