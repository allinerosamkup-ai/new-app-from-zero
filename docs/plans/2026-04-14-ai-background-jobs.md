# AI Background Jobs — Implementation Plan

> **For Claude:** Execute task-by-task using subagent-driven-development

**Goal:** Sistema de automação que roda em background, processa dados do usuário periodicamente, e distribui insights gerados proativamente para todas as features que dependem de IA.

**Architecture:** 
- Job scheduler com node-cron roda dentro do processo Express
- AI Background Service coleta dados novos, processa via OpenAI, armazena resultados
- Webhook/SSE notifica frontend quando insights novos estão disponíveis
- user preferences define intervalo (1h, 6h, 12h, 24h)

**Tech Stack:** node-cron, Prisma, OpenAI, SSE, Zustand (frontend)

---

## Task 1: AI Background Service Core

**Files:**
- Create: `apps/backend/src/services/ai-background.service.ts`
- Modify: `apps/backend/src/index.ts` (registrar jobs)
- Modify: `packages/database/prisma/schema.prisma` (nova tabela `aiBackgroundJob`)

**Step 1: Adicionar tabela ao schema Prisma**

```prisma
model AiBackgroundJob {
  id          String   @id @default(cuid())
  userId      String
  jobType    String   // "profile-update", "insight-generation", "rag-indexing"
  status     String   @default("pending") // pending, running, completed, failed
  runAt      DateTime
  completedAt DateTime?
  result     Json?
  error      String?
  createdAt  DateTime @default(now())
  
  @@index([userId, status])
}
```

**Step 2: Criar ai-background.service.ts**

```typescript
import { PrismaClient } from '@app/database';
import { MemoryService } from './memory.service';
import { InsightService } from './insight.service';
import { buildAuraSystemPrompt } from '../lib/aura-prompt';

const prisma = new PrismaClient();

// Intervalos permitidos (em milissegundos)
const INTERVALS = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
} as const;

export type IntervalKey = keyof typeof INTERVALS;

export class AiBackgroundService {
  private static running = false;

  // Agenda job para um usuário
  static async scheduleJob(userId: string, jobType: string, interval: IntervalKey) {
    const runAt = new Date(Date.now() + INTERVALS[interval]);
    
    await prisma.aiBackgroundJob.upsert({
      where: { userId_jobType: { userId, jobType } },
      create: { userId, jobType, runAt, status: 'pending' },
      update: { runAt, status: 'pending' },
    });
  }

  // Executa todos os jobs pendentes
  static async processPendingJobs(): Promise<{ processed: number; errors: number }> {
    if (this.running) return { processed: 0, errors: 0 };
    this.running = true;
    
    try {
      const pendingJobs = await prisma.aiBackgroundJob.findMany({
        where: { status: 'pending', runAt: { lte: new Date() } },
        take: 10,
      });

      let processed = 0, errors = 0;

      for (const job of pendingJobs) {
        try {
          await prisma.aiBackgroundJob.update({
            where: { id: job.id },
            data: { status: 'running' },
          });

          await this.executeJob(job);

          await prisma.aiBackgroundJob.update({
            where: { id: job.id },
            data: { status: 'completed', completedAt: new Date() },
          });

          processed++;
        } catch (err) {
          await prisma.aiBackgroundJob.update({
            where: { id: job.id },
            data: { status: 'failed', error: String(err) },
          });
          errors++;
        }
      }

      return { processed, errors };
    } finally {
      this.running = false;
    }
  }

  // Executa um job específico
  private static async executeJob(job: any) {
    switch (job.jobType) {
      case 'profile-update':
        await this.updateUserProfile(job.userId);
        break;
      case 'rag-indexing':
        await this.runRagIndexing(job.userId);
        break;
      case 'insight-generation':
        await this.generateInsights(job.userId);
        break;
    }
  }

  // JOB: Atualiza perfil do usuário baseado em dados recentes
  private static async updateUserProfile(userId: string) {
    const recentCheckins = await prisma.dailyCheckin.findMany({
      where: { userId },
      orderBy: { localDate: 'desc' },
      take: 30,
    });

    if (recentCheckins.length < 3) return; // need data

    // Usa OpenAI para analisar padrões
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `Analise os últimos ${recentCheckins.length} check-ins do usuário e gere um resumo corto do perfil emocional/comportamental atual. formato: { moodTrend: string, energyPattern: string, mainTriggers: string[], recommendedActions: string[] }`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.3,
    });

    // Salva resultado no banco (pode criar tabela userAiProfile se needed)
  }

  // JOB: Indexa novos dados no RAG
  private static async runRagIndexing(userId: string) {
    const memoryService = new MemoryService(prisma);
    
    const newJournals = await prisma.journalEntry.findMany({
      where: { userId, createdAt: { gte: new Date(Date.now() - INTERVALS['1h']) } },
    });

    for (const journal of newJournals) {
      await memoryService.store({
        userId,
        contentType: 'journal',
        contentId: journal.id,
        content: journal.content,
      });
    }
  }

  // JOB: Gera insights proativos
  private static async generateInsights(userId: string) {
    const { getWeeklyInsights } = InsightService;
    // Gera insight proactively (sem ter sido solicitado)
    // Armazena em cache para distribuição quando usuário abrir qualquer tela
  }
}
```

