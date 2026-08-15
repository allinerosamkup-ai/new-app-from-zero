# Airia Reading Envelope v1

Status: contrato operacional atual. Esta especificação complementa a
Constituição e prevalece sobre respostas locais de tela.

## Fonte única

`GET /api/airia/reading` devolve a leitura persistida para Home, Check-in,
Resultado, Padrões, Diário, Aura, Objetivos e superfícies auxiliares. Uma tela
apresenta o envelope; ela não recalcula fase, alerta ou decisão concorrente.

```text
observações brutas -> estado atual + dinâmica intradiária -> padrões elegíveis
-> capacidade e segurança -> decisão ancorada -> feedback persistido
```

O envelope contém `version`, `generatedAt`, `currentState`, `period`, `alerts`,
`riskSafety` e `decision`. Todos os campos de interpretação carregam evidência
ou limitação. Uma decisão referencia sua evidência, padrão, destino operacional
e o snapshot que a originou.

## Três janelas

O dia ativo é dividido em `morning`, `midday` e `evening` a partir de fuso,
hora de acordar e de dormir. Sem preferências, a Airia usa janelas seguras e
amplas; ela se calibra pelo histórico, sem exigir configuração.

Cada janela pode receber um lembrete discreto uma vez. Registrar de manhã não
suprime meio do dia ou encerramento. Registros voluntários extras são
preservados, mas não fazem aquele dia pesar mais que outro na análise semanal
ou mensal. Ausência de janela é ausência, nunca valor neutro.

## Leitura temporal

- Um ponto informa o estado agora.
- Dois pontos permitem afirmar mudança no dia.
- Três pontos válidos permitem descrever oscilação intradiária.
- Estado atual usa a última observação; nunca a média diária.
- Semana e mês usam dias distintos e cobertura das janelas. Métricas de
  variabilidade são descritivas, não diagnóstico.

O comparativo pessoal deve priorizar o mesmo período do dia. Padrões só podem
calibrar decisão se forem verificados, atuais, relevantes, seguros e ancorados
em Objetivo, Ação, intenção ou relato atual.

## Decisão e retorno

`AiriaDecision` possui os estados `proposed`, `accepted`, `corrected`,
`rejected`, `done` e `substituted`. O único retorno operacional permitido é
confirmar, corrigir ou vetar a proposta. Ação aceita, correção e conclusão são
gravadas no backend e reaparecem em todas as superfícies e aparelhos.

Segurança é parte do envelope e vem antes da decisão comum. Quando a rota exige
apoio humano ou crise, nenhuma tela oferece recomendação concorrente.

## Pesquisa usada na decisão

O desenho de três observações breves por dia e a separação entre estado,
trajetória e instabilidade seguem estudos de avaliação ecológica momentânea:

- Noë et al. (2017), [momentary mood versus daily recall](https://link.springer.com/article/10.1186/s13104-017-2808-1).
- Boemo et al. (2022), [usabilidade e carga de três avaliações diárias](https://pubmed.ncbi.nlm.nih.gov/35343900/).
- Jahng, Wood e Trull (2008), [métodos temporais para instabilidade afetiva](https://pure.skku.edu/en/publications/analysis-of-affective-instability-in-ecological-momentary-assessm/).

As fontes orientam a engenharia de coleta e a linguagem de incerteza; não
autorizam diagnóstico ou conduta clínica.
