---
name: airia-code-integrity
description: Audite e corrija erros de integracao da Airia, incluindo rotas quebradas, contratos divergentes, caminhos obsoletos, chamadas sem persistencia e codigo morto que prejudique fluxos reais do produto.
---

# Integridade do Produto Airia

Audite por fluxo completo, nunca por arquivo solto: entrada, contrato, autenticacao, persistencia, retorno, erro e proxima tela.

1. Liste referencias obsoletas, rotas sem destino, handlers sem endpoint e telas sem fluxo real.
2. Preserve capacidade ainda usada por Planner e Airia; aposente superficies quebradas por redirecionamento ou remocao de navegacao antes de excluir dados.
3. Remova codigo apenas depois de prova de que nao ha consumidor. Nunca remova migrations, dados ou APIs compartilhadas por suposicao.
4. Rode lint/tipos, testes afetados, build e um fluxo autenticado de regressao.

**Como verificar:** nao deve haver rota exposta sem tela funcional, botao sem chamada real, nem referencia resolvida por fallback silencioso.
