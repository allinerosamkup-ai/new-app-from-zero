# Airia State Intelligence — dossiê de pesquisa e decisões

**Data:** 2026-10-02 · **Ticket:** AIRIA-SI-20261002 · **Base inspecionada:** `5dcf2ad`.
**Natureza:** entrega documental. Nenhum cálculo, sensor, intervenção, tela ou benefício descrito aqui foi implementado ou validado por esta tarefa. A [constituição](../PRODUCT_CONSTITUTION.md) continua canônica; este dossiê não cria uma segunda constituição.

## Decisão executiva

Evoluir a fonte comum de contexto da Airia, sem um motor paralelo. Investigar manifestação como experiência opcional de intenção, imaginação e ação possível; não como predição de eventos externos. Recomendar um primeiro piloto web sem sensores obrigatórios, com uma direção contextual e uma proposta corrigível.

**Quatro direções autorais** — Acolher, Regular, Alinhar e Expandir — são a apresentação recomendada para teste. Elas não substituem as oito fases atuais, não formam uma hierarquia e não classificam identidade ou consciência. A apresentação numérica fica em experimentos de pesquisa, não no primeiro fluxo consumidor. Nenhuma experiência fica bloqueada por “vibração baixa”.

Planejador e Rotinas foram explicitamente excluídos pela titular; Hábitos, Pomodoro, Agenda e Corrida também não são destinos desta proposta. Uso somente de Check-in, Home, Objetivos, Diário, Insights, Aura e Preferências; `/comecar` conserva ativação existente.

### Os 14 entregáveis

