# Project: New App From Zero

## Overview

This is a monorepo containing a Node.js/Express backend API and an Expo mobile app. The backend is the primary runnable component in this Replit environment (the mobile app requires a native device/emulator).

## Architecture

- **apps/backend** — Express.js + TypeScript REST API
- **apps/mobile** — Expo (React Native) mobile app (not runnable in Replit)
- **packages/database** — Shared Prisma client (PostgreSQL/Supabase)

## Tech Stack

- **Runtime**: Node.js 20
- **Language**: TypeScript
- **Backend Framework**: Express.js
- **Database ORM**: Prisma v6 (PostgreSQL via Supabase)
- **AI**: OpenAI (gpt-4o-mini)
- **Package Manager**: npm workspaces

## Running the Project

The backend runs on port 5000 via the "Start application" workflow:

```
cd apps/backend && PORT=5000 npx ts-node-dev --respawn --transpile-only src/index.ts
```

Health check: `GET /health`

## Environment Variables Required

- `DATABASE_URL` — PostgreSQL connection string (Supabase)
- `OPENAI_API_KEY` — OpenAI API key (required for AI features)
- `OPENAI_MODEL` — Model name (default: gpt-4o-mini)
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_ANON_KEY` — Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key

## Database

Uses Prisma with PostgreSQL (Supabase). Run `npm run db:generate` to regenerate the client after schema changes, and `npm run db:push` to push schema to the database.

## Key API Routes

- `GET /health` — Health check
- `POST /api/onboarding/process` — Process onboarding data through AI
- `POST /api/checkins` — Save daily check-in
- `GET /api/checkins` — Get user check-ins
- `POST /api/planner/sync` — Sync planner timeline
- `GET /api/planner/timeline` — Get timeline blocks
- `POST /api/journal/start` — Start a journal session
- `POST /api/journal/message/stream` — Stream journal AI reply (SSE)

## Setup Notes

- The OpenAI client is lazily initialized to allow the server to start without `OPENAI_API_KEY` (AI endpoints will fail at runtime without it)
- The `packages/database` package must be built (`npm run build --workspace=@app/database`) before it can be resolved
