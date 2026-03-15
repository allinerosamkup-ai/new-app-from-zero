# Project Execution Checklist

**Date:** 2026-03-13  
**Platform:** Expo/React Native + Node/Express + Prisma + Supabase + OpenAI  
**Rule:** Preserve existing functionality and adapt persistence/contracts to the implemented behavior.

## Sprint 1: Foundation

- `[~]` Setup projeto Expo
  - `apps/mobile` existe
  - base mobile existe
  - navegação real ainda não está montada no `App.tsx`
- `[x]` Setup backend Node.js + Express + Prisma
- `[~]` Configurar Supabase (DB + Auth)
  - schema/migrations existem
  - cliente mobile Supabase existe
  - falta garantir ambiente remoto totalmente aplicado e validado
- `[~]` Implementar autenticação (registro/login)
  - `auth_store` e leitura de sessão já existem no mobile
  - falta fluxo de UI para login/registro
- `[ ]` Tela 1 (Boas-vindas/Login)
- `[ ]` Tela 2 (Onboarding)

## Sprint 2: Core Features

- `[x]` Tabela `DailyCheckin` + API
- `[x]` Tela 4 (Check-in) com sliders
- `[x]` Integração OpenAI para avaliação de estado
- `[ ]` Tela 3 (Home) com card de estado
- `[x]` Tabelas `JournalSession` + `JournalMessage` + API
- `[x]` Tela 5 (Diário) interface chat
- `[x]` Integração IA para sessão de diário
- `[x]` Streaming no diário
- `[x]` Memória de rotina com base em onboarding + preferências + check-ins + planner + diário

## Sprint 3: Planner & Weekly

- `[~]` Tabela `TimelineBlock` + API
  - `POST /api/timeline` existe
  - `GET` do timeline ainda precisa ser fechado no backend
- `[~]` Tela 7 (Planner) timeline básica
- `[~]` Drag-and-drop de blocos
  - interação local existe
  - persistência completa ainda precisa ser fechada
- `[ ]` Sugestão IA para planner
- `[ ]` Tela 8 (Painel Semanal) com gráficos
- `[x]` Geração de insights semanais com IA
- `[ ]` Exibição dos insights semanais no mobile

## Sprint 4: Polish & Deploy

- `[ ]` Tela 6 (Resumo Diário)
- `[ ]` Tela 9/10 (Configurações e Paywall)
- `[ ]` Testes em dispositivos reais
- `[ ]` Deploy backend
- `[ ]` Build iOS (TestFlight)
- `[ ]` Build Android (Internal Test)
- `[~]` Documentação final

## Priority Order

1. Login/registro no Expo usando Supabase
2. Onboarding persistido
3. Home com estado atual
4. `GET /api/timeline/:date`
5. Persistência completa do planner
6. Resumo diário
7. Painel semanal com gráficos
8. Configurações/paywall
9. Deploy e testes reais

## Notes

- Onde o material antigo falar `Flutter`, neste projeto deve ser lido como `Expo/React Native`.
- O contrato do diário com streaming já está implementado e documentado.
- O projeto já usa `JournalMessage` separado, não JSON array dentro da sessão.
- O auth no mobile já consegue ler `userId` real da sessão Supabase, mas ainda não há tela de login pronta.
