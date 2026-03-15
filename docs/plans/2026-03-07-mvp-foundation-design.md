# MVP Foundation Design

> Status: approved on 2026-03-07
> Direction: `Expo/React Native + Supabase + OpenAI`
> Support tools only: `Stitch` for visual exploration, `Lovable` for quick web prototype or landing page if needed

## What This Project Is

This project is a mobile-first app that helps the user:

1. understand how they are today;
2. talk to an AI journal;
3. organize the day in a planner that respects energy and mood;
4. review simple weekly patterns;
5. control privacy and data deletion.

## Current State

The repository is still a planning repository. It contains product docs, but no app code, no database, no authentication, no tests, no deployment setup, and no git repository.

## Chosen Product Direction

### Production Stack

- Frontend: `React Native + Expo + TypeScript`
- Backend platform: `Supabase`
- Database: `PostgreSQL on Supabase`
- AI provider: `OpenAI`

### Why This Direction

- `Expo` is the most practical way to ship a real mobile MVP quickly.
- `Supabase` removes a lot of backend setup pain for an early product.
- `OpenAI` fits the journal, state evaluation, and planner suggestion flows well.
- `n8n` is not needed yet. It should only be added later if real automations appear.

## Important Product Decisions

### What Goes in MVP

- onboarding;
- state-of-today check-in;
- AI journal by text first;
- planner timeline;
- weekly insights;
- account, consent, and delete-my-data flow.

### What Stays Out of MVP

- wearables;
- complex coaching modes;
- heavy automation with n8n;
- full web product;
- advanced planner systems.

## What Is Missing Right Now

The project still needs:

1. repo structure;
2. Supabase schema;
3. auth flow;
4. AI contracts with structured outputs;
5. mobile shell and design system;
6. acceptance criteria by feature;
7. privacy and deletion rules;
8. analytics and beta process.

## Improvements Recommended Before Building

### Product

- define the exact labels for each day state;
- define what each day state changes in the planner;
- define simple MVP success metrics.

### AI

- require structured JSON outputs from OpenAI;
- version prompts from day one;
- keep summary retention separate from raw transcript retention.

### Privacy

- store only what is needed;
- let the user delete all data cleanly;
- keep consents versioned and auditable.

### Engineering

- start with a monorepo;
- avoid custom backend where Supabase already solves the problem;
- keep the first release text-first, then add audio.

## Beginner-Friendly Build Strategy

This project should not be built as a giant enginehttp://localhost:8081ering setup all at once. The right path for a beginner using vibe coding is:

1. make the visual flow clear;
2. make the database real;
3. make one feature work end to end;
4. only then add the next feature.

That means the first implementation target should be:

`onboarding -> check-in -> AI state result -> Today screen`

Everything else should come after that loop works.