| # | Entregável | Destino |
|---|---|---|
| 1 | Research Memo, evidência e limites | [Ciência](scientific-evidence.md), [autores](interpretive-frameworks.md), [plataformas](platforms-and-privacy.md), §1 |
| 2 | Construct Dictionary | §2 |
| 3 | Measurement Matrix | §3 |
| 4 | Scoring Specification V1 | §4 |
| 5 | Confidence Model | §5 |
| 6 | Goal-State Model | §6 |
| 7 | Intervention Decision Matrix | §7 |
| 8 | Pre/Post Protocol | §8 |
| 9 | Personalization Strategy | §9 |
| 10 | Outcome Tracking | §10 |
| 11 | UX Flow | §11 |
| 12 | Privacy/Claims Review | §12 e [privacidade](platforms-and-privacy.md#6-privacidade-e-governança-de-dados) |
| 13 | MVP Scope | §13 |
| 14 | Implementation Plan | [Plano posterior](../../plans/2026-10-02-state-intelligence.md) |

## 1. Pesquisa, contexto atual e decisões de reuso

### 1.1 O que a evidência permite concluir

Valência e ativação são dimensões úteis de experiência afetiva; disposição para agir é uma dimensão distinta. Sensor de pulso não identifica intenção nem emoção específica. Estudos em repouso mostram viabilidade de algumas implementações PPG; não validam o algoritmo, o hardware ou a população da Airia. Tempo de coleta, artefatos e baseline exigem protocolo próprio. Ver métodos, amostras e limitações no [memo científico](scientific-evidence.md).

Os autores espirituais oferecem doutrinas, relatos e significado cultural, não validação dos índices propostos. Adaptações serão autorais e avaliadas por utilidade, compreensão e segurança. Não copiar mapas Hawkins, materiais RH, traduções ou instrumentos sem direitos documentados. Ver [análise de fontes originais/oficiais](interpretive-frameworks.md).

### 1.2 Ideal, contrato, implementação e lacuna

| Camada | Verificado nesta pesquisa | Decisão |
|---|---|---|
| Ideal | Estado + contexto + orientação + confirmação + aprendizagem | Medir valor incremental e prejuízo, não apenas funcionamento da soma |
| Contrato vigente | Fonte comum, autonomia confirmável, sinais atuais, risco e padrão verificado com evidências | Preservar; sugestões nunca nascem somente de doutrina/RAG |
| Implementado, leitura estática | Contexto central, CheckinApplicationService, proveniência relatada/inferida/ausente, MoodCycleEngine, feedback negativo, shell Android e módulo Health Connect | Reusar com contratos de entrada/saída auditados; existência não prova runtime |
| Lacuna | Validade dos constructos, qualidade/baseline de sensor, crenças consentidas, sessão pre/post e efeitos adversos, benefício dos quatro nomes | Nova pesquisa/células posteriores, sem promessa de recurso pronto |

Fontes de código: `packages/shared/src/mood-cycle-engine.ts`; `apps/backend/src/services/context-grounding.service.ts`; `apps/backend/src/services/checkin-application.service.ts`; `apps/backend/src/contracts/checkin-draft.contract.ts`; `apps/backend/src/lib/risk-safety.ts`; `apps/backend/src/services/ai-action-feedback.service.ts`. Superfícies consumidoras devem receber a mesma versão da leitura, não calcular scores locais independentes.

### 1.3 Divergências que impedem reuso cego

1. **Motor versus constituição:** a constituição §5.1 descreve composto humor×0,6 + energia×0,4 e estado misto por simultaneidade. O motor rastreado na base usa EWMA do humor com alpha 0,3, limites absolutos e volatilidade >2,4 para `mixed`. `slice(-7/-14)` seleciona dias registrados, não necessariamente dias corridos. O comentário clínico/tipo também não é prova científica. Não usar fases como classificação dos novos estados; reconciliar comportamento/contrato/testes numa tarefa própria antes de apoiar prontidão nas fases.
2. **Ausência de saúde vira número:** módulo Android soma janela ontem 00:00→agora, sem cobertura/origem explícita; sono ausente pode virar `0` minutos e score `5`. Corrigir/adaptar missing, janela, paginação/deduplicação e origem antes de usar no State Engine. Nenhuma leitura diária média vira sinal de agora.
3. **HRV histórica inválida:** `apps/mobile/src/presentation/screens/HrvTestScreen.tsx` estima RMSSD por `3000 / bpm`. Rejeitado: frequência média não fornece intervalos nem HRV. O shell atual é WebView, não prova que essa tela esteja ativa.
4. **Linguagem do prompt:** `airia-method.ts` e `aura-prompt.ts` proíbem no texto visível termos como prática/exercício/protocolo/janela disponível. Exemplos deste dossiê são candidatos de pesquisa. Uma célula posterior precisa compatibilizar copy autorizada e todos os consumidores; não alterar prompt nesta entrega.
5. **Segurança parcial:** `risk-safety.ts` usa expressões e alguns scores; não demonstra detecção robusta de grandiosidade, negação de realidade ou aceleração combinada. Recurso espiritual não pode depender desse detector como garantia completa.

### 1.4 Busca/reuso antes de inventar

Inspeção de status/worktrees, histórico e branches foi feita antes de criar branch documental. Nenhum dossiê correspondente apareceu na busca inicial docs/skills. A cópia `airia-integrated-checkin` tem motor semelhante, não resolve a divergência. Histórico consultado inclui `a5644d7` (contexto/memória adaptativa), `50b569c` (relato de conclusão), `84e36e7` (APK) e `87fadda` (preparação mobile); títulos não significam validação do State Engine. Manifest atual inclui Expo 51, RN 0.74.5, Zod, Prisma e WebView; não contém dependência PPG que certifique a proposta.

Escolhas: reusar validação/persistência do Check-in, leitura comum e memória negativa; adaptar proveniência/consentimento; rejeitar aproximação HRV, fases como mapa espiritual e leitura de média diária como medida atual. Não adicionar SDK antes de escolher protocolo e verificar licença/manutenção. Pesquisa externa usa artigos originais e documentação oficial, com candidatos/licenças nos memos. Não foi feita revisão sistemática exaustiva nem varredura linha a linha de todas as worktrees legadas; existência de solução futura deve ser rechecada antes do código.

## 2. Dicionário de constructos

Tipo epistêmico acompanha cada **observação**, não só a variável: o sono pode ser relatado ou importado; estado interpretativo nunca se torna medição. Distinguir modalidade bruta de estimativa derivada de hardware.

| Constructo | Definição operacional mínima | Status V1 e limite |
|---|---|---|
| VA — valência | Agradabilidade da experiência atual, relatada ou hipótese contextual confirmável | Item autoral experimental; humor existente é proxy, não equivalência validada |
| AR — ativação | Experiência atual de quietude/ativação, distinta de disposição | Item autoral experimental; não inferir de energia isolada |
| EN — energia | Disposição percebida no Check-in, escala própria existente | Reusar campo 1–10; não joules, arousal ou poder espiritual |
| PR — regulação fisiológica | Interpretação de sinais autonômicos comparáveis com baseline | Não disponível como medida direta; sensor mede sinal, regulação é inferência limitada |
| AS — assunção/naturalidade | Relato de quão plausível/compatível parece uma experiência desejada | Narrativa opcional, não certeza obrigatória nem escala validada |
| BC — congruência crença–objetivo | Hipótese sobre tensão entre relato contextual e objetivo | Consentida/corrigível; sem score V1 ou leitura de “crença verdadeira” |
| NR — não resistência | Relato de pressão/urgência/ruminação na experiência escolhida | Não ausência de medo universal; não exigir aceitação de injustiça |
| EB — incorporação comportamental | Relação entre ação sob controle e intenção confirmada | Evidência de ação, não identidade; barreira material não é falha espiritual |
| GS — semelhança estado–alvo | Distância descritiva entre dimensões comparáveis e alvo confirmado | Cálculo experimental §4; não chance de sucesso |
| SC — coerência | Convergências/divergências contextualizadas de sinais | Texto explicativo; discordância não vira defeito moral |
| Alignment | Leitura da relação estado/intenção/próximo passo | Sem nota composta V1; não somar constructos não validados |
| MRS — prontidão | Adequação contextual a uma experiência específica | Categórica: possível/adaptar/não recomendar/insuficiente; não probabilidade |
| VSI | Composto geral de “qualidade vibracional” | Descartado do MVP por redundância e juízo implícito de estado ideal universal |
| Confidence | Adequação da evidência à afirmação específica | Categoria com razões §5; não alinhamento nem certeza do LLM |
| Word Congruence/Fingerprint | Linguagem contextual / associações pessoais recorrentes | Hipóteses opcionais; não análise de frase isolada ou previsão espiritual |

AS/BC/NR não são três medidas independentes demonstradas; suas sobreposições são motivo para não gerar três scores. Dados de ação comprovam ocorrência registrada, não mudança de identidade ou causalidade externa.

## 3. Matriz de medição

| Variável/fonte | Tipo | Unidade/escala | Frequência e disponibilidade | Confiabilidade/limite |
|---|---|---|---|---|
| Humor/energia Check-in | REPORTED; INFERRED se extraído e confirmado por fluxo existente | 1–10 | Registro voluntário com momento/fonte | Subjetivo válido como relato; inferência não supera correção |
| VA/AR autorais | REPORTED | 1–10 com extremos verbais próprios | Somente lacuna relevante; não acrescentar formulário obrigatório | Não validados; testar sem confundir calma com cansaço |
| Clareza/sono/corpo/irritabilidade | REPORTED ou origem importada identificada | Campo/unidade preservados | Opcionais no registro/contexto | SonoScore não é duração; nunca converter sem regra explícita |
| FC/série óptica/intervalos | MEASURED para sinal; métricas derivadas com algoritmo explícito | bpm / intensidade relativa / ms | Sessão validada, futura e opcional | SQI e duração obrigatórios; sem equivalência emoção |
| HRV/PRV | Medida derivada com modalidade e algoritmo | RMSSD/SDNN em ms, separadas | Fonte de saúde/câmera quando existir dado válido | Comparabilidade por dispositivo/contexto; ausente não zero |
| Objetivo/Ação/intenção | REPORTED + ocorrência persistida | Texto, IDs, estados, datas | Atualizados por ação confirmada | Não assumir controle sobre resultado externo |
| Diário/linguagem | REPORTED para texto; INFERRED para hipótese | Trechos contextuais e IDs | Consentimento específico, histórico pertinente | Negação, ironia, citação e mudança de opinião precisam de contexto |
| AS/NR/estado-alvo | REPORTED ou proposta INFERRED antes de confirmar | Texto; dimensões autorais opcionais | Apenas experiência ligada a intenção | Não provar lei espiritual; não obrigar convicção |
| BC/SC | INFERRED | Hipótese narrativa | Quando relevante e autorizada | Evidências e correção; sem precisão numérica |
| Banda/framework espiritual | INTERPRETIVE | Significado autoral escolhido | Opt-in; sem mapa/calibração Hawkins | Não medição/diagnóstico, não universal |

### Envelope proposto, ainda não API

Toda observação deve carregar `userId`, `observationId`, `construct`, `value|null`, `unit/scaleVersion`, `epistemicType`, `sourceRecordId/sourceSurface`, `modality/device/origin`, `observedAt` (ou intervalo), `ingestedAt`, `localDate/timezone`, qualidade com motivo, versão do algoritmo/modelo e referências de consentimento/evidência. Dados derivados guardam IDs dos pais; interpretação guarda framework/version sem apagar fonte. `absent` continua status separado dos quatro tipos. Não fabricar SQI para relato nem inferir confiabilidade da confiança verbal do LLM.

`AiriaReading` atual é cache único por usuário/data, atualizado por upsert; seu campo `version` não garante histórico intradia. Pre/post exige snapshots ou referências imutáveis próprias (§8 e plano), nunca dois IDs apontando para o mesmo cache mutável.

Reusar `signalMetadata` atual que distingue reported/inferred/absent; ampliar em contrato versionado posterior, preservando clientes antigos. A fonte corrigida pela pessoa invalida derivados anteriores e produz nova leitura comum, com referência à versão corrigida. Permissão parcial, falha técnica e dado não observado são razões distintas para ausência quando identificáveis.

## 4. Especificação de cálculo V1 — descritiva e experimental

**Decisão:** não liberar Alignment/VSI/BC/AS/NR compostos 0–100. A literatura consultada não fornece pesos para esses constructos. AS e NR ficam como relatos; BC/SC como hipóteses; prontidão como decisão contextual auditável. As fórmulas do briefing são candidatos rejeitados para publicação V1, não verdades silenciosamente preservadas.

Para simulações de pesquisa, usar `si-descriptive-v1`, nunca trocar o algoritmo de ciclagem nesta etapa:

1. Escala autoral 1–10: `u=(x−1)/9`, somente com semântica e versão iguais. Valor fora do domínio é inválido, não truncado silenciosamente. `null` permanece ausente; zero normalizado é extremo inferior observado.
2. Baseline experimental por fonte/condição: mediana `m` e `MAD=mediana(|x−m|)`; `z=0,6745×(x−m)/MAD` se `MAD>0`, histórico elegível e sem mudança de protocolo. `MAD=0` ou história imatura devolve indisponível; não dividir por epsilon ou inventar desvio. Desvio é contextual, não “melhor/pior”. Não usar z de AR como sinal de produtividade.
3. PRV futura: RMSSD dos intervalos de pulso válidos e SD das séries elegíveis com convenção registrada, conforme memo científico. Não aplicar `3000/bpm`; sem artefatos tratados/protocolo validado não gerar métrica. Importações mantêm tipo/unidade/duração de origem; nenhuma conversão SDNN↔RMSSD.
4. Estado-alvo experimental: cada dimensão confirmada tem intervalo aceitável `[a_j,b_j]⊂[0,1]`. Distância `δ_j=max(a_j−u_j,0,u_j−b_j)`. Em alvo pontual, `a_j=b_j=t_j`. Usar apenas conjunto `J` de dimensões comparáveis válidas e alvo confirmado, com pesos iguais para evitar calibração espiritual arbitrária.
5. `D=√(Σ δ_j²/|J|)` e `GS=100×(1−D)` são descrições de distância com `0≤D≤1`. Pesos iguais são hipótese matemática de pesquisa, não equivalência psicológica. Não duplicar EN dentro de AR. Requerer pelo menos duas dimensões pareadas; se não, GS indisponível. Registrar cobertura `|J|/|T|`, IDs, dimensões, método e limitações. Cobertura parcial não permite comparar GS com observação completa; longitudinalmente usar a mesma máscara/escala/alvo ou declarar incomparável.
6. Nunca multiplicar GS/MRS por Confidence: confundiria estado desfavorável com observação insuficiente. Sensor opcional não abaixa automaticamente confiança do relato nem exclui a pessoa.
7. Pre/post: `Δ_j=post_j−pre_j` somente no par comparável. A direção desejável é proximidade ao alvo ou utilidade relatada, não aumento universal. `ΔGS` só com mesma máscara/versão/alvo/contexto; sem post, delta indisponível.

**Exemplo sintético, não usuária real:** alvo VA `[0,6;0,8]`, AR `[0,3;0,5]`; atual VA `0,5`, AR `0,9`. Distâncias `0,1` e `0,4`, D≈`0,292`, GS≈`70,8`. Se depois AR=`0,5` e VA=`0,5`, GS≈`92,9`. Significa proximidade ao vetor definido; nada informa chance de emprego, cliente, relacionamento ou cura. Se faltar AR, há só um par: GS indisponível, não zero nem 95.

**Decisão editorial de pesquisa:** primeiro preservar relato, risco e intenção; depois escolher apoio adequado. Acolher quando a âncora atual pede proteção; Regular quando há sobrecarga/ativação problemática; Alinhar quando há margem para preparar um passo; Expandir somente com contexto suficiente, passo seguro e capacidade compatível. Insuficiência não recebe direção automaticamente. Nenhum limiar numérico novo é vendido como validado: o piloto começa como proposta narrativa corrigível, com avaliação humana e de segurança.

Validação: congelar hipótese/escala e casos antes do piloto; comparar utilidade, correções e dano com a orientação atual, testar redundância e capacidade de responder a mudança. Só depois decidir se GS agrega valor visível. Uma fórmula reproduzível não demonstra validade do constructo.

## 5. Modelo de confiança

Vetor de adequação por afirmação: **qualidade**, **recência**, **cobertura**, **comparabilidade/maturidade** e **conflito**. Sem probabilidade calibrada V1. Recência usa instante da observação e mudança de contexto, não instante do sync.

| Categoria | Regra descritiva | Devolução |
|---|---|---|
| Insuficiente | Fonte requerida ausente/inválida, alvo não confirmado, dado de estado desatualizado ou conflito indispensável não resolvido | Não calcular aquela afirmação; pergunta mínima ou explicação |
| Parcial | Há base para uma hipótese limitada, mas falta dimensão/contexto ou histórico comparável | Explicar fonte e lacuna; sem “corpo regulado” se só há relato |
| Suficiente para esta leitura | Fontes exigidas para aquela afirmação presentes, atuais/comparáveis, sem conflito essencial | Exibir motivo e permitir correção; não dizer certeza clínica |

Regras distintas por finalidade: leitura momentânea exige relato/contexto atual; baseline exige histórico comparável; antes/depois exige par equivalente. Estado de hoje anterior a evento relevante fica desatualizado mesmo no mesmo dia. No piloto, “atual” significa registro da sessão ou confirmação de que último registro do dia ainda representa o momento; não herdar estado de ontem como agora. Prazo quantitativo por sensor será definido e validado no experimento de aquisição.

Sinal ruim invalida apenas a componente fisiológica. Relato recente continua utilizável. Contradição de sensor e tranquilidade relatada permanece explícita, sem decidir que o sensor revela a verdade. Maturidade de baseline não é prazo universal de 7–14 dias: usar quantidade, diversidade, consistência e precisão conforme protocolo; política fica congelada antes de coleta real.

## 6. Modelo de estado-alvo por objetivo

Reusar Objetivo/intenção existente, resultado externo e Ações; não converter tudo em “desejo” nem exigir reformular objetivos antigos. A Airia pode propor uma descrição simples do estado que ajuda a dar o próximo passo, usando o que a pessoa já contou. Ela confirma/corrige/veta; não pedir simultaneamente que classifique capacidade e escolha prioridade.

Proposta de estrutura futura: `goalId`, resultado/significado existentes, `targetStateVersion`, descrição autoral, dimensões opcionais com escala e intervalo, ação sob controle, barreiras/contexto, parte fora do controle e critérios observáveis de progresso. Registrar origem inferida até confirmar; não criar valores como “segurança 90” a partir de um texto genérico. Sem confirmação, nenhuma distância numérica.

Estado-alvo não é única condição para agir nem obrigação emocional. Objetivo financeiro pode pedir “clareza para revisar uma proposta”, não fé absoluta nem euforia. Dimensões opcionais só entram se úteis; identidade fica narrativa, nunca uma variável de saúde. Revisão do objetivo/estado-alvo inicia versão nova e impede comparações retroativas artificiais.

## 7. Matriz de decisão de experiências

São candidatas autorais a validar, não prescrições nem promessas clínicas. Ordem obrigatória: risco → veto/consentimento → fonte atual → intenção/ação → margem → preferência → proposta → confirmação. Contexto atual pode justificar pausa sem inventar tarefa. RAG nunca grava Ação sozinho.

| Situação contextual | Direção e proposta candidata | Destino ativo / critério de encerramento |
|---|---|---|
| Crise/necessidade de apoio humano | Interromper coaching de manifestação e renderizar rota `riskSafety` adequada | Check-in/Diário/Aura, apoio humano; score não revoga rota |
| Baixa energia/sofrimento sem risco crítico | Acolher; reduzir uma Ação pendente ou proteger pausa | Home/Objetivos; passo mínimo confirmado ou pausa respeitada |
| Urgência/agitação/ruminação | Regular; pausa confortável ou escrita curta contextual | Diário/Aura; pode parar sem terminar; sem hiperventilação/retenção |
| Margem suficiente, intenção confusa | Alinhar; Airia propõe uma frase de intenção a confirmar | Aura/Objetivos; texto confirmado, sem obrigar ritual |
| Quer imaginar e contexto é seguro | Cena cotidiana opcional ligada ao próximo passo | Aura/Diário; encerrar quando esclarecer passo, não quando “sentir perfeito” |
| Declara tensão entre crença e objetivo | Hipótese com exemplo contextual; reformulação plausível corrigível | Diário/Aura; confirmação/correção, nunca “BC 34” inferido |
| Passo seguro já claro/capacidade disponível | Expandir; iniciar uma Ação existente, sem ampliar carga automaticamente | Objetivos; verbo/objeto/Pronto quando persistidos após aceite |
| Sem preferência espiritual, visualização difícil ou rejeitada | Orientação prática equivalente ou encerrar | Mesmos destinos, sem penalidade ou repetição insistente |
| Piora após experiência | Parar, registrar efeito adverso, rever segurança e evitar repetir proposta | Aura/Diário; suporte proporcional e veto persistido |

Prontidão é específica: visualização requer desejo de participar e margem para imaginar; ação concreta requer clareza/capacidade; liberação não requer “score alto”. “Condições favoráveis para esta experiência” substitui relógio de janela universal. Sem certeza externa, push de urgência espiritual ou necessidade de aproveitar um instante antes que se feche.

## 8. Protocolo antes/depois

1. Vincular episódio a intenção/Objetivo confirmado; guardar fonte/versão, contexto, preferência e consentimento.
2. Capturar o mínimo faltante antes, com horário e escala; sensor é opcional e separado. Nunca copiar valor inferido como novo relato.
3. Propor uma experiência curta com finalidade concreta, saída livre e duração candidata, sem promessa de aumentar score. A pessoa pode ir direto à ação.
4. Registrar início, conclusão, interrupção, escolha/correção e efeito adverso; não equiparar abrir tela com realizar experiência.
5. Fazer uma única oferta de pós-relato, opcional, nas mesmas dimensões/escala. Se houver sensor, mesmo protocolo/condição; medida durante respiração não equivale a após repouso.
6. Explicar mudança/neutro/piora e perguntar utilidade quando necessário. Sem post: episódio incompleto, não sucesso presumido. Não repetir medições para perseguir pontuação.
7. Propor próximo passo ligado à âncora existente; confirmação antes da persistência de nova Ação, respeitando itens concluídos/rejeitados/adiados.

No desenho de pesquisa, congelar duração, intervalo de post e follow-up antes de coleta; primeiro ensaio UX pode testar experiência de até dois minutos e post imediato como hipóteses de carga, sem extrapolar evidência de exercícios de cinco minutos. Fonte científica e desenho autoral são distintos. Respiração confortável nunca exige contagem/retenção. Não concluir “funcionou para você” por uma única sessão: dizer “Você relatou mudança nesta sessão”.

## 9. Estratégia de personalização

| Estágio | O que pode aprender | Gate e limite |
|---|---|---|
| Cold start | Preferência/recusa, intenção e relato atual | Sem sensor, baseline ou score composto; resposta útil com pouco dado |
| Histórico pessoal | Variação por fonte/contexto, distribuição e associações | Maturidade definida no protocolo; não dizer normalidade clínica |
| Resposta a experiências | Utilidade, melhora/neutro/piora, interrupção e continuidade | Sessões comparáveis, resultados adversos incluídos; não otimizar somente delta fisiológico |
| Padrão verificado | Associação útil à decisão atual | Piso constitucional: 3 evidências em 2 dias, sem duplicatas, ativo/corrigível; isso não basta para estimativa estatística de eficácia |
| Modelo individual | Recomendar opção com histórico mais favorável | Só após protocolo/poder/precisão pré-definidos e validação temporal; sem personalizar pesos com amostra mínima arbitrária |

Não implementar bandit/exploração automática de experiências espirituais ou intensificadoras no MVP. Prioridade é segurança, preferência e utilidade; adversidade não entra como “resistência que precisa insistir”. Separar treino de avaliação temporal, controlar mudança de dispositivo/escala e evitar vazamento do resultado futuro. Novo contexto ou correção pode invalidar associação antiga.

Fingerprint permanece um conjunto descritivo de condições recorrentes, com tamanho de amostra e limites, não estado ideal universal. Padrões podem adaptar uma decisão ancorada, nunca fabricar compromisso ou garantir manifestação. Avaliar “teoria não sustentada nos seus registros” quando houver dados suficientes contrários, sem reinterpretá-los para salvar a teoria.

## 10. Registro de resultados e teste das hipóteses

| Classe | Exemplo e evidência | Não concluir |
|---|---|---|
| Interno | Relato de menor pressão, clareza ou piora; par de observações | Que mudança foi causada pelo ritual ou dura além da sessão |
| Comportamental | Ação existente iniciada/concluída com recibo, ou relato identificado como relato | Que intenção foi materializada sem ocorrer ação |
| Progresso externo | Etapa/resultado declarado ou documento voluntariamente fornecido, com tipo de evidência | Que score/estado causou evento ou controla outra pessoa |
| Sincronicidade subjetiva | Evento percebido pela pessoa como significativo | Que é resultado objetivo, previsão acertada ou causalidade |

Proposta futura: episódio guarda outcomeType, observedAt, evidência/referência, origem relatada/verificável, relação com Objetivo/Ação, estado neutro/positivo/negativo e contexto concorrente. Nenhum extrato/documento financeiro será requerido para provar progresso. “Não sei” e ausência de retorno são resultados disponíveis distintos de zero progresso.

Hipóteses a pré-registrar: menor pressão associa-se a maior utilidade? cena imaginada acrescenta clareza comparada à orientação prática? direções reduzem carga e aumentam correções compreendidas? sinal fisiológico melhora decisão além do relato? Relacionar MRS a resultado externo fica fora do MVP; acompanhar associação exploratória, não anunciar causalidade.

Registrar alta prontidão sem progresso, baixa prontidão com progresso, prática neutra/com piora e abandono. Avaliar antes/depois com grupo ou condição comparável para inferência causal futura; escolher um desfecho primário e limitar múltiplas comparações antes de recrutar. Não ajustar pesos até aparecer uma história conveniente.

## 11. Fluxo e comparação de UX

| Opção | Benefício potencial | Risco | Decisão |
|---|---|---|---|
| Uma direção + motivo + próximo passo | Orientação rápida e compatível com baixa energia | Nomes parecerem uma hierarquia/novo diagnóstico | Recomendada para teste; explicação contextual, correção e sem ranking |
| Alignment 0–100 + subnotas | Descrição numérica e comparação | Falsa precisão, perseguição de nota, redundância, julgamento moral | Apenas pesquisa; não UI principal V1 |
| Orientação atual sem novos nomes | Menor mudança e baseline de comparação | Não acrescentar valor novo | Condição controle e fallback legítimo com limitação explícita |

Pessoa nova: `/comecar` conserva Objetivo persistido → primeiro Check-in (humor/energia bastam) → Home útil. Sem formulário espiritual na ativação, sem pedir capacidades e prioridade já inferíveis. Recorrente: usar último contexto válido, propor foco e permitir trocar. Baixa energia: uma proposta curta, pausar/recusar sem dívida ou sequência de dias.

Preferências: orientação prática por default; opção espiritual leve explícita e reversível, sem perguntar religião. Linguagem espiritual intensa (“campo”, poder extraordinário) não entra no MVP: valor não comprovado e risco de reforço/ambiguidade. Escolha de estilo não muda scores, segurança ou direito à ajuda.

Check-in resultado/Home mostram **o que faz sentido agora + motivo atual + um próximo passo**; evidências ficam acessíveis sem mural de índices. Aura conduz e permite encerrar; Diário mantém reflexão; Objetivos preserva CRUD e ações concretas; Insights apresenta associações com limites e contraprovas. Todas leem mesma revisão; modo offline/erro não chama proposta de “salva” sem recibo. Conteúdo dinâmico pt-BR/en e linguagem de risco devem ser equivalentes.

Protótipo futuro terá loading, vazio, erro, retry, sucesso real, duplo clique/idempotência, reload, foco/teclado/reduced-motion e tamanhos 320×800, 390×844, 768×1024 e desktop. Estes são critérios futuros; nenhuma tela foi criada nesta entrega.

## 12. Segurança, direitos e claims

Energia alta junto de sono reduzido, aceleração, irritabilidade, impulsividade ou relato de poder excepcional exige contenção e avaliação contextual. Não diagnosticar por combinação de scores; tampouco ampliar decisões financeiras/afetivas irreversíveis. Apoio humano/crise prevalece sobre qualquer ritual e deve aparecer em Check-in, Diário e Aura. Fonte oficial contextual: [NIMH — bipolar disorder](https://www.nimh.nih.gov/health/topics/bipolar-disorder); não é validação do detector da Airia.

| Pode ser comunicado, com fonte | Proibido como fato ou incentivo |
|---|---|
| “Você relatou mais tranquilidade depois desta pausa” | “O exercício regulou seu sistema nervoso” sem medida/validade |
| “Seu registro sugere preparar uma conversa curta” | “Você está em baixa vibração” / culpa pela perda |
| “A leitura do pulso não teve qualidade suficiente” | Inventar FC/HRV/Alignment quando dado falta |
| “A cena imaginada pode ajudar a esclarecer o passo” | Garantir oportunidade, dinheiro, relacionamento ou cura |
| “Há uma associação nos registros disponíveis” | Tratar correlação como causa ou validar doutrina por coincidência |
| “É uma interpretação autoral opcional” | Hz espiritual, relógio que mede consciência, mapa/licença/endosso presumidos |

Privacidade segue [requisitos e fontes oficiais](platforms-and-privacy.md): minimização, finalidade/base legal, opt-ins separados, revogação, exportação/exclusão de derivados e consentimento para IA. Corpus RAG dos livros não é autorizado por esta pesquisa. Avaliar direitos de edição/tradução e domínio territorial antes de incorporar conteúdo; referências no dossiê não significam patrocínio. Não enviar dados de saúde para publicidade nem registrar crença/religião inferida.

## 13. MVP e disposição final

**MVP recomendado para futuro piloto:** direção contextual experimental dentro do núcleo atual, Objetivo/intenção proposto e confirmado, uma experiência autoral opcional, um post-relato opcional e ação real sob controle. Sinais existentes bastam para funcionar; falta de sensor é normal, sem fallback escondido. IA explica/propõe com contexto real; regras de qualidade/segurança e cálculos ficam externos ao LLM. Falha da IA mantém registro salvo quando confirmado, exibe indisponibilidade e não simula orientação inteligente.

| Disposição | Inclui | Condição |
|---|---|---|
| Viável agora como base/recomendação | Reuso de contexto, persistência, origem e feedback; pesquisa crítica; orientação ancorada | Não declara novos recursos funcionando |
| Experimental | Quatro direções, estado-alvo autoral, reflexão/imaginação opcional, GS interno | Testar compreensão, utilidade, segurança e carga; sem fórmula espiritual |
| Dependente de validação | Câmera/PRV, baselines fisiológicos, benefícios, aprendizagem personalizada, importações comparáveis | Protocolo, precisão, consentimento e execução em hardware antes de liberar |
| Descartado do MVP | VSI, vinte scores, mapa Hawkins, RMSSD por bpm, RH incorporada, live biofeedback | Redundância, invalidade, direitos ou custo sem valor demonstrado |
| Descartado como claim | Hz espiritual, previsão/garantia causal, diagnóstico por sensor, culpa moral | Incompatível com evidência e contrato |

## 14. Aceite documental e próximo passo

Revisão de pesquisa, integração e meta-processo são independentes e ficam em [pareceres da tarefa](../../quality/state-intelligence-2026-10-02/ticket.md). Casos de mesa do [plano](../../plans/2026-10-02-state-intelligence.md) verificam consistência da especificação, não eficácia, UX com pessoas ou precisão fisiológica. A produção permanece intocada.

O plano técnico sequencia reconciliação de contratos, piloto sem sensor e gates de pesquisa; qualquer implementação ou divulgação futura exige nova tarefa com critérios próprios. Este dossiê autoriza clareza de decisão, não merge/deploy automático.
