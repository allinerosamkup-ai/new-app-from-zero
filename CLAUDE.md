# Mood Cycling App — Monorepo

## IDENTIDADE DO APP (CRÍTICO)
**Não é:** planner genérico, tracker menstrual, chatbot terapêutico.
**É:** Assistente pessoal de **ciclagem de humor**.
- **Ciclo primário:** Ciclo de Humor (EWMA + desvio padrão + tendência de 7 dias).
- **Ciclo secundário:** Ciclo Menstrual (modulador biológico).
- **Público-alvo:** TDAH, ciclotimia, transtorno depressivo ou bipolar tipo II.

## Módulo Core — MoodCycleEngine
Localizado em `apps/web/src/utils/mood-cycle-engine.ts`.
Calcula algoritmicamente a fase atual:
- `elevated`: Humor ≥4.2 por 3+ dias (risco hipomaníaco).
- `flowing`: 3.6–4.2, tendência estável/alta.
- `stable`: Eutimia — estado basal equilibrado.
- `falling`: Tendência negativa detectada.
- `low`: Humor ≤2.5 por 3+ dias.
- `depleted`: Humor ≤1.8 por 2+ dias (esgotamento).
- `recovering`: Subindo após fase baixa.
- `mixed`: Alta variabilidade — estado instável.

## Estrutura do Monorepo
```
apps/
  web/          → Frontend React + Vite + TypeScript
  backend/      → API Node.js + Express + Prisma
  mobile/       → React Native + Expo (pausado)
packages/
  database/     → Schema Prisma compartilhado
```

## Stack Travada
| Camada | Tecnologia |
|--------|-----------|
| Web frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Estado global | Zustand (stores em `apps/web/src/features/aura/`) |
| Backend API | Node.js + Express + TypeScript |
| ORM | Prisma (schema em `packages/database/prisma/schema.prisma`) |
| Banco | Supabase (PostgreSQL + Auth) |
| IA | OpenAI GPT-4o-mini |

## IA Persona — Aura (v2.4)
- Função: `buildAuraSystemPrompt(userName, profileSummary?, moodCycleContext?)` em `apps/backend/src/index.ts`.
- Injetada em **todos** os calls OpenAI via `role: 'system'`.
- `moodCycleContext`: String de 1 linha (`cycleReport.aiContext`) injetada para dar consciência de fase à IA.
- Metodologia: Terapia de Exposição + TCC gentil + Psicologia somática + Autocompaixão.

## Status do Design System — Aura v2
- Paleta: `--nectarine` (#D7897F), `--menthe` (#96C7B3), `--lagune` (#6398A9).
- Regra: Humor → `--menthe`; Energia → `--lagune`; Estado/Destaque → `--nectarine`.
- **NUNCA** usar `--peche` (#F9B95C) para humor ou energia.

## ✅ Atualizações Recentes (2026-04-03)
- **Planner v4**: Badge de energia por tarefa (alta/média/leve) + aviso da Aura se energia baixa.
- **AI Sync**: `moodCycleContext` adicionado a todos os calls IA (Home, Result, Journal, GTD).
- **Backend**: Persistência de campos do ciclo menstrual (`is_flowing`, `flow_day`, etc) no schema `DailyCheckin`.
- **Journal**: Chat SSE agora ciente da fase atual do ciclo de humor.

## Como rodar
```bash
# Backend (porta 3001)
cd apps/backend && npm run dev

# Frontend (porta 5173)
cd apps/web && npm run dev
```
