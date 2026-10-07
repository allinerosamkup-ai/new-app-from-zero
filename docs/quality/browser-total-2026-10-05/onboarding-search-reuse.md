# Busca e reuso — onboarding e Diário

Executor onboarding_executor. Evidência de navegador fornecida por root: refazer onboarding exibiu objetivo salvo, mas reload de Goals não trouxe o objetivo QA.

Fontes: story-onboarding-page.tsx persistCore, POST /objectives strict em index.ts, helpers.ts previewToWriteSubgoals, story-onboarding-page.test.tsx, index.journal.test.ts e journal.service.ts. Histórico git consultado; nenhuma dependência nova, código próprio já disponível.

Causa onboarding: subgoals.order proibido pelo contrato de escrita, erro capturado silenciosamente e checkmark de sucesso posterior. Reusar projetor de escrita; preservar sequência. Falha precisa interromper completion, ficar visível e retry preservar objetivos já confirmados nesta passagem. Não remover objetivos antigos.

Diário: cada sessão criada recebe a mesma nota de Check-in. Candidato: consultar mensagem idêntica da mesma pessoa no dia antes de importar, conservando fonte original; sem serviço, schema ou conteúdo sintético adicional. Limitação: prevenção por consulta não garante exclusão concorrente atômica.

Sem aprovação própria, sem publicação.