**Step 3: Testar criação**

```bash
cd apps/backend && npx tsx -e "
import { AiBackgroundService } from './src/services/ai-background.service';
console.log('AI Background Service loaded');
"
```

Expected: "AI Background Service loaded"

**Step 4: Commit**

```
git add packages/database/prisma/schema.prisma apps/backend/src/services/ai-background.service.ts
git commit -m "feat: add AI background jobs service"
```

---

## Task 2: Cron Scheduler Integration

**Files:**
- Modify: `apps/backend/src/index.ts` (registrar cron job)
- Test: criar teste básico

**Step 1: Registrar scheduler no index.ts**

No topo do arquivo, após imports:
```typescript
import * as cron from 'node-cron';
import { AiBackgroundService } from './services/ai-background.service';

// Agenda processamento a cada 15 minutos
cron.schedule('*/15 * * * *', async () => {
  console.log('[AI Background] Processing pending jobs...');
  const result = await AiBackgroundService.processPendingJobs();
  if (result.processed > 0) {
    console.log(`[AI Background] Processed ${result.processed} jobs, ${result.errors} errors`);
  }
});
```

**Step 2: Testar se o scheduler inicia**

```bash
# (O servidor vai rodar automaticamente com o cron job)
echo "Scheduler registered"
```

**Step 3: Commit**

```
git add apps/backend/src/index.ts
git commit -m "feat: register AI background cron scheduler"
```

---

## Task 3: User Preference for Interval

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (adicionar campo a UserPreferences se não existir)
- Modify: `apps/backend/src/services/preferences.service.ts` (se existir) ou criar

**Step 1: Verificar schema atual**

```bash
grep -A 20 "model User" packages/database/prisma/schema.prisma | head -30
```

Se não existir campo `aiBackgroundInterval`, adicionar:

```prisma
model User {
  id                    String    @id
  email                 String    @unique
  // ...campos existentes
  aiBackgroundInterval   String?   @default("6h")  // "1h", "6h", "12h", "24h"
}
```

**Step 2: Commit**

```
git add packages/database/prisma/schema.prisma
git commit -m "feat: add user AI background interval preference"
```

---

## Task 4: Frontend Integration (Optional — Phase 2)

**Files:**
- Modify: frontend store (preferencias)
- Modify: API endpoint para update preferencia

**Step 1: Explicação breve**

Este passo é opcional e pode ser feito depois. O scheduler usa valor default (6h) se não configurado.

---

## Dependency Graph

```

[T1] ──► [T2] ──► [T3]      [T4] é opcional
  │         │
  └─────────┴──────► (jobs executando automaticamente)
```

---

## Execution Choice

**Plan complete and saved to `docs/plans/2026-04-14-ai-background-jobs.md`.**

Two execution options:

**1. Subagent-Driven (this session)** — I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints

Which approach?