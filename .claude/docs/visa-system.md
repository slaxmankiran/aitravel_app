# Visa System

## Overview

VoyageAI uses a hybrid visa lookup system that prioritizes **free data** while offering **optional enrichment** via paid APIs. This design achieves 99%+ cost savings compared to API-only approaches.

**Last Updated:** 2026-01-20

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        VISA LOOKUP WATERFALL                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Request: GET /api/knowledge/visa/check?passport=India&destination=Japan │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Layer 1: Passport Index Dataset (PRIMARY)                       │    │
│  │ • Source: github.com/ilyankou/passport-index-dataset            │    │
│  │ • 39,601 routes, 199 passports                                  │    │
│  │ • Cost: FREE                                                    │    │
│  │ • Speed: ~1ms                                                   │    │
│  │ • Data: visa_free/e_visa/visa_on_arrival/visa_required + days   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              ↓ (if ?enrich=true or miss)                │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Layer 2: RapidAPI Visa Requirement (ENRICHMENT)                 │    │
│  │ • Source: rapidapi.com/TravelBuddyAI/api/visa-requirement       │    │
│  │ • Cost: 120 requests/month free (Basic tier)                    │    │
│  │ • Speed: ~800ms                                                 │    │
│  │ • Data: embassy links, exchange rates, apply URLs, processing   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              ↓ (cached in knowledge base)               │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Layer 3: Knowledge Base Cache                                   │    │
│  │ • Enriched results cached for 30 days                           │    │
│  │ • pgvector embeddings for semantic search                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `server/services/passportIndexService.ts` | FREE visa lookup (39k routes) |
| `server/services/passportIndexUpdater.ts` | Auto-update from GitHub |
| `server/services/visaApiService.ts` | RapidAPI enrichment |
| `server/data/passport-index.csv` | Static dataset (downloaded from GitHub) |
| `server/data/passport-index-metadata.json` | Update tracking (gitignored) |

## API Endpoints

### Primary Lookup (FREE)

```
GET /api/knowledge/visa/check?passport=India&destination=Thailand
```

**Response:**
```json
{
  "success": true,
  "data": {
    "passportCountry": "India",
    "passportCode": "IN",
    "destinationCountry": "Thailand",
    "destinationCode": "TH",
    "visaType": "visa_free",
    "visaName": "Visa Free (60 days)",
    "duration": "60 days",
    "source": "passport_index",
    "visaTypeLabel": "Visa Free (60 days)"
  }
}
```

### Enriched Lookup (Uses 1 API call)

```
GET /api/knowledge/visa/check?passport=India&destination=Thailand&enrich=true
```

**Response (additional fields):**
```json
{
  "success": true,
  "data": {
    "passportCountry": "India",
    "passportCode": "IN",
    "destinationCountry": "Thailand",
    "destinationCode": "TH",
    "visaType": "visa_free",
    "visaName": "Visa not required",
    "duration": "60 days",
    "passportValidity": "6 months",
    "currency": "Thai Baht",
    "exchangeRate": "61.0196",
    "capital": "Bangkok",
    "timezone": "+07:00",
    "embassyUrl": "https://www.embassypages.com/india#titlePlaceholder2",
    "mandatoryRegistration": "Arrival Card",
    "source": "api",
    "visaTypeLabel": "Visa Free"
  }
}
```

### Dataset Status

```
GET /api/knowledge/visa/index-stats
```

**Response:**
```json
{
  "success": true,
  "source": "passport_index_dataset",
  "description": "Free visa requirements data from https://github.com/ilyankou/passport-index-dataset",
  "stats": {
    "totalRoutes": 39601,
    "passports": 199,
    "loadedAt": "2026-01-20T06:01:44.002Z"
  },
  "datasetStatus": {
    "lastUpdated": "2026-01-20T06:01:43.920Z",
    "ageInDays": 0,
    "isStale": false,
    "recommendation": "Dataset is fresh"
  }
}
```

### Manual Update (Admin)

```
POST /api/knowledge/visa/update-index
```

Downloads latest dataset from GitHub (FREE, no API quota used).

**Response:**
```json
{
  "success": true,
  "message": "Dataset updated: 39,601 visa routes loaded",
  "rowCount": 39601,
  "previousRowCount": 39601,
  "change": 0
}
```

## Visa Status Types

| Status | Meaning | Example |
|--------|---------|---------|
| `visa_free` | No visa required, days allowed | India → Thailand (60 days) |
| `e_visa` | Electronic visa available | India → Australia |
| `eta` | Electronic Travel Authorization | US → Canada (eTA) |
| `visa_on_arrival` | Get visa at airport | India → Cambodia |
| `visa_required` | Must apply in advance | India → USA |
| `covid_ban` | Travel restricted | (rare) |
| `no_admission` | Entry not permitted | (rare) |

## Auto-Update Behavior

The Passport Index dataset is maintained by the community and updated every 2-4 weeks on GitHub.

**On Server Startup:**
1. Check if dataset exists → Download if missing
2. Check age of dataset → Update if > 7 days old
3. Updates run in background (non-blocking)

**Update Schedule:**
- Automatic: On startup if stale (> 7 days)
- Manual: `POST /api/knowledge/visa/update-index` (admin)
- Source updates: ~2-4 weeks on GitHub

## Cost Analysis

| Approach | Monthly Cost | Notes |
|----------|--------------|-------|
| **Hybrid (current)** | $0 | 99%+ from free dataset |
| API-only (RapidAPI Basic) | $0 (120 calls) | Would run out fast |
| API-only (RapidAPI Pro) | $4.99/mo (3,000 calls) | Still limited |
| Premium APIs (Sherpa, etc.) | $50-200/mo | Enterprise pricing |

## Integration with Feasibility Analysis

The visa lookup is used during trip feasibility analysis:

```typescript
// In server/routes.ts - feasibility analysis
const visaResult = await lookupVisa(passport, destination);

if (visaResult) {
  // Use free data for feasibility score
  const visaScore = calculateVisaScore(visaResult.status, visaResult.days);
}
```

## Country Code Mapping

The service handles various input formats:

| Input | Normalized |
|-------|------------|
| `"India"` | `india` → `IN` |
| `"IN"` | `IN` |
| `"USA"` | `united states` → `US` |
| `"United Kingdom"` | `united kingdom` → `GB` |
| `"UK"` | `united kingdom` → `GB` |

## Troubleshooting

### Dataset Not Loading

```
[PassportIndex] CSV file not found at .../passport-index.csv
```

**Fix:** The auto-updater will download it on startup. Or manually:
```bash
curl -o server/data/passport-index.csv \
  https://raw.githubusercontent.com/ilyankou/passport-index-dataset/master/passport-index-tidy.csv
```

### Unknown Country

```
[PassportIndex] Passport not found: "XYZ"
```

**Fix:** Add mapping in `passportIndexService.ts` → `COUNTRY_TO_ISO` object.

### RapidAPI Rate Limit

```
[VisaAPI] API error: 429 Too Many Requests
```

**Fix:** You've hit the 120/month limit. Wait for reset or upgrade plan. Normal lookups still work via free dataset.

## Future Improvements

1. **Wikipedia Scraping** - Alternative free data source for edge cases
2. **Processing Time Estimates** - Combine with historical data
3. **Visa Application Tracking** - Store user's visa application status
4. **Alert on Policy Changes** - Monitor for visa rule updates
