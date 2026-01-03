# VoyageAI - AI-Powered Travel Feasibility Planner

## Overview

VoyageAI is a full-stack travel planning application that uses AI to analyze trip feasibility before generating itineraries. The app checks visa requirements, budget constraints, and safety considerations for travelers based on their passport country, destination, travel dates, and budget. The core value proposition is "feasibility-first" planning - ensuring a trip is viable before creating detailed plans.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: TanStack Query for server state, React hooks for local state
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style variant)
- **Animations**: Framer Motion for smooth transitions and reveals
- **Charts**: Recharts for budget visualization in feasibility reports
- **Forms**: React Hook Form with Zod validation via @hookform/resolvers

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **Build Tool**: esbuild for production server bundling, Vite for client
- **API Pattern**: RESTful endpoints defined in shared routes file with Zod schemas for type-safe request/response validation

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts` - contains users, trips, conversations, and messages tables
- **Migrations**: Drizzle Kit with `db:push` command for schema synchronization

### AI Integration
- **Provider**: OpenAI API (configured via Replit AI Integrations)
- **Use Cases**: 
  - Trip feasibility analysis (visa, budget, safety checks)
  - Itinerary generation for feasible trips
  - Chat functionality (optional integration module)
  - Image generation (optional integration module)
- **Environment Variables**: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`

### Project Structure
```
├── client/           # React frontend
│   └── src/
│       ├── components/   # UI components including shadcn/ui
│       ├── hooks/        # Custom React hooks
│       ├── pages/        # Route components (Home, CreateTrip, TripDetails)
│       └── lib/          # Utilities and query client
├── server/           # Express backend
│   ├── routes.ts         # API endpoint definitions
│   ├── storage.ts        # Database operations
│   └── replit_integrations/  # AI feature modules (chat, image, batch)
├── shared/           # Shared types and schemas
│   ├── schema.ts         # Drizzle database schema
│   └── routes.ts         # API route definitions with Zod schemas
└── migrations/       # Database migrations
```

### Key Design Decisions

1. **Shared Schema Pattern**: Database schema and API route definitions live in `shared/` directory, allowing type safety across frontend and backend without duplication.

2. **Feasibility-First Flow**: Trips are created with "pending" status, then AI analysis runs to determine feasibility before itinerary generation. The frontend polls for status updates.

3. **Modular AI Integrations**: AI features (chat, image generation, batch processing) are organized as separate modules in `server/replit_integrations/` for easy enabling/disabling.

4. **Component Library**: Uses shadcn/ui components (copied into `client/src/components/ui/`) for consistent, accessible UI elements with Tailwind styling.

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and schema management

### AI Services
- **OpenAI API**: Powers feasibility analysis, itinerary generation, and optional chat/image features
- **Configuration**: Uses Replit AI Integrations with custom base URL

### NPM Packages (Key Dependencies)
- **@tanstack/react-query**: Server state management and caching
- **drizzle-orm** / **drizzle-zod**: Database ORM with Zod schema generation
- **framer-motion**: Animation library for UI transitions
- **recharts**: Data visualization for budget breakdowns
- **react-hook-form**: Form state management
- **zod**: Schema validation for API contracts

### Development Tools
- **Vite**: Frontend dev server and bundler with HMR
- **esbuild**: Production server bundling
- **tsx**: TypeScript execution for development