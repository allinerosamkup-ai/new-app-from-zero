# Documento 3 — Arquitetura de Software e Fluxo de Dados (MVP)

## 1. Visão Geral da Arquitetura

O produto atual roda como PWA web em produção, com backend Express/Prisma e Supabase. A arquitetura separa frontend, backend, banco e camada de IA, mas a regra principal agora é que toda sugestão operacional passe por um contexto diário único.

**Principais Princípios:**

- **Modularidade:** Facilita manutenção e expansão por áreas de domínio (Usuário, Checkin, Planner, AI).
- **Escalabilidade Inicial:** Preparado para crescer sem overengineering no MVP (ex: banco relacional simples antes de migrar para microserviços).
- **Foco Offline-first (futuro):** A UI deve manter o estado mesmo sem internet profunda, com sincronização assíncrona com o backend (Cache local).
- **Grounding operacional:** memória antiga explica padrão; contexto de hoje decide ação.
- **Sem sugestão solta:** ações da IA precisam nascer de agenda pendente, hábito devido, meta ativa ou aceite explícito.

## 2. Stack Tecnológica

Esta é a recomendação oficial baseada nas discussões e na priorização por velocidade e reuso de ecossistema Open Source.

### 2.1 Frontend

- **PWA principal:** React + Vite + TypeScript em `apps/web`.
- **Mobile APK:** Expo/React Native em `apps/mobile`, pausado enquanto o PWA estabiliza.
- **Linguagem:** TypeScript.
- **Gerenciamento de Estado:** Zustand em `apps/web/src/features/aura`.
- **Estilização:** CSS Aura Editorial Clean, tokens em `apps/web/src/styles`.

### 2.2 Backend (API Core)

- **Framework:** Node.js com Express.js.
- **Linguagem:** TypeScript.
- **Banco de Dados:** PostgreSQL (Relacional forte para amarrar Usuário > Checkins > Tarefas).
- **ORM:** Prisma ORM (Tipagem segura e migrações ágeis).
- **Autenticação:** Supabase JWT.

### 2.3 Camada de Inteligência Artificial (AI Layer)

- **Provedor LLM:** OpenAI GPT-4o / gpt-4o-mini (Melhor balanço de custo e raciocínio).
- **Técnica de Prompting:** Zero-shot e Few-shot encapsulados no backend (Frontend não consome API da OpenAI direto por segurança).
- **RAG:** `MemoryService` recupera memórias relevantes. Essas memórias explicam padrão, mas não autorizam tarefa sem âncora atual.
- **DailyContext:** `ContextGroundingService` centraliza contexto operacional antes de sugestões.
- **Decision Brain:** `DecisionEngine` decide o que é compromisso real, sugestão opcional, insight, bloqueio e notificação permitida.
- **Agenda Adaptativa:** `AdaptiveAgendaEngine` transforma decisões em preview (`keep`, `move`, `shrink`, `pause`, `suggest`, `convert`, `notify`, `block`) sem aplicar nada sozinho.

## 3. Modelo de Banco de Dados (Entidades Principais)

### `User`

```prisma
model User {
  id             String   @id @default(uuid())
  email          String   @unique
  name           String?
  passwordHash   String?
  onboardingDone Boolean  @default(false)
  createdAt      DateTime @default(now())
  
  checkins       DailyCheckin[]
  sessions       JournalSession[]
  tasks          TimelineBlock[]
}
```

### `DailyCheckin`

```prisma
model DailyCheckin {
  id              String   @id @default(uuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  date            DateTime @default(now())
  moodScore       Int      // 1 a 5
  energyScore     Int      // 1 a 5
  mentalClarity   Int      // 1 a 5
  irritability    Int      // 1 a 5
  notes           String?
  aiCalculatedState String? // O "Rótulo" final
}
```

### `JournalSession`

```prisma
model JournalSession {
  id              String   @id @default(uuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  date            DateTime @default(now())
  rawTranscript   String?  // Omitido no front se for muito sensível, usado só pro AI
  aiSummary       String
  emotionsDetected String[] // Arrays de strings ou Json no Prisma
  recurrentThemes  String[]
}
```

### `TimelineBlock` (O Planner)

```prisma
model TimelineBlock {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  title         String
  date          DateTime
  startTime     DateTime // Hora base
  endTime       DateTime // Hora fim
  durationMins  Int
  isRoutine     Boolean  @default(false)
  priorityLevel String?  // 'Média', 'Alta', 'Baixa'
  status        String   @default("PENDING") // PENDING, DONE, RESCHEDULED
}
```

