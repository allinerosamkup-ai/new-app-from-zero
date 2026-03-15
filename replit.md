# Project: Mood Energy

## Overview

Monorepo containing a Node.js/Express backend API, an Expo mobile app, and a web-based UI/UX preview. The web preview renders all mobile app screens inside a phone frame in the browser.

## Architecture

- **apps/web** — React + Vite + Tailwind CSS web preview (port 5000, main workflow)
- **apps/backend** — Express.js + TypeScript REST API (port 3000, console workflow)
- **apps/mobile** — Expo (React Native) mobile app (not runnable in Replit)
- **packages/database** — Shared Prisma client (PostgreSQL/Supabase)

## Tech Stack

- **Runtime**: Node.js 20
- **Language**: TypeScript
- **Frontend Preview**: React 18, Vite 5, Tailwind CSS 3, Lucide React icons
- **Backend Framework**: Express.js
- **Database ORM**: Prisma v6 (PostgreSQL via Supabase)
- **AI**: OpenAI (gpt-4o-mini)
- **Package Manager**: npm workspaces

## Workflows

1. **Start application** (webview, port 5000) — Web UI/UX preview
2. **Backend API** (console, port 3000) — Express backend (requires env vars)

## Web Preview Screens

The web preview (`apps/web`) renders these screens with mock data:
- **Auth** — Login/signup with dark green branding
- **Onboarding** — Chat-style onboarding flow
- **Home** — AI state card, quick actions, agenda preview
- **Check-in** — Mood/energy/clarity selectors with emojis
- **Check-in Result** — AI state reveal with colored themes
- **Planner** — Timeline with draggable blocks
- **Journal** — AI chat interface
- **Insights** — Weekly analytics
- **Config** — Account settings
- **Daily Summary** — Post-journal session summary

## Environment Variables Required

- `DATABASE_URL` — PostgreSQL connection string (Supabase)
- `OPENAI_API_KEY` — OpenAI API key (required for AI features)
- `OPENAI_MODEL` — Model name (default: gpt-4o-mini)
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_ANON_KEY` — Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key

## Database

Uses Prisma with PostgreSQL (Supabase). Run `npm run db:generate` to regenerate the client, `npm run db:push` to push schema.

## Setup Notes

- OpenAI client in backend is lazily initialized (server starts without key)
- `packages/database` must be built before backend can resolve it
- Web preview uses Vite with `allowedHosts: true` for Replit proxy compatibility
