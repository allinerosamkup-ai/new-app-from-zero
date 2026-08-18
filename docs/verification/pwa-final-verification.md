# Verificação Final da PWA Airia

**Data da verificação:** 18 de agosto de 2026  
**Escopo validado:** check-in, padrões e feedback de padrões, objetivos, diário, leituras do dia, onboarding, configurações, PWA e cobrança.  
**Resultado independente final:** **9,2/10 — aprovada**.[1]

> A conclusão vale para o núcleo ativo da PWA. Hábitos, Planner e Pomodoro permanecem propositalmente fora do produto atual; seus caminhos são tratados por redirecionamentos seguros, e não como jornadas ativas.[2]

## Conclusão executiva

A PWA Airia atingiu o padrão solicitado de qualidade verificável. A avaliação independente final atribuiu **9,2/10** e confirmou que os três bloqueios levantados na primeira revisão foram resolvidos: a ponte de inspeção foi removida, a Home recebeu uma hierarquia explícita de recomendações e o autorrelato opcional de diagnóstico passou a fazer parte do passo ativo de traços do onboarding.[1] [2]

Além disso, a camada de cobrança foi consolidada em **Cakto-only**, conforme a decisão de produto. O backend deixou de expor webhook, portal, seleção de provedor ou verificação de sessão via Stripe; o SDK, os arquivos legados e a entrada correspondente no lockfile foram removidos. A rota pública restante é `POST /api/billing/webhook/cakto`, e sua suíte de integração passou após a alteração.[3] [4]

| Dimensão | Resultado verificado | Situação |
|---|---|---|
| Qualidade independente | Nota final **9,2/10** e veredito **aprovada** | Aprovada |
| Testes PWA | **61 arquivos / 455 testes**, todos aprovados | Aprovada |
| Tipagem PWA | `tsc --noEmit` aprovado após as correções | Aprovada |
| Build PWA | Build de produção aprovada, com service worker `injectManifest` gerado | Aprovada |
| Segurança de build | Artefato sem `html2canvas`, `previewbridge-component-data` ou `screenshotResult` | Aprovada |
| Cobrança | Rota e teste Cakto aprovados; Stripe removido do fluxo operacional | Aprovada |
| Telemetria | Contrato versionado, idempotência, fila offline e bloqueio de PII previamente verificados | Aprovada |

## Correções incorporadas nesta etapa

### Cobrança exclusivamente pela Cakto

O contrato de `BillingProvider` foi reduzido ao provedor Cakto. A criação de checkout, a verificação de tentativas e o cancelamento passam pela Cakto; quando a integração não está configurada, o produto apresenta um estado explícito de indisponibilidade, sem botão inerte e sem fallback silencioso para outro provedor.[3]

O serviço Cakto valida segredo de webhook com comparação resistente a timing, reconcilia pedido, oferta, produto, valor, tipo de cobrança e estado esperado, e protege contra reprocessamento e eventos fora de ordem. A tela de cobrança conserva uma tentativa idempotente, evita duplo clique, retém o identificador de confirmação por 30 minutos e comunica estados de atraso de forma clara.[4]

| Removido ou alinhado | Estado final |
|---|---|
| `StripeBillingProvider`, portal Stripe e rotas `/api/billing/webhook` e `/api/billing/webhook/stripe` | Removidos |
| SDK, teste e serviço Stripe do backend | Removidos |
| Dependência Stripe no manifesto e lockfile | Removida |
| Contratos de assinatura da PWA | Aceitam apenas `cakto` ou `null` |
| Webhook de produção | `POST /api/billing/webhook/cakto` |

### Segurança e resiliência da PWA

A ponte de inspeção que injetava biblioteca externa de captura de tela e recebia mensagens globais foi removida integralmente de `vite.config.ts`. O service worker continua sendo produzido pela estratégia `injectManifest`, mas não é registrado no servidor de desenvolvimento, reduzindo a divergência entre depuração e comportamento de release. A build final confirmou a ausência dos artefatos da ponte e gerou `sw.js` de produção.[1] [5]

Também foi removido o bloco `runtimeCaching` que não produzia efeito sob a estratégia `injectManifest`. A configuração agora expressa somente os comportamentos efetivamente aplicáveis ao service worker ativo.[5]

### Home sem recomendações concorrentes

A Home passou a usar uma regra explícita de arbitragem para o destaque de “próximo passo”:

> **leitura canônica > nudge contextual > autonomia > ação de momento**.

