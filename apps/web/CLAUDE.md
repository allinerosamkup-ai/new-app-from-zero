# Web Frontend — apps/web

> Leia também o CLAUDE.md raiz do monorepo.

## Tecnologias
- React 18 + Vite + TypeScript
- Tailwind CSS (utility classes)
- Zustand (estado global)
- Supabase JS client (`src/lib/supabase.ts`)
- Lucide React (ícones)

## Estrutura de pastas
```
src/
  screens/       → Uma tela por arquivo (PascalCase + Screen.tsx)
  stores/        → Zustand stores (_store.ts)
  lib/
    api.ts       → apiFetch / apiGet / apiPost / streamJournalMessage
    supabase.ts  → cliente Supabase (usa VITE_SUPABASE_*)
  components/    → Componentes reutilizáveis
  navigation.tsx → Router simples com useNavigation()
  App.tsx        → Root + AuthInitializer
```

## Telas existentes (não crie fora desta lista sem aprovação)
| Arquivo | Rota | Status |
|---------|------|--------|
| AuthScreen.tsx | `auth` | ✅ real auth |
| HomeScreen.tsx | `home` | ✅ dados reais |
| CheckinScreen.tsx | `checkin` | ver status |
| CheckinResultScreen.tsx | `checkin-result` | ver status |
| InsightsScreen.tsx | `insights` | ✅ dados reais |
| JournalScreen.tsx | `journal` | ✅ IA real via SSE |
| ObjectivesScreen.tsx | `objectives` | ✅ CRUD real |
| PlannerScreen.tsx | `planner` | ver status |
| PomodoroScreen.tsx | `pomodoro` | ✅ localStorage |
| ConfigScreen.tsx | `config` | ✅ prefs reais |

## Stores Zustand (src/stores/)
| Store | Responsabilidade |
|-------|-----------------|
| `auth_store.ts` | sessão Supabase, perfil, signIn/signUp/signOut |
| `checkin_store.ts` | últimos 7 dias de daily_checkins |
| `insight_store.ts` | weekly_insights da semana atual |
| `journal_store.ts` | sessões, mensagens, streaming SSE |
| `objectives_store.ts` | CRUD de objetivos + sub-metas |
| `preferences_store.ts` | user_preferences (timezone, wakeTime, sleepTime) |

## Padrão de autenticação
```typescript
// Toda chamada à API usa JWT do Supabase:
import { apiFetch, apiGet, apiPost } from '../lib/api';
// apiFetch injeta automaticamente o Bearer token
```

## Design System — Aura × Nectarine (index.css)

### Paleta principal
| Token | Valor | Uso |
|-------|-------|-----|
| `--nectarine` | `#D7897F` | Accent primário (botões, destaques) |
| `--nectarine-10` | `#C46B60` | Hover/pressed states |
| `--nectarine-11` | `#A8544A` | Texto sobre fundo claro |
| `--nectarine-a3` | `rgba(215,137,127,.13)` | Background tint de cards |
| `--nectarine-a5` | `rgba(215,137,127,.22)` | Border interativa |
| `--menthe` | `#96C7B3` | Humor / Saúde / Autocuidado |
| `--lagune` | `#6398A9` | Energia / Trabalho / Foco |
| `--peche` | `#F9B95C` | Reservado — **NÃO usar em estados** |

### Backgrounds
| Token | Valor |
|-------|-------|
| `--bg-base` | `#FFFCF8` |
| `--bg-dark` | `#D7897F` (nectarine) |
| `--warm-bg` | `#FAF6F2` |

### Categorias semânticas
| Token | Cor | Categoria |
|-------|-----|-----------|
| `--cat-trabalho` | `#6398A9` | Trabalho/Foco |
| `--cat-saude` / `--cat-autocuidado` | `#96C7B3` | Saúde/Autocuidado |
| `--cat-social` | `#F9B95C` | Social (único uso legítimo de peche) |
| `--cat-rotina` / `--cat-pessoal` | `#D7897F` | Rotina/Pessoal |

### Regra de cores por dimensão
- **Humor** → `--menthe` (verde)
- **Energia** → `--lagune` (azul)
- **Estado/destaque principal** → `--nectarine` (rosa-terracota)
- **Nunca usar `--peche`/laranja** para estados de humor ou energia

### Aura Spacing Unit
```css
--a: 13px; /* unidade base: padding = var(--a), gap = calc(var(--a)*0.6) */
```

### Botão Aura
```css
height: 52px; /* 4 × 13px */
padding: 0 26px;
border-radius: 6.5px;
border: 1.5px solid;
font-weight: 700;
/* hover: scale(1.03) | active: scale(0.97) */
```
Classe `.btn-aura` + style `background: var(--bg-dark)` para primário.

### Input Aura
```css
height: 52px;
border-radius: 6.5px;
border: 1.5px solid var(--border-interactive);
/* focus: outline 3px solid var(--nectarine-a5) */
/* ícone contextual à esquerda dentro do input */
```

### Classes utilitárias
| Classe | Descrição |
|--------|-----------|
| `glass-card` | Fundo `rgba(255,253,250,.78)` + blur(20px) + border branca |
| `interactive-card` | Hover scale(1.015) + active scale(0.985) |
| `btn-aura` | Transições de escala para botões |

### Fundo de tela por contexto
- **Padrão**: `var(--bg-base)` = `#FFFCF8`
- **Resultado de estado** (ex: CheckinResult): gradiente opaco claro
  ```css
  background: linear-gradient(180deg, #F5E9E7 0%, #FAF2F0 45%, #FAF6F2 100%);
  ```
- **Nunca usar rgba com alpha baixo sobre fundo #111** (phone frame transparece)

### Mockup de referência
Arquivo: `apps/web/public/mockup-aura-v2.html`
Preview: abrir em browser ou via `preview_start`
Contém todas as 13 telas com o design Aura v2 aprovado.

## SSE Streaming (Journal)
```typescript
import { streamJournalMessage } from '../lib/api';
// POST fetch + ReadableStream manual (EventSource só suporta GET)
// Eventos: delta → onDelta(text), completed → onCompleted(full), error → onError
```

## Variáveis de ambiente (apps/web/.env)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=http://localhost:3001
```
