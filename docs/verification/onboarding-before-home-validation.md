# Validação local — onboarding antes da Home

## Defeito reproduzido

Uma conta recém-criada conseguia abrir a Home com estado de dados insuficientes e sem concluir as telas de **Pra começar**. Isso deixava a pessoa sem o contexto inicial necessário para usar o produto.

## Correção aplicada

A PWA agora usa uma decisão compartilhada de rota baseada em `onboardingDone` e `accountCreatedAt`. Para uma conta nova com onboarding pendente, a Splash, o callback de autenticação e todo o shell de rotas privadas direcionam para `/comecar` antes de renderizar a Home ou qualquer outra rota autenticada.

O estado falha de modo seguro: se uma conta pendente não tiver data de criação válida disponível na hidratação, ela também segue para **Pra começar**, não para uma Home vazia. Contas com onboarding concluído preservam a retomada normal do último contexto útil e não repetem o fluxo.

## Cobertura

| Cenário | Evidência |
|---|---|
| Conta nova pendente | Teste unitário confirma redirecionamento obrigatório para `Pra começar`. |
| Onboarding parcial | Teste unitário mantém a conta no fluxo enquanto houver pendência. |
| Onboarding concluído | Teste unitário confirma que não há redirecionamento repetido. |
| Data ausente/inválida | Teste unitário confirma comportamento seguro, sem Home vazia. |
| Splash, callback e acesso privado | Teste estrutural confirma uma entrada autenticada compartilhada e a guarda acima do `Outlet`. |

## Regressão

Em 20 de agosto de 2026, a PWA passou em typecheck, lint, **64 arquivos / 475 testes** e build de produção com service worker PWA gerado. Nenhum commit, push ou deploy foi executado nesta correção.
