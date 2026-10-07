# Handoff executor — teste de login no CI

2026-10-07. PR22, fonte recebida e93e6ac8, CI37643681503. Escopo exclusivamente `apps/web/src/routes/login-page.test.tsx`; nenhum código de produto, configuração global de teste, dependência ou publicação alterado. Governança/protocolo/constituição e handoff onboarding consultados; coordinator root, independent verifier release_meta.

## Evidência e decisão

CI anterior: 77 arquivos / 528 testes PASS, único FAIL login. Stack obtido por release_executor: `useContext` em `../../node_modules/react/cjs/react.development.js:1618` → `useTranslation` em `../../node_modules/react-i18next/dist/es/useTranslation.js:27` → `LoginPage` linha17 → renderer `node_modules/react-dom/cjs/react-dom.development.js:15486`. O hook que falha é da integração React/i18next, não MemoryRouter. Caminhos distintos root/web sustentam incompatibilidade de dispatcher no ambiente com dependências hoisted; não demonstram falha de autenticação ou do bundle consumidor.

Busca: api.test.ts é o único teste com resetModules; router real também está em splash/checkin/billing/Aura/PremiumGate tests. A hipótese inicial de MemoryRouter não foi aplicada. Antes do patch, api+login singleworker com shuffle seed37643681503: PASS 2 arquivos / 10 testes (24,91s), sessão76791; não reproduziu o FAIL do CI. Dependências locais vêm de checkout reutilizado e diferem do layout de instalação do CI. Não alegar RED local.

Reparo: mock de `react-i18next` apenas neste teste, mantendo exports/plugin originais e tradução real `i18n.t`, substituindo useTranslation/Trans para não chamar o dispatcher React da dependência hoisted. LoginPage, React renderer e MemoryRouter permanecem reais. Teste ainda exercita DOM, labels, evento Enter, campos vazios sem provider, tentativa válida com provider exatamente uma vez e sanitização do erro; parametrizado PT/EN. Não valida provider de i18next, cadastro real ou fluxo navegável ponta a ponta. Sem mascarar erros do provider, retry automático ou redução de assertions.

Cleanup em finally desmonta root/remove host/restaura idioma e descriptor de localStorage, limpa estado e mocks. Evita vazar storage/locale mesmo em assertion que falha.

## Checks e próxima ação

Final crosssuite: **PASS 3 arquivos / 23 testes**, sessão45190, duração34,91s, Node/Vitest locais, cwd apps/web:
`node node_modules/vitest/vitest.mjs run src/lib/api.test.ts src/routes/login-page.test.tsx src/routes/story-onboarding-page.test.tsx --maxWorkers=1 --pool=threads --sequence.shuffle --sequence.seed=37643681503`.
Inclui resets da API e onboarding com traduções reais. Aviso jsdom navigation é cenário esperado de sessão expirada da API; nenhum teste ou unhandled error falhou. Typecheck final na mesma sessão em andamento neste registro. Execução intermediária22testes PASS não substitui a fonte final23.

Fonte congelada, sem autoaprovação ou Git mutation pelo executor. Próxima ação: resultado typecheck, revisão independente e novo CI completo pelo coordenador. PASS local não substitui novo CI no ambiente que apresentou o erro.
