# Parecer independente final — correção do teste de login no CI

2026-10-07. Verificador login_ci_verifier_final; coordenador root. Base e93e6ac8d26cfa003f9dd67fd71a93ac683767db, patch não commitado na inspeção. Escopo somente apps/web/src/routes/login-page.test.tsx e sua compatibilidade com API/onboarding. Governança local, protocolo, CURRENT_STATE e login-ci-handoff consultados.

**PASS DELIMITADO — 8,8/10**, sem falha crítica neste escopo. Auditdiff confirma ausência de alteração de produto/configuração/dependências. O mock substitui somente useTranslation/Trans do teste; mantém tradução real i18n.t, renderer real e MemoryRouter real. Assertions PT/EN exigem marca/labels, zero chamadas com campos vazios, exatamente uma chamada válida, alert genérico localizado e ausência do detalhe privado. Cleanup restaura idioma/storage/DOM/mocks mesmo quando assertion falha.

O que supera uma correção mínima: preserva as traduções e controles reais exercitados, amplia a prova para os dois idiomas e impede contaminação de suites vizinhas; não resolve o CI apagando assertions ou modificando o produto. Rubrica: isolamento e escopo9,0; preservação de comportamento9,0; evidência executada8,5; rastreabilidade e limites8,7; média8,8.

Evidência independente executada sobre o patch final:
- PASS: node node_modules/vitest/vitest.mjs run src/lib/api.test.ts src/routes/login-page.test.tsx src/routes/story-onboarding-page.test.tsx --maxWorkers=1 --pool=threads --sequence.shuffle --sequence.seed=37643681503. Cwd apps/web; sessão7167; exit0; 3 arquivos/23 testes; duração25,40s. Inclui as duas instâncias PT/EN e alert assertion final. Aviso jsdom navigation em API esperado, nenhuma falha/unhandled error reportada.
- PASS: node node_modules/typescript/bin/tsc --noEmit. Cwd apps/web; sessão28795; saída final exit0 sem diagnóstico. Execução npx redundante90226 foi encerrada e não usada como prova.
- Auditoria git status: patch de produto restrito ao arquivo de teste; publication-handoff e arquivos Realnews/outros agentes são alheios à verificação e preservados. Nenhuma mutação Git realizada pelo verificador.

**BLOCKED para aprovação global/publicação imediata:** CI37643681503 permanece FAIL na base. Os testes locais não reproduziram o erro original e usam dependências de checkout reutilizado; nova execução do CI com a correção é necessária para demonstrar resolução no layout hoisted original. Este parecer não aprova provider i18next, autenticação/cadastro real, jornada integral, merge ou VPS. Não emite meta-approve.

Handoff vertical: contexto CI login incompatibilidade dispatcher; evidência23PASS/typecheckexit0/diff; decisão PASS limitado8,8; próxima ação coordenador persistir comunicação no protocolo, commit restrito, executar novo CI e encaminhar integração/meta independentes antes da publicação autorizada.
