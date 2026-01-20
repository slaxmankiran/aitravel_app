# VoyageAI Deployment Checklist

> **Your ship is ready to sail! 🚀**
>
> This guide walks you through deploying VoyageAI to production with zero surprises.

---

## 📋 Pre-Deployment Verification

### ✅ 1. Image Hydration (Director Agent)

**Status:** ✅ COMPLETE

The Director Agent now automatically fetches images for new activities:

- **Files Modified:**
  - `server/services/changePlannerAgent.ts` - Image hydration for change plans
  - `server/services/agentChat.ts` - Image hydration when activities are added

- **How it works:**
  - Uses Unsplash API to fetch relevant images based on activity name
  - Runs in parallel with 1-second timeout per image
  - Falls back to placeholder if fetch fails
  - Non-blocking: won't slow down responses

- **Required Environment Variable:**
  ```bash
  UNSPLASH_ACCESS_KEY=<your-key>  # Get from https://unsplash.com/developers
  ```

---

## 🏗️ Build Process

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Build for Production

```bash
npm run build
```

This command runs:
1. `npm install` - Ensures all dependencies are installed
2. `npm run build:client` - Builds the Vite frontend
3. `npm run build:server` - Compiles TypeScript backend

### Step 3: Verify Build Output

Check that these directories exist:
- `dist/` - Compiled backend
- `dist/public/` - Built frontend assets

---

## 🔐 Environment Variables

### Critical Variables (MUST SET)

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `DATABASE_URL` | PostgreSQL connection string | Your database provider (e.g., Supabase, Railway) |
| `DEEPSEEK_API_KEY` | AI API key for Director Agent | https://platform.deepseek.com/api_keys |
| `NODE_ENV` | Set to `production` | Hardcoded as `production` |

### Feature-Specific Variables

| Variable | Feature | Required? | Where to Get It |
|----------|---------|-----------|-----------------|
| `UNSPLASH_ACCESS_KEY` | Activity Images | 🟡 Recommended | https://unsplash.com/developers |
| `VITE_MAPBOX_TOKEN` | 3D Map Globe | 🔴 Critical | https://account.mapbox.com/ |
| `JINA_API_KEY` | "Start Anywhere" URL Scraper | 🟢 Optional | https://jina.ai/ |
| `SERPAPI_KEY` | Live Flight Prices | 🟢 Optional | https://serpapi.com/ |
| `ADMIN_TOKEN` | Protected Admin Endpoints | 🔴 Critical | Generate a secure random string |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `STREAMING_ITINERARY_ENABLED` | true | Enable SSE streaming |
| `EMBEDDING_DIM` | 768 | RAG embedding dimension |
| `OLLAMA_URL` | - | Local embeddings (dev only) |

---

## 🗄️ Database Setup

### Step 1: Enable pgvector Extension

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Step 2: Run Migrations

```bash
DATABASE_URL="<your-production-db-url>" npx drizzle-kit push
```

This creates all necessary tables:
- `trips` - Core trip data
- `users` - User accounts
- `knowledge_sources` & `knowledge_chunks` - RAG data
- `trip_conversations` - Chat history
- And more...

### Step 3: Verify Tables

Connect to your database and run:

```sql
\dt  -- List all tables
```

You should see ~10 tables including `trips`, `users`, `knowledge_sources`, etc.

---

## 🚀 Deployment Platforms

### Option 1: Replit (Simplest) ⭐ RECOMMENDED

**Pros:**
- Already running here
- Auto-detects Node + PostgreSQL
- One-click deploy

**Setup:**
1. Click "Deploy" button in Replit
2. Add environment variables in Secrets tab
3. Connect PostgreSQL database (Replit provides one)
4. Deploy!

**Cost:** Free tier available, $7/mo for always-on

---

### Option 2: Railway (Best for Scaling)

**Pros:**
- Auto-detects monorepo structure
- Built-in PostgreSQL
- Generous free tier

**Setup:**

1. **Install Railway CLI:**
   ```bash
   npm i -g @railway/cli
   railway login
   ```

2. **Initialize Project:**
   ```bash
   railway init
   ```

