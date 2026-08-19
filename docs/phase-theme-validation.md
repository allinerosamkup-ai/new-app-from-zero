# Validação local do tema visual por fase

## Evidência de shell autenticado

Em 19 de agosto de 2026, a candidata local em `http://127.0.0.1:5175/home` foi aberta em sessão autenticada de demonstração. Com a fase canônica `insufficient_data`, a Home exibiu a moldura neutra, a navegação inferior e o card de leitura sem alterar os dados da conta.

## Simulação visual não persistente

Para verificar a família cromática sem escrever check-ins de teste, os tokens de fase injetados no elemento do shell foram removidos temporariamente no DOM e o atributo `data-airia-phase` foi mudado para `flowing`. A inspeção retornou `--phase-accent: #D98274` e o gradiente de fundo calculado entre `#FCE5DE` e `#FEF3F0`, confirmando a aplicação coral aprovada.

A captura móvel do shell confirmou que o fundo, o card de leitura e a navegação inferior adotam essa ambientação coral, enquanto tipografia e conteúdo continuam legíveis. Em seguida, a mesma simulação foi alterada para `mixed`; o navegador retornou `--phase-accent: #735A99` e uma superfície de navegação derivada do tom ametista, sem mudança de rota ou escrita no banco.

Por fim, a simulação `depleted` retornou `--phase-accent: #4A4F78` e `--phase-accent-ink: #FFFFFF`. A captura móvel mostrou a família índigo no fundo e nas superfícies prioritárias, com o conteúdo textual preservado. Ao abrir a Home sem simulação, a própria fase `insufficient_data` apresentou a alternativa cinza neutra.

Após a inspeção, a Home foi recarregada e retornou ao estado canônico `insufficient_data`. As simulações ficaram restritas ao DOM do navegador e foram descartadas sem persistência.

## Regressão técnica

A regressão integral da PWA concluiu com sucesso: verificação de tipos, lint sem avisos, **63 arquivos de teste / 470 testes aprovados** e build de produção com service worker PWA gerado. A checagem `git diff --check` não apontou erros de whitespace. Nenhum commit, push ou deploy foi executado nesta etapa.

## Integração sobre a versão publicada

O tema foi integrado sobre o commit `1ba481a68b1299a7a797faa42c9076a6a85fdcbf`, cujo workflow de deploy anterior concluiu com sucesso. O único conflito de integração ocorreu no provedor Aura e foi resolvido preservando simultaneamente a derivação memorizada de fase e a atualização de objetivos trazida pela base remota.

Após gerar o cliente Prisma apenas no ambiente local de testes, a suíte completa do backend concluiu com **118 suítes aprovadas**. A PWA integrada passou em typecheck, **63 arquivos / 470 testes** e build de produção com service worker gerado. Há três avisos de lint já presentes em `apps/web/src/lib/api.ts`, arquivo que não foi alterado pelo tema; eles não bloqueiam typecheck, testes, build nem o workflow de deploy já usado pela base publicada.

A candidata local foi reiniciada para inspeção visual pós-integração. Nesta primeira abertura, a Home permaneceu aguardando hidratação no navegador; a verificação visual será repetida após o diagnóstico local, sem alterar dados de demonstração.

Nenhum dado, fluxo, componente funcional, gráfico ou registro da conta de demonstração foi modificado durante esta validação.
