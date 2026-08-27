# Matriz mínima de simulação humana

Camada independente. Pode bloquear entrega com testes técnicos verdes. Não usa conta real, registro privado nem produção.

## Personas

| Persona | Objetivo | Perguntas |
|---|---|---|
| Pessoa nova | Descobrir valor sem conhecer a IA | O que é isso? O que faço agora? O que acontece se eu tocar? |
| Pouca energia | Só o essencial | Próximo passo óbvio? Caminho curto? O texto cobra mais do que ajuda? |
| Pressa | Registrar e sair | Poucos toques? O app guardou? |
| Confusa ou ansiosa | Distinguir fato, hipótese, sugestão | Como discordo? |
| Recorrente | Retomar decisão e ver progresso | Contexto correto? Algo reapareceu indevido? |
| Estado sensível | Linguagem proporcional, sem diagnóstico | Acolhe sem prescrever, assustar ou abandonar? |

Ticket de superfície cotidiana exige pelo menos: nova, recorrente, baixa energia.

## Primeiro ciclo (ativação)

1. Conta nova autenticada cai em `/comecar`, não em `/home`.
2. Declara pelo menos um objetivo; ele existe em `/goals` depois.
3. Primeiro Check-in: humor e energia bastam.
4. `/home` mostra foco, CTA ou gráfico de Hoje, sem mural vazio.
5. A ação proposta tem âncora no objetivo, não no texto de conversa.

## Evidências

1. Roteiro percorrido (passo e rota)
2. Fricções
3. Confiança percebida

Dados: contas de teste declaradas, fixtures sintéticas, cenários determinísticos.
