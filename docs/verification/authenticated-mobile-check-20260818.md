# Inspeção autenticada mobile — 18 de agosto de 2026

## Conta de validação

A inspeção foi realizada em sessão autenticada e viewport móvel no PWA publicado. As credenciais foram usadas somente no navegador de validação e não são registradas neste documento.

## Achados observados

| Área | Evidência observada | Implicação |
|---|---|---|
| Home | Elementos como “Good afternoon”, “The more consistent your check-ins” e abas “Today / Goals / Patterns / Journal” aparecem junto de “Step 1: Conexão consigo mesma”. | A sessão está em uma combinação indevida de cópia inglesa e portuguesa; a correção de idioma precisa cobrir a shell e não somente Padrões. |
| Padrões | A rota `/insights` tem apenas um check-in e mostra corretamente o estado de aprendizagem, mas a cópia visível permanece em inglês. | A conta ainda não possui volume de fases suficiente para renderizar o Histórico de fases real; a validação visual desse card exige outra conta/dados ou uma sequência de check-ins de teste reversível. |
| Estado de evidência | A tela informa “You have 1 check-in” e os limiares de 3, 7 e 30 dias. | A nova regra de baixa evidência do resultado de check-in é apropriada: não deve apresentar fase conclusiva ou métricas internas ao primeiro registro. |

## Próximo uso desta evidência

Antes de publicar, o fluxo do resultado será validado nesta conta em português e a composição do Histórico de fases será verificada com dados que efetivamente o renderizem. O relatório registra a lacuna encontrada na verificação anterior em vez de tratá-la como concluída.

## Linha de base complementar — Objetivos e instalação

Na mesma sessão autenticada, a Home ainda exibiu o convite de instalação antigo de forma persistente. Em Objetivos, os dados de teste e as ações estavam persistidos, mas a interface alternou rótulos em inglês com conteúdo estruturado em português, inclusive em etapa atual, resultado, ponto de partida e proposta de revisão. Essas telas pertencem à produção anterior ao conjunto de alterações local; elas serão revalidadas depois da publicação autorizada, sem interpretar esta observação como falha da versão local ainda não implantada.
