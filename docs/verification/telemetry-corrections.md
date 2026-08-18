# Matriz de Verificação — Dados e Telemetria do Núcleo Ativo

## Regra de escopo

O produto deve registrar **ações semânticas**, e não cada toque físico. Uma ação entra como evento quando altera estado, inicia uma operação relevante, confirma ou descarta uma decisão, falha, é enfileirada offline ou produz uma leitura entregue à pessoa. Controles puramente visuais, digitação em andamento e textos livres não são telemetria de produto.

## Critérios de aceite

| ID | Entrega | Critério verificável | Evidência mínima | Peso |
|---|---|---|---|---:|
| EV-01 | Catálogo de eventos | Nome desconhecido ou sem versão é rejeitado no servidor | Teste de contrato | 1,0 |
| EV-02 | Privacidade de eventos | Campo fora da allowlist e texto livre sensível são rejeitados | Teste de contrato negativo | 1,0 |
| EV-03 | Idempotência | Repetição do mesmo `eventId` do mesmo usuário não cria segunda linha | Teste de serviço/integração | 1,0 |
| EV-04 | Autorização | Usuário não pode criar, listar ou consultar evento de outra pessoa | RLS + teste autenticado | 1,0 |
| EV-05 | Check-in | Abertura, tentativa, bloqueio, conclusão, fila offline e falha são registrados sem valores de saúde | Teste de fluxo e inspeção de payload | 1,0 |
| EV-06 | Decisão diária | Apresentação e feedback de decisão ficam ligados ao `decisionId`; feedback canônico não é duplicado | Teste de fluxo | 1,0 |
| EV-07 | Home, Padrões, Diário e Objetivos | Cada fluxo tem eventos de jornada relevantes e nenhum evento de click irrelevante | Testes de componentes e catálogo | 1,0 |
| EV-08 | Confiabilidade | Endpoint aplica limite de volume e aceita evento offline com `occurredAt` válido | Teste de contrato + teste de limite | 0,75 |
| EV-09 | Retenção e governança | Migração define expiração de telemetria e conserva registros de domínio | Migração revisada e teste SQL | 0,75 |
| EV-10 | Segurança Supabase | Não há erro crítico de advisor relativo às alterações; RLS e permissões das novas estruturas são verificadas | Advisor + inspeção de políticas | 1,0 |
| EV-11 | Qualidade | Typecheck, lint e testes passam; avisos preexistentes são documentados separadamente | Logs de CI local | 0,5 |

## Nota de aceite

A nota final é a soma dos pesos aprovados, em escala de 0 a 10. A entrega só pode ser considerada pronta com **nota igual ou superior a 8,0**, sem falha em EV-02, EV-03, EV-04, EV-05 ou EV-10. Uma revisão independente deve listar qualquer risco residual e pode reprovar a entrega mesmo acima da nota numérica quando houver exposição de dados pessoais, falha de isolamento entre usuários ou quebra de fluxo crítico.

## Trilhas independentes de verificação

| Trilha | Papel | Saída |
|---|---|---|
| Contratos e testes | Exercitar validação, idempotência, autorização e fluxos de interface | Resultado reproduzível de testes |
| Banco e segurança | Inspecionar migrações, RLS, permissões, advisor e retenção | Lista de lints e políticas verificadas |
| Revisão de arquitetura | Examinar diff, catálogo e minimização de dados sem participar da implementação | Parecer com nota e riscos residuais |
| Jornada de produto | Validar que os eventos respondem perguntas de produto sem captar conteúdo pessoal | Matriz evento → pergunta → propriedades permitidas |
