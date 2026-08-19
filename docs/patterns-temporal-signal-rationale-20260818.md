# Sinais temporais pessoais para a página de Padrões

## Decisão de produto

O card **Sinais antes da queda** não deve inferir que um dia da semana ou do mês determina o humor futuro da pessoa. Esse tipo de associação só é exploratório e, em uma amostra curta, pode refletir coincidência. A interface passará a descrever apenas sequências observadas entre check-ins, duração de fases e retorno após uma mudança, sempre como leitura de registros — nunca como previsão ou diagnóstico.

## Base metodológica consultada

Estudos de sinais precoces em saúde mental trabalham com **mudança ao longo do tempo dentro de uma pessoa**, e não com uma generalização de calendário. A literatura usa séries intensivas e janelas móveis para investigar persistência, variabilidade e recuperação; mesmo nessa condição, os autores destacam que os sinais são sensíveis a ruído e não constituem previsão individual pronta para uso.[1][2]

| Escolha da interface | Regra adotada |
|---|---|
| Menos de 7 dias distintos com registro | Não classificar sinal de queda; explicar que a Airia ainda está conhecendo o ritmo. |
| De 7 a 13 dias distintos | Exibir somente uma sequência observada, com linguagem de baixa confiança e sem recomendação preditiva. |
| 14 ou mais dias distintos | Permitir resumir transições recorrentes e tempo de recuperação, desde que o padrão aconteça em pelo menos dois episódios separados. |
| Sempre | Mostrar a janela e a quantidade de dias observados em linguagem humana; não expor IDs nem métricas internas. |

## Sinais iniciais que cabem no produto atual

O produto já possui humor, energia, sono, fase calculada e datas de check-in. Sem criar diagnóstico, o card pode usar: **mudança recente entre registros**, **dias consecutivos abaixo do próprio nível recente**, **velocidade de recuperação após queda** e **coocorrência de sono percebido baixo com energia menor**, somente quando há dados suficientes.

## Fontes

[1] Curtiss et al., *Rising early warning signals in affect associated with future changes in depression: a dynamical systems approach* — https://pmc.ncbi.nlm.nih.gov/articles/PMC10606954/

[2] Wichers et al., *Critical Slowing Down as a Personalized Early Warning Signal for Depression* — https://karger.com/pps/article/85/2/114/294376