3. **Add PostgreSQL:**
   ```bash
   railway add postgresql
   ```

4. **Deploy:**
   ```bash
   railway up
   ```

5. **Add Environment Variables:**
   ```bash
   railway variables set DEEPSEEK_API_KEY=sk-...
   railway variables set UNSPLASH_ACCESS_KEY=...
   # Add all other variables from the table above
   ```

6. **Run Migrations:**
   ```bash
   railway run npx drizzle-kit push
   ```

**Cost:** $5/mo for starter plan

---

### Option 3: Vercel + Supabase (Split Stack)

**Best for:**
- Serverless architecture
- Global CDN distribution
- Separate concerns (frontend/backend/database)

**Setup:**

#### 3.1: Deploy Frontend to Vercel

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Configure Build:**
   ```bash
   vercel --cwd client
   ```

3. **Set Environment Variables in Vercel Dashboard:**
   - `VITE_MAPBOX_TOKEN`
   - `VITE_API_URL` (your backend URL)

#### 3.2: Deploy Backend to Render/Railway

1. **Create `Dockerfile` (if not exists):**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --production
   COPY . .
   RUN npm run build
   CMD ["npm", "start"]
   ```

2. **Deploy to Render:**
   - Connect GitHub repo
   - Select "Docker" service
   - Add all environment variables
   - Deploy!

#### 3.3: Setup Supabase Database

1. Create project at https://supabase.com
2. Copy `DATABASE_URL` from Settings → Database
3. Run migrations:
   ```bash
   DATABASE_URL="<supabase-url>" npx drizzle-kit push
   ```

**Cost:**
- Vercel: Free for hobby projects
- Render: $7/mo for starter
- Supabase: Free tier (500MB)

---

## 🔒 Security Checklist

### Before Going Live:

- [ ] Set `NODE_ENV=production`
- [ ] Generate secure `ADMIN_TOKEN` (32+ characters)
- [ ] Enable CORS only for your frontend domain
- [ ] Set up HTTPS (most platforms do this automatically)
- [ ] Review API rate limits in `server/middleware/rateLimiter.ts`
- [ ] Test authentication flows (OAuth, email/password)
- [ ] Verify database backups are enabled

### Recommended Security Additions:

```typescript
// server/index.ts - Add CORS configuration for production
import cors from 'cors';

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? 'https://your-domain.com'
    : '*',
  credentials: true
}));
```

---

## 🧪 Post-Deployment Testing

### 1. Health Check Endpoints

```bash
# Basic health
curl https://your-app.com/api/health

# Database connection
curl https://your-app.com/api/trips
```

### 2. Critical User Flows

Test these flows manually:

1. **Trip Creation:**
   - Create trip → Should show feasibility analysis within 10s
   - Verify images load for activities

2. **Director Agent (Change Planner):**
   - Edit trip details → Should trigger change analysis
   - New activities should have images

3. **AI Chat:**
   - Add activity via chat → Should hydrate with image
   - Verify no duplicate activities

4. **Streaming Itinerary:**
   - Create new trip → First day should appear in 5-10s
   - Verify SSE connection stays alive (15s heartbeats)

### 3. Performance Benchmarks

```bash
# Measure trip creation time
time curl -X POST https://your-app.com/api/trips \
  -H "Content-Type: application/json" \
  -d '{"destination": "Paris, France", "budget": 2000, ...}'

# Expected: < 12 seconds for full trip generation
```

---

## 📊 Monitoring Setup (Optional but Recommended)

### Option 1: Built-in Logging

VoyageAI has structured JSON logging:

```json
{
  "type": "stream_summary",
  "tripId": 123,
  "status": "complete",
  "totalDays": 7,
  "generatedDays": 7,
  "timeToFirstDayMs": 5200,
  "totalMs": 45000
}
```

View logs:
- **Railway:** `railway logs`
- **Render:** Dashboard → Logs tab
- **Replit:** Console tab

### Option 2: Error Tracking with Sentry

1. **Install:**
   ```bash
   npm install @sentry/node @sentry/tracing
   ```

2. **Initialize in `server/index.ts`:**
   ```typescript
   import * as Sentry from '@sentry/node';

   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     environment: process.env.NODE_ENV,
     tracesSampleRate: 0.1,
   });
   ```

3. **Add to environment:**
   ```bash
   SENTRY_DSN=https://...@sentry.io/...
   ```

---

## 🐛 Common Deployment Issues

### Issue 1: "Module not found" errors

**Cause:** Missing dependencies in production build

**Fix:**
```bash
npm ci --production=false
npm run build
```

### Issue 2: Database connection fails

**Cause:** Incorrect `DATABASE_URL` or missing pgvector extension

**Fix:**
```bash
# Test connection
psql $DATABASE_URL -c "SELECT version();"

