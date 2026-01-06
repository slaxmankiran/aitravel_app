# VoyageAI - AI-Powered Travel Planner

An intelligent travel planning application that uses AI to analyze trip feasibility, generate personalized itineraries, and provide real-time travel insights.

![VoyageAI](https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=800)

## Features

### Core Features
- **AI-Powered Itinerary Generation** - Get personalized day-by-day travel plans with activities, timings, and cost estimates
- **Feasibility Analysis** - Automatic visa requirements check, budget validation, and safety assessments
- **Real-Time Pricing** - Live flight and hotel prices from external APIs
- **Interactive Chatbot** - Modify your itinerary through natural conversation
- **Multi-Currency Support** - Plan trips in your preferred currency (USD, EUR, GBP, CAD, AUD, etc.)

### Trip Planning
- Smart destination autocomplete with 100+ major cities
- Flexible date selection with calendar picker
- Group travel support (adults, children, infants)
- Budget analysis with detailed cost breakdown

### Itinerary Features
- Day-by-day activity planning
- Interactive map with location markers
- Cost breakdown per category (flights, hotels, food, activities)
- PDF export with professional formatting
- Share functionality

### AI Chat Assistant
- Natural language trip modifications
- Add/remove/update activities
- Budget recommendations
- Local tips and suggestions

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **TailwindCSS** for styling
- **Framer Motion** for animations
- **Radix UI** for accessible components
- **React Query** for data fetching
- **Wouter** for routing
- **Leaflet** for interactive maps
- **Recharts** for data visualization

### Backend
- **Node.js** with Express
- **TypeScript** for type safety
- **Drizzle ORM** for database operations
- **SQLite/PostgreSQL** database support
- **OpenAI SDK** (configured for Deepseek API)

### APIs & Services
- **Deepseek AI** for itinerary generation and chat
- **SerpAPI** for flight searches
- **Google Hotels API** for accommodation pricing

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Deepseek API key (or OpenAI-compatible API)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/slaxmankiran/aitravel_app.git
   cd aitravel_app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:
   ```env
   DEEPSEEK_API_KEY=your_deepseek_api_key
   SERP_API_KEY=your_serpapi_key (optional, for live flight prices)
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Run production server |
| `npm run check` | TypeScript type checking |
| `npm run db:push` | Push database schema changes |

## Project Structure

```
aitravel_app/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── contexts/       # React contexts (Auth, etc.)
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utility functions
│   │   └── pages/          # Page components
│   │       ├── Home.tsx
│   │       ├── CreateTrip.tsx
│   │       └── TripDetails.tsx
├── server/                 # Backend Express server
│   ├── routes/             # API route handlers
│   │   ├── auth.ts
│   │   ├── chat.ts
│   │   └── ...
│   ├── services/           # Business logic services
│   │   ├── agentChat.ts    # AI chat functionality
│   │   ├── flightApi.ts    # Flight search API
│   │   └── hotelApi.ts     # Hotel search API
│   ├── routes.ts           # Main routes & trip processing
│   ├── storage.ts          # Database operations
│   └── index.ts            # Server entry point
├── shared/                 # Shared types and schemas
│   └── schema.ts           # Zod schemas & TypeScript types
└── migrations/             # Database migrations
```

## Key Components

### Trip Creation Flow
1. **Profile Step** - Select nationality and residence
2. **Destination Step** - Choose destination with autocomplete
3. **Budget Step** - Set budget, currency, travel dates, and group size
4. **Analysis** - AI analyzes feasibility and generates itinerary

### Feasibility Analysis
The AI evaluates:
- **Visa Requirements** - Based on passport and destination
- **Budget Adequacy** - Compares budget with estimated costs
- **Safety Assessment** - Travel advisories and recommendations

### JSON Parsing
Robust JSON parser handles truncated AI responses with multiple repair strategies:
- Bracket balancing
- Incomplete property cleanup
- Activity extraction fallback

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/trips` | POST | Create new trip |
| `/api/trips/:id` | GET | Get trip details |
| `/api/trips/:id/progress` | GET | Get analysis progress |
| `/api/trips/:id/chat` | POST | Send chat message |
| `/api/trips/:id/chat/confirm` | POST | Confirm chat changes |
| `/api/auth/me` | GET | Get current user |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DEEPSEEK_API_KEY` | Yes | API key for Deepseek AI |
| `SERP_API_KEY` | No | SerpAPI key for flight searches |
| `PORT` | No | Server port (default: 3000) |
| `USE_IN_MEMORY_DB` | No | Use in-memory SQLite for testing |
| `DATABASE_URL` | No | PostgreSQL connection string |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Deepseek](https://deepseek.com) for AI capabilities
- [Pexels](https://pexels.com) for stock images and videos
- [Radix UI](https://radix-ui.com) for accessible components
- [TailwindCSS](https://tailwindcss.com) for styling utilities

---

Built with AI assistance from [Claude Code](https://claude.ai/claude-code)
