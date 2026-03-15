# Documento 3 — Arquitetura de Software e Fluxo de Dados (MVP)

## 1. Visão Geral da Arquitetura

O MVP será construído com uma arquitetura cliente-servidor distribuída, garantindo separação clara entre a interface de usuário (Mobile), o servidor core (Backend) e a inteligência artificial (AI Layer).

**Principais Princípios:**

- **Modularidade:** Facilita manutenção e expansão por áreas de domínio (Usuário, Checkin, Planner, AI).
- **Escalabilidade Inicial:** Preparado para crescer sem overengineering no MVP (ex: banco relacional simples antes de migrar para microserviços).
- **Foco Offline-first (futuro):** A UI deve manter o estado mesmo sem internet profunda, com sincronização assíncrona com o backend (Cache local).

## 2. Stack Tecnológica

Esta é a recomendação oficial baseada nas discussões e na priorização por velocidade e reuso de ecossistema Open Source.

### 2.1 Mobile (Frontend)

- **Framework:** React Native com Expo (Permite rápido acesso a bibliotecas e deploy).
- **Linguagem:** TypeScript.
- **Gerenciamento de Estado:** Zustand (para estado global leve) ou Redux Toolkit (se decidir clonar inteiramente projeto como `Structure-planner`).
- **Navegação:** React Navigation v6.
- **Estilização:** Tailwind CSS (via NativeWind) ou StyleSheet nativo focado em Glassmorphism e tons calmos.

### 2.2 Backend (API Core)

- **Framework:** Node.js com Express.js ou Fastify (alta performance).
- **Linguagem:** TypeScript.
- **Banco de Dados:** PostgreSQL (Relacional forte para amarrar Usuário > Checkins > Tarefas).
- **ORM:** Prisma ORM (Tipagem segura e migrações ágeis).
- **Autenticação:** JWT Genérico + Possibilidade de OAuth via Supabase ou Firebase Auth.

### 2.3 Camada de Inteligência Artificial (AI Layer)

- **Provedor LLM:** OpenAI GPT-4o / gpt-4o-mini (Melhor balanço de custo e raciocínio).
- **Técnica de Prompting:** Zero-shot e Few-shot encapsulados no backend (Frontend não consome API da OpenAI direto por segurança).
- **Futura camada RAG:** Preparar o modelo para ter índice de histórico vetorial caso o banco relacional seja muito lento na busca literal.

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
- `POST /api/ai/planner-suggestions` (A IA revisa o dia aberto e os checkins e devolve recomendação de replanejamento).

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

1. **APP:** Tem a grade de hoje cheia de tarefas. A usuária está no estado de "Dia Sensível".
2. **APP:** Usuária clica em "Otimizar Dia com IA".
3. **BACKEND:** Compila as Tarefas do dia (`TimelineBlock`) e o Estado de Hoje e envia para a IA.
4. **AI LAYER:** Sugere um Array de modificações: `[ { "id": 1, "action": "MOVE_TO_TOMORROW" } ]`.
5. **APP:** Exibe as sugestões. Se aceito, dispara os `PUT /api/timeline/:id`.

## 6. Estratégia de Deploy Clássica e Repositório

Para facilitar o handoff entre devs ou IAs autonomas:

- **Repositório Monorepo (pnpm workspaces)** ou diretórios segregados (padrão atual do projeto com `/mobile` e `/backend`).
- **Deploy Mobile:** Compilações via EAS Build (Expo Application Services).
- **Deploy Backend e DB:** Vercel (se Serverless Fastify) ou Render/Railway (banco PostgreSQL e container Docker Node).