# Enable pgvector
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Issue 3: Images not loading

**Cause:** Missing `UNSPLASH_ACCESS_KEY`

**Fix:**
1. Get API key from https://unsplash.com/developers
2. Add to environment variables
3. Restart server

### Issue 4: SSE streaming timeouts

**Cause:** Proxy/CDN closing long-lived connections

**Fix:**
- VoyageAI already sends 15-second heartbeats
- Check your platform's timeout settings:
  - Railway: 300s default (OK)
  - Render: 30s default (increase to 300s)
  - Vercel: 60s default (switch to Railway for backend)

### Issue 5: Build succeeds but crashes on start

**Cause:** Missing environment variables

**Fix:**
```bash
# List all required variables
grep -r "process.env" server/ | grep -v node_modules

# Verify all are set
echo $DEEPSEEK_API_KEY  # Should not be empty
echo $DATABASE_URL      # Should not be empty
```

---

## 📈 Performance Optimization

### After Initial Deployment:

1. **Enable Redis Caching (Optional):**
   ```typescript
   // server/cache.ts
   import Redis from 'ioredis';
   export const redis = new Redis(process.env.REDIS_URL);
   ```

2. **Database Indexing:**
   ```sql
   CREATE INDEX idx_trips_voyage_uid ON trips(voyage_uid);
   CREATE INDEX idx_trips_destination ON trips(destination);
   ```

3. **Image CDN:**
   - Consider Cloudinary for image hosting
   - Cache Unsplash images locally after first fetch

---

## ✅ Final Checklist

Before announcing your launch:

- [ ] All environment variables set
- [ ] Database migrations run successfully
- [ ] HTTPS enabled
- [ ] Custom domain configured (optional)
- [ ] Error tracking enabled (Sentry/Logflare)
- [ ] Backup strategy in place
- [ ] Load tested with 10+ concurrent users
- [ ] Onboarding flow tested end-to-end
- [ ] Analytics tracking verified
- [ ] Rate limits configured appropriately

---

## 🎉 You're Ready to Ship!

**Deployment Command (Railway Example):**

```bash
# One-time setup
railway login
railway init
railway add postgresql
railway variables set DATABASE_URL=$DATABASE_URL
railway variables set DEEPSEEK_API_KEY=sk-...
railway variables set UNSPLASH_ACCESS_KEY=...
railway variables set ADMIN_TOKEN=$(openssl rand -hex 32)
railway variables set NODE_ENV=production

# Deploy
railway up

# Run migrations
railway run npx drizzle-kit push

# Open in browser
railway open
```

**Expected Timeline:**
- First deploy: 5-10 minutes
- Subsequent deploys: 2-3 minutes

---

## 🆘 Need Help?

- **Logs:** Check platform-specific logging (Railway/Render/Vercel)
- **Database:** Use `psql` to inspect tables directly
- **API Testing:** Use Postman or `curl` to test endpoints
- **Community:** Replit Community, Railway Discord, r/webdev

---

## 📚 Additional Resources

- [Railway Deployment Guide](https://docs.railway.app/)
- [Vercel Deployment Docs](https://vercel.com/docs)
- [Drizzle ORM Migrations](https://orm.drizzle.team/kit-docs/overview)
- [Unsplash API Docs](https://unsplash.com/documentation)
- [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/)

---

**Last Updated:** 2026-01-13
**Author:** Claude Sonnet 4.5 (VoyageAI Development Assistant)