A ação contextual só aparece quando não há decisão canônica, nudge com ação nem sugestão autônoma elegível. O card de autonomia, por sua vez, não oferece ação quando uma decisão canônica ou nudge já ocupa essa prioridade. Isso elimina a disputa visual e semântica entre fontes que poderiam sugerir ações diferentes no mesmo momento.[1] [6]

### Onboarding canônico com dado opcional ativo

O onboarding continua com **nove etapas**. O autorrelato opcional de diagnósticos foi incorporado ao passo `traits`, que já está no caminho ativo, sem reintroduzir uma décima tela ou exigir digitação adicional. O dado é tratado como autorrelato e nunca como rótulo exibido para a pessoa; ele apenas alimenta a personalização posterior.[1] [7]

## Evidência de validação automatizada

| Comando ou evidência | Resultado | Observação |
|---|---|---|
| `npm test --workspace=@app/web` | 61 arquivos e 455 testes aprovados | Suíte integral da PWA após os ajustes |
| `npm run typecheck --workspace=@app/web` | Aprovado | Checagem TypeScript após Home e onboarding |
| `npm run build --workspace=@app/web` | Aprovado | Geração do bundle, HTML SEO e service worker |
| Inspeção do diretório `apps/web/dist` | Aprovada | Não contém a ponte de inspeção removida |
| `npm test --workspace=@app/backend -- index.billing.test.ts` | Aprovado | Checkout, verificação, cancelamento e webhook Cakto |
| Testes móveis | 4 suítes e 5 testes aprovados | Ambiente Expo/Jest corrigido; aplicação móvel é separada da PWA |

Os avisos de renderização `useLayoutEffect` e `act(...)` emitidos durante testes de renderização em ambiente de servidor foram observados como ruído de ambiente de teste; não invalidaram a execução, que terminou com todos os testes aprovados. Eles continuam sendo candidatos a limpeza futura, mas não constituem bloqueio funcional da PWA.

## Riscos residuais e tratamento recomendado

| Prioridade | Risco residual | Tratamento recomendado |
|---|---|---|
| Média | O renderer ainda reconhece o ID legado `diagnoses`, embora o fluxo ativo o colete dentro de `traits`. | Em uma iteração de limpeza, remover a rota legada ou protegê-la por teste explícito de não-renderização no caminho canônico. |
| Média | A regra de precedência da Home está documentada e aplicada localmente; uma futura nova fonte de recomendação pode ignorá-la. | Extrair a arbitragem para helper testável e adicionar casos de regressão para todas as combinações de fontes. |
| Baixa | Atualizações da PWA pedem confirmação, portanto parte das pessoas pode adiar uma nova release. | Monitorar adesão de versão e manter o aviso de atualização claro e não intrusivo. |
| Baixa | A proteção contra senhas vazadas continua indisponível no plano Supabase Free. | Manter a exceção documentada; não alterar o mínimo de seis caracteres nem propor upgrade nesta etapa. |
| Baixa | Existem 44 erros de lint no aplicativo móvel legado, fora do núcleo prioritário da PWA. | Tratar em uma tarefa própria de manutenção móvel, sem confundir esse débito com a nota da PWA. |

Há também uma exigência operacional anterior à produção: a chave secreta do Supabase que foi compartilhada no contexto de trabalho deve ser **rotacionada**. Isso não altera a avaliação do código, mas é uma medida obrigatória de higiene de credenciais antes de qualquer publicação.

## Decisão final

A PWA está **aprovada para o padrão de qualidade 9/10 solicitado**, com nota independente de **9,2/10**. O produto agora apresenta coerência entre escopo ativo, onboarding, Home, telemetria, PWA e cobrança Cakto. Os riscos restantes são explícitos, limitados e não impedem a utilização do núcleo ativo.

## Referências

[1]: ./pwa-independent-final-review.md "Reavaliação independente final da PWA — 9,2/10"
[2]: ./pwa-independent-review.md "Revisão independente inicial da PWA"
[3]: ../../apps/backend/src/services/billing-provider.ts "Contrato Cakto-only de cobrança"
[4]: ../../apps/backend/src/services/cakto.service.ts "Serviço de checkout e webhook Cakto"
[5]: ../../apps/web/vite.config.ts "Configuração final da PWA e do service worker"
[6]: ../../apps/web/src/routes/home-page.tsx "Hierarquia de recomendações da Home"
[7]: ../../apps/web/src/features/story-onboarding/steps.ts "Fluxo canônico do onboarding"
