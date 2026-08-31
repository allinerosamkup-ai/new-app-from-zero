# Rubrica de Avaliação Independente: Padrão Nota 8–10 e "Impressionado"

> **Fonte Normativa:** [`docs/product/MULTIAGENT_GOVERNANCE.md`](../product/MULTIAGENT_GOVERNANCE.md#8-o-padrão-de-verificação-nota-810-e-impressionado)  
> **Escopo:** Todos os verificadores independentes de página, de especialistas e o Verificador Global.

---

## 1. Princípio da Verificação

Aprovar não é apenas confirmar ausência de erro técnico ou cumprimento burocrático do ticket.
**"Impressionado"** significa que o verificador identificou evidências concretas de que a entrega tornou o produto mais claro, mais seguro, mais simples ou mais coerente do que a solução mínima esperada.

---

## 2. Dimensões Ponderadas de Avaliação

| Dimensão | Peso | Critério de Excelência (8,0 a 10,0) |
|---|---|---|
| **Fidelidade à Intenção** | 20% | Resolve a necessidade humana real, e não apenas o sintoma técnico imediato. |
| **Funcionamento e Dados** | 20% | Estados, persistência, tratamento de erros, idempotência e efeitos entre telas estão íntegros. |
| **UI/UX e Acessibilidade** | 20% | Hierarquia visual, área de toque móvel, texto legível, contraste, estados de erro/vazio/carregamento e uso com uma mão funcionam sem fricção. |
| **Segurança e Privacidade** | 15% | Zero exposição de dados ou segredos, zero mutação destrutiva sem confirmação, conformidade LGPD e RLS estritos. |
| **Qualidade de IA e Conteúdo** | 15% | Prompts ancorados em contexto real, verbos executáveis, ausência de respostas genéricas, respeito ao idioma e segurança clínica sem dramatização. |
| **Manutenibilidade** | 10% | Código modular, testes sólidos, contratos tipados, ausência de duplicidade e documentação clara. |

---

## 3. Critérios Obrigatórios para Aprovação (Gate de Aceite)

Para uma entrega ser declarada **APROVADA**, **TODAS** as condições abaixo devem ser cumpridas:

1. **Nota Ponderada Global:** $\ge 8,0 / 10,0$.
2. **Piso Individual:** Nenhuma dimensão com nota menor que $7,0 / 10,0$.
3. **Zero Bloqueios Críticos:** Sem falhas de segurança, corrupção de dados, regressão ou quebra de jornada.
4. **Testes Automatizados Verdes:** 100% dos testes do ticket e testes de regressão passando.
5. **Aprovação do Simulador Humano:** Validação satisfatória das personas aplicáveis (Pessoa Nova, Baixa Energia, Pressa, Confusa, etc.).
6. **Dois Aspectos "Impressionantes":** Registro explícito de pelo menos 2 pontos superiores à solução mínima.
7. **Coerência Global:** Confirmação de que a entrega não quebra o núcleo ativo nem outra jornada do produto.

---

## 4. Estrutura do Parecer do Verificador

```markdown
### Parecer de Verificação Independente
- **Ticket / Branch:** `AIRIA-TICK-XXX` / `feature/XXX`
- **Verificador:** `[Nome / Papel]`
- **Data:** `AAAA-MM-DD`

#### Notas por Dimensão
1. Fidelidade à Intenção (20%): `[Nota / 10]` — `[Justificativa]`
2. Funcionamento e Dados (20%): `[Nota / 10]` — `[Justificativa]`
3. UI/UX e Acessibilidade (20%): `[Nota / 10]` — `[Justificativa]`
4. Segurança e Privacidade (15%): `[Nota / 10]` — `[Justificativa]`
5. Qualidade de IA e Conteúdo (15%): `[Nota / 10]` — `[Justificativa]`
6. Manutenibilidade (10%): `[Nota / 10]` — `[Justificativa]`

**NOTA FINAL PONDERADA:** `[X.X / 10.0]`

#### Aspectos Impressionantes (Mínimo 2 Obrigatórios)
1. **[Aspecto 1]:** [Explicação com evidência observável]
2. **[Aspecto 2]:** [Explicação com evidência observável]

#### Bloqueios / Recomendações
- [Bloqueios impeditivos, se houver]
- [Recomendações não impeditivas para ciclos futuros]

#### Veredito: `[APROVADO | REPROVADO | BLOQUEADO]`
```
