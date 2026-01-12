# Features & Functionalities Overview

## Core Value Proposition: "Certainty Engine"

> *Can I go? What will it truly cost? What's the plan?*

---

## Key Features

### 1. Trip Planning

| Feature              | Description                                                                              |
|----------------------|------------------------------------------------------------------------------------------|
| Smart Trip Creation  | Destination autocomplete, date picker, traveler composition, budget, travel style        |
| Feasibility Analysis | Visa requirements, safety checks, budget validation, accessibility                       |
| Certainty Score      | 0-100 score based on visa (30pts), accessibility (25pts), safety (25pts), budget (20pts) |
| AI Itinerary         | Day-by-day plans with activities, costs, transport, local food recommendations           |

### 2. AI Chat Assistant

| Feature                 | Description                                            |
|-------------------------|--------------------------------------------------------|
| Itinerary Modifications | "Add a cooking class", "Remove Day 3 morning activity" |
| Pending Changes         | Confirm/reject AI suggestions before applying          |
| Nearby Suggestions      | AI recommends attractions near your activities         |
| Quick Actions           | One-click activity swaps, duration changes             |

### 3. Collaboration

| Feature              | Description                                      |
|----------------------|--------------------------------------------------|
| Invite Collaborators | Share via email with roles (owner/editor/viewer) |
| Comments             | Day-level and activity-level discussions         |
| Voting               | Thumbs up/down on activities                     |

### 4. Travel Tools

| Feature          | Description                                        |
|------------------|----------------------------------------------------|
| Price Alerts     | Set target prices for flights/hotels, get notified |
| Packing Lists    | AI-generated based on climate & activities         |
| Weather Forecast | 7-14 day forecasts with packing tips               |
| Travel Insurance | Compare quotes from SafetyWing, Allianz, etc.      |

### 5. Discovery

| Feature          | Description                                           |
|------------------|-------------------------------------------------------|
| Explore Page     | Browse by category (Beach, City, Adventure, Food)     |
| Inspiration Page | Pre-built trip templates (Cherry Blossom Japan, etc.) |
| Saved Places     | Bookmark attractions & templates                      |

### 6. User Accounts

| Feature       | Description                                  |
|---------------|----------------------------------------------|
| Auth          | Email/password + Google/Apple OAuth          |
| Subscriptions | Free (3 trips/mo), Pro ($9.99/mo unlimited)  |
| Preferences   | Currency, home airport, travel style profile |

---

## User Flow Chart

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              VOYAGEAI USER FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌──────────┐
                                    │  START   │
                                    └────┬─────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
            ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
            │  Home Page   │    │   Explore    │    │ Inspiration  │
            │  (Landing)   │    │  (Browse)    │    │ (Templates)  │
            └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
                   │                   │                   │
                   └───────────────────┼───────────────────┘
                                       ▼
                              ┌────────────────┐
                              │  CREATE TRIP   │
                              │    /create     │
                              └────────┬───────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │         STEP 1: Passport            │
                    │         STEP 2: Destination + Dates │
                    │         STEP 3: Budget + Style      │
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼
                         ┌─────────────────────────┐
                         │   FEASIBILITY ANALYSIS  │
                         │   (AI Processing ~8s)   │
                         │                         │
                         │  • Visa requirements    │
                         │  • Safety assessment    │
                         │  • Budget validation    │
                         │  • Accessibility check  │
                         └────────────┬────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
      ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
      │  VERDICT:   │         │  VERDICT:   │         │  VERDICT:   │
      │     GO      │         │  POSSIBLE/  │         │     NO      │
      │  (Score 80+)│         │  DIFFICULT  │         │ (Blockers)  │
      └──────┬──────┘         └──────┬──────┘         └──────┬──────┘
             │                       │                       │
             │                       ▼                       ▼
             │               ┌─────────────┐         ┌─────────────┐
             │               │ ACTION ITEMS│         │ ALTERNATIVES│
             │               │ • Apply visa│         │ Suggested   │
             │               │ • Get insur.│         │ destinations│
             │               └──────┬──────┘         └─────────────┘
             │                      │
             └──────────────────────┼
                                    ▼
                     ┌──────────────────────────┐
                     │   GENERATE ITINERARY     │
                     │   (AI Processing ~15s)   │
                     │                          │
                     │  • Day-by-day activities │
                     │  • Cost breakdown        │
                     │  • Transport options     │
                     │  • Local food spots      │
                     └────────────┬─────────────┘
                                  │
                                  ▼
           ┌──────────────────────────────────────────────────┐
           │              TRIP RESULTS V1                     │
           │              /trips/:id/results-v1               │
           │                                                  │
           │  ┌─────────────────┐  ┌────────────────────────┐ │
           │  │  LEFT COLUMN    │  │     RIGHT COLUMN       │ │
           │  │  Day Cards      │  │  Interactive Map       │
           │  │  • Day 1        │  │  True Cost Panel       │
           │  │    - Morning    │  │  Action Items          │
           │  │    - Afternoon  │  │  AI Chat Panel         │
           │  │    - Evening    │  │                        │
           │  └─────────────────┘  └────────────────────────┘ │
           └──────────────────────────────────────────────────┘
```

---

## API Endpoints Summary

| Category      | Count | Key Endpoints                                         |
|---------------|-------|-------------------------------------------------------|
| Trips         | 9     | `POST /api/trips`, `GET /api/trips/:id`, `/progress`, `/chat`, `/my-trips` |
| Auth          | 9     | `/register`, `/login`, `/logout`, `/google`, `/apple` |
| Collaboration | 5     | `/collaborators`, `/comments`, `/votes`               |
| Price Alerts  | 4     | CRUD operations                                       |
| Analytics     | 8     | `/trip-events`, `/affiliate-click`, `/dashboard`      |
| Templates     | 4     | List, get, use, rate                                  |
| Versions      | 4     | `GET/POST /api/trips/:id/versions`, `/restore`        |

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

---

## Current Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| Planning Loop | ✅ Complete | Feasibility → Itinerary → Results |
| Compare Plans | ✅ Complete | Side-by-side modal |
| Guided Fixes | ✅ Complete | Auto-suggest next fix |
| Versions | ✅ Complete | Version history panel |
| Exports | ✅ Complete | PDF with certainty breakdown |
| My Trips | ✅ Complete | Account-lite with voyage_uid |
| Ownership Guards | ✅ Complete | Soft security for trips |
| Verdict System | ✅ Complete | GO/POSSIBLE/DIFFICULT with override rules |
| Streaming Skeletons | ✅ Complete | Progressive reveal, no blank screens |
| Budget Alerts | ✅ Complete | Decision-grade right rail with suggestion chips |
| Share View | ✅ Complete | Public read-only with OG tags |
| Streaming Itinerary | ✅ Complete | SSE day-by-day generation |