## 4. Endpoint Mapping (REST APIs)

**Auth:**

- `POST /api/auth/register` (Cria usuário)
- `POST /api/auth/login` (Autentica e devolve JWT)

**Check-in:**

- `POST /api/checkins` (Salva o resultado diário e dispara job da IA de estado)
- `GET /api/checkins/today` (Busca estado do dia atual)

**Journal:**

- `POST /api/journal/session` (Envia o transcript/texto e a IA devolve/salva o Resumo)
- `GET /api/journal/history` (Lista sessões anteriores minimizadas)

**Planner / Timeline:**

- `GET /api/timeline/:date` (Puxa os blocos de um dia específico)
- `POST /api/timeline` (Cria um bloco manualmente)
- `PUT /api/timeline/:id` (Move horário ou completa)
- `POST /api/agenda/adapt` (Preview de adaptação baseado no contexto diário).

**Contexto/IA:**

- `GET /api/context/day?date=YYYY-MM-DD` (Fonte única do dia para IA e depuração).
- `POST /api/ai/suggest` (Sugestões estruturadas com grounding).
- `POST /api/ai/action-feedback` (Registra aceite, conclusão, rejeição, exclusão ou agendamento de sugestão).

## 5. Fluxos de Dados Principais

### 5.1 Fluxo de "Sincronização de Estado" (O Diferencial)

1. **APP:** Usuária abre o app e vai em "Check-in Rápido".
2. **APP:** Submete um JSON `{"mood": 2, "energy": 1, "irritability": 4}` para o Backend.
3. **BACKEND:** Salva `DailyCheckin`. Aciona a Camada de IA (via Service Interno).
4. **AI LAYER:** Recebe o perfil, injeta no Prompt de Estado: "Considerando X, y, Z, defina um rótulo e uma sugestão leve".
5. **BACKEND:** Recebe "Dia Sensível - Evite tarefas densas à tarde". Salva em `aiCalculatedState`.
6. **APP:** A Tela Home atualiza o cabeçalho com esse estado e muda os tons visuais (se programado).

### 5.2 Fluxo de Sessão com IA (Diário)

1. **APP:** Usuária grava áudio ou manda texto: "Hoje estou exausta, mal dormi."
2. **BACKEND:** Se for áudio, passa na API de Whisper/Transcribe. Se for texto, manda direto no `JournalService`.
3. **AI LAYER:** AI responde baseada no Prompt Coach (Validar, questionar ação possível).
4. **APP:** UI exibe o chat fluindo.
5. **AI LAYER (Fim):** Quando a usuária clica em "Finalizar", a IA gera um JSON puro com `{"summary": "...", "emotions": ["cansada", "frustrada"]}`.
6. **BACKEND:** Salva em `JournalSession`.

### 5.3 Fluxo de Replanejamento do Planner

1. **APP:** Usuária faz check-in, abre Home ou Planner.
2. **BACKEND:** Monta `DailyContext` com agenda, hábitos, metas, concluídos, rejeitados, sugestões recentes e memórias relevantes.
3. **BACKEND:** `DecisionEngine` classifica candidatos: `real_commitment`, `suggested_commitment`, `insight_only` ou `blocked`.
4. **BACKEND:** `AdaptiveAgendaEngine` gera preview: manter, mover, reduzir, pausar, sugerir, converter, notificar ou bloquear.
5. **APP:** Mostra a proposta com motivo. Nada deve ser movido, salvo ou notificado silenciosamente.
6. **APP/BACKEND:** Ao aceitar, a ação vira mudança real no Planner e feedback para não repetir.

Regra crítica: agenda vazia pode receber sugestão opcional de compromisso; isso não é compromisso real até a usuária confirmar. Sugestão não confirmada não gera notificação.

## 6. Estratégia de Deploy

Para facilitar o handoff entre devs ou IAs autonomas:

- **Repositório:** monorepo npm workspaces.
- **Deploy PWA/API:** VPS em `/opt/airia/app`, Docker Compose em `deploy/airia/compose.yml`, script `deploy/airia/deploy.sh`.
- **Healthcheck:** `https://airia.pro/api/health`.
- **Mobile:** Expo/EAS fica fora do fluxo principal até estabilização do PWA.
