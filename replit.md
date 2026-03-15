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

## Design System

- **Fonts**: Poppins (headings), Inter (body)
- **Colors**: #1f3b32 (dark green primary), #f6f3ed (beige base), #2dd4bf (teal accent)
- **Glassmorphism**: backdrop-blur, translucent whites, soft borders (`.glass`, `.glass-card`, `.glass-strong`)
- **CSS Variables**: Defined in `apps/web/src/index.css` (--bg-base, --bg-dark, --accent-green, etc.)
- **Animations**: fadeInUp, slideUp, slideDown, pulse-soft with delay utilities

## Workflows

1. **Start application** (webview, port 5000) — Web UI/UX preview
2. **Backend API** (console, port 3000) — Express backend (requires env vars)

## Web Preview Screens

The web preview (`apps/web`) renders these screens with mock data:
- **Auth** — Login/signup with dark green branding, glassmorphism inputs
- **Onboarding** — Chat-style onboarding flow with cycling-specific questions
- **Home** — AI state card (mood cycling states), quick actions (3-col grid: Diário, Planner, Padrões), agenda preview
- **Check-in** — Mood/energy/clarity/irritability selectors with emojis
- **Check-in Result** — AI state reveal (leve/moderado/sensível/crítico) with colored themes
- **Planner** — Vertical timeline with draggable blocks, subtasks, task splitting (Dividir Tarefa), Pomodoro launch, alert badges, FAB for new task
- **Journal** — Session history list, cycling-specific template selector (6 templates), AI chat with simulated audio recording
- **Insights** — Weekly mood/energy bar chart, cycling pattern detection, severity-coded pattern cards, AI summary
- **Config** — Account settings, routine (wake/sleep times, timezone), privacy link
- **Daily Summary** — Post-journal session with emotions, themes, loop detection, suggestions
- **Objectives** — AI goal decomposition, progress bars, subtask management, AI insights per objective
- **Harmony Circle** — SVG radar chart (6 dimensions: humor, energia, sono, foco, social, corpo), dimension detail cards with trends
- **Pomodoro** — Circular timer (focus/break/longBreak), cycle tracking, AI suggestions based on energy

## Navigation

- **TabBar tabs**: Hoje (home), Planner, Diário (journal), Metas (objectives), Config
- **Sub-screens**: checkin, checkinResult, dailySummary, harmony, pomodoro, insights, onboarding

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
- All UI text is in Brazilian Portuguese (pt-BR)
- Single warm AI voice — no multiple AI styles/personalities
- Cycling-specific: bipolar, ADHD, hormonal cycle awareness
