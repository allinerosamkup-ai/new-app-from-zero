# Validação local — primeiro acesso, objetivo e Check-in

## Comportamento corrigido

Ao concluir **Pra começar**, a pessoa deixa de ir diretamente para uma Home sem dados. O fluxo agora segue para `/checkin`, pois o primeiro Check-in é a primeira observação que alimenta a leitura diária e o gráfico de Humor e Energia. O objetivo inicial continua sendo persistido pelo onboarding e é recarregado antes da transição.

Se uma conta chegar à Home sem qualquer Check-in por uma rota alternativa, a Home passa a apresentar um card de início com o objetivo ativo, um CTA explícito de **Fazer meu primeiro check-in** e uma explicação clara de que o gráfico aparece depois do registro. A Jornada foi mantida como solicitado.

Depois do primeiro Check-in, a Home muda o gráfico para a visão **Hoje** e abre esse bloco automaticamente. Assim, o primeiro ponto de Humor e Energia fica visível sem a pessoa procurar controles secundários.

## Cobertura automatizada

| Cenário | Salvaguarda |
|---|---|
| Conclusão de Pra começar | O teste confirma que o destino é `/checkin`, não `/home`. |
| Home sem Check-in | O teste confirma objetivo inicial e CTA visível de primeiro Check-in. |
| Primeiro registro concluído | O teste confirma abertura automática do gráfico em **Hoje**. |
| Onboarding e rotas | A guarda anterior continua validada para conta nova, parcial e concluída. |

## Regressão

Em 20 de agosto de 2026, a PWA passou em typecheck, lint, **65 arquivos / 478 testes** e build de produção com service worker gerado. A candidata local foi aberta em viewport móvel, mas não havia sessão autenticada de conta nova disponível nesse navegador; por isso a comprovação do estado de primeiro acesso foi feita por testes de rota e de renderização estrutural, sem criar ou alterar dados de usuários.

Nenhum commit, push ou deploy foi executado nesta correção.
