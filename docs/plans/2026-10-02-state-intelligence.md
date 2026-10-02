# Plano posterior — Airia State Intelligence

Data: 2026-10-02 · Ticket de pesquisa AIRIA-SI-20261002 · Base `5dcf2ad`.
Este plano é parte da entrega documental; **não foi executado**. Fonte: [dossiê e decisões](../product/state-intelligence/README.md), [ciência](../product/state-intelligence/scientific-evidence.md), [autores](../product/state-intelligence/interpretive-frameworks.md) e [plataformas/privacidade](../product/state-intelligence/platforms-and-privacy.md). Não altera a constituição.

## 1. Sequência e gates

| Etapa/célula | Entrega implementável após nova tarefa | Gate para avançar |
|---|---|---|
| A — contratos e segurança | Reconciliar comportamento MoodCycleEngine/constituição e auditar limites de risco; decidir linguagem de copy | Decisão da titular para comportamento divergente; casos regressivos comuns; verificador independente |
| B — núcleo sem sensores | Leitura comum versionada, direção/limitação, alvo confirmado e experiência autoral opcional dentro do web atual | Proveniência/correção/consentimento e persistência real; risco prevalece em todas as superfícies |
| C — sessão e resultados | Episódio antes/depois, interromper, sem efeito/piora, resultado e vínculo com Ação | Reload/readback, idempotência, exclusão de derivados, ausência sem zeros, controles completos |
| D — piloto de valor | Comparação orientação atual versus quatro direções, com/sem linguagem espiritual voluntária | Protocolo congelado, ética aplicável, consentimento próprio, compreensão e utilidade sem dano; não apenas gosto |
| E — sensores isolados | Spike de PPG/protocolo e correção do Health Connect existente; HealthKit separado se justificado | Hardware e referência, limiares pré-registrados, precisão/cobertura/privacidade; não usar no consumidor antes do gate |
| F — personalização | Associações pessoais e escolha entre opções seguras a partir de episódios comparáveis | Precisão e validação temporal definidas antes do estudo, contraprovas e vetos respeitados |

Etapas A–C podem reutilizar código existente; nenhuma depende de smartwatch. D decide se os novos nomes/experiências acrescentam valor. E não é pré-requisito de B–D. F não pode ser vendido como evidência de que estado interno causa resultado externo.

Papéis por etapa: coordenador especifica critérios e registra pesquisa; executor entrega uma fatia comportamento→persistência→devolução; verificador e integração independentes emitem notas; meta-verificador audita evidências/commit/worktree e autoriza conclusão. Gate ≥8 é necessário, sem falha crítica e com diferenciais concretos, nunca promessa de nota.

## 2. Contratos e fluxo técnico propostos

### Fonte única e persistência

Evoluir o contrato de contexto/leituras existente; cálculos puros compartilhados, interpretação explicável do backend e consumidores da mesma revisão. Não construir cálculo de alinhamento diferente em Home, Aura e mobile. `MoodCycleEngine` continua fonte atual até reconciliação; quatro direções são orientação adicional experimental, nunca um remapeamento automático das fases.

Proveniência: manter campos existentes e adicionar envelope versionado de observação/derivação conforme dossiê §3. Referências incluem versão da fonte, horário observado, consentimento e algoritmo. Separar ausência, inválido, obsoleto, revogado e desconhecido. Registro do dado da pessoa deve sobreviver a falha de interpretação com indicação de análise indisponível; auditar erro de avaliação no fluxo atual antes de reutilizar.

Reusar `AiriaReading`, `AiriaDecision`, `Objective` e mecanismos de feedback/consentimento/export existentes quando o significado corresponder. Não esconder séries brutas ou consentimento novo em logs genéricos. Primeiro contrato especificará o uso dos campos JSON versionados versus necessidade de modelo próprio para episódios/observações; critérios: consultas por usuário/tempo, lineage, exclusão e concorrência. Nenhuma migração executada nem schema final anunciado nesta pesquisa.

Recomendação para episódio: entidade com ID estável, `userId`, Objetivo/intenção, referências às leituras pre/post, experiência/version, horário, estado (`proposed`, `started`, `completed`, `interrupted`), utilidade/efeito adverso/outcomes e consentimento. Proposta/aceite de Ação mantém contrato existente, com idempotência e readback; abrir ritual não cria Ação nem marca experiência concluída.

**Imutabilidade obrigatória:** `AiriaReading` tem unicidade por usuário/data e upsert intradia; seu `version` é versão do contrato, não uma revisão histórica imutável. Não guardar pre/post como duas referências ao mesmo `readingId` mutável. O episódio precisa conservar snapshots imutáveis dos valores, evidências, estado-alvo e versões nos instantes pre/post, ou referências a observações/revisões imutáveis em armazenamento próprio. O cache diário continua atualizável; reconstruí-lo após post não pode alterar o pre. Teste obrigatório: atualizar leitura diária, corrigir fonte e reconstruir contexto; snapshot anterior continua historicamente rastreável, marcado invalidado quando a fonte é corrigida, sem reescrita silenciosa. Exclusão por privacidade ainda remove os dados e seus derivados conforme finalidade.

### Interfaces públicas mínimas futuras

- Leitura: `readingId/revision`, referências de observações, direção opcional, confiança com razões, `riskSafety`, proposta e alvo/destino ativo. Campos novos opcionais/versionados para clientes anteriores. Valores inválidos ou vazios nunca recebem default de estado estável.
- Estado-alvo: vinculado ao Objetivo, descrição e dimensões opcionais; confirmação/correção gera versão. Tipo inferido continua inferido até aceite; alvo sem aceite não permite GS.
- Sessão: criar/confirmar/iniciar/interromper/encerrar e registrar post/outcome; autorização por usuário, chave de idempotência, versão esperada e retorno persistido. Endpoint/rotas exatos ficam no ticket de implementação, compatíveis com handlers atuais; não há API implantada neste trabalho.
- Consentimento/preferência: estilo prático default, espiritual leve opt-in, inferência de crenças e importação/enviar saúde à IA como finalidades separadas. Revogar corta jobs, reuso e reimportação; opção espiritual desligada mantém ajuda prática.
- Compatibilidade do consentimento: o enum/allowlist atual em `consent.service.ts` inclui somente `privacy_policy` e `terms_of_use`. Ampliar tipos, payloads, UI, exportação/revogação e validação conjuntamente; não tratar os dois aceites existentes como opt-in para saúde, crenças ou pesquisa.
- Erros: falha de IA não fabrica resposta, erro de escrita não fecha modal com sucesso, `source_revoked/source_changed` exige nova leitura, conflito de versão exige readback antes de retry. Usuária pode encerrar sem pontuação ou post.

Esses contratos são requisitos de interface, não schemas Zod prontos. O ticket posterior deve fixar payload, limites, migrações/RLS e rollback antes de código. Esta decisão é deliberada: não legitimar detalhe de banco sem validar finalidade/coleta do novo modelo.

### Fluxo integrado

Entrada autenticada → fonte persistida e válida → contexto atual e memória negativa → segurança → cálculo descritivo/limitação → proposta da IA com âncora → confirmação/correção/veto → recibo → leitura compartilhada/episódio → outcome → associação corrigível. Excluir/corrigir fonte invalida derivados e atualiza consumidores. `observedAt` é UTC com timezone/data local explícita; sync posterior não altera idade da observação.

No Health Connect, consertar primeiro missing/paginação/deduplicação/origem/janela e distinguir métricas disponíveis. Reusar bridge/nativo só depois de teste em aparelho; não chamar ausência de permissão parcial de sono zero. HealthKit mantém negativa de leitura indistinguível de ausência quando a API assim protege. Câmera é algoritmo/sensor local opcional, não fluxo web presumidamente universal.

## 3. Cenários de mesa da especificação

Dados abaixo são sintéticos; resultados esperados verificam coerência do documento, não foram executados no app nem estudados com pessoas.

| ID | Entrada/cenário | Resultado exigido e destino | Resultado da revisão documental |
|---|---|---|---|
| T01 | Nova, primeiro objetivo e humor/energia; sem baseline | Preservar ativação, relato útil e uma proposta ancorada; sem PR, GS ou promessa de maturidade | Especificado §§5, 6 e 11 |
| T02 | Recorrente com Ação já concluída/rejeitada | Não recriar; usar memória negativa e próximo passo pendente confirmado | Especificado §§1, 7 e 8 |
| T03 | Pouca energia, prefere não imaginar | Acolher/proteger ou menor começo útil; recusa livre, sem dívida | Especificado §§7 e 11 |
| T04 | Só um par estado-alvo; AR ausente | GS indisponível; EN não substitui AR; confiança por afirmação | Fórmula §4 exige dois pares |
| T05 | PPG saturado, relato recente tranquilo | Rejeitar componente sensor; manter relato; nenhuma PR inventada | Plataforma §4 e dossiê §5 |
| T06 | MAD=0, poucos dias ou troca de aparelho | Sem z-score/baseline maduro; segmento de origem novo | Fórmula §4 e plataforma §2 |
| T07 | SDNN relógio e RMSSD câmera discordam | Preservar modalidades/métricas/contextos; sem conversão ou voto majoritário | §§3–5 e plataformas |
| T08 | Energia 9, 3h sono, agitação e decisão de gastar | Não Expandir/“janela”; conter decisão irreversível e aplicar risco proporcional sem diagnóstico | §§7 e 12; detector atual é lacuna |
| T09 | Prática completa, post igual | Neutro, sem culpa ou medição repetida até subir | §§8 e 10 |
| T10 | Prática interrompida por ansiedade/piora | Parar, registrar adversidade, não repetir automaticamente; apoio conforme risco | §§7–9 |
| T11 | Melhora interna, objetivo não progride | Outcomes distintos, contraprova registrada; sem explicar por “falta de fé” | §§9–10 |
| T12 | Progresso externo depois de baixa prontidão | Registrar evidência e revisar associação; não apagar dado contrário | §10 |
| T13 | “Não acredito nessa crença, estava citando outra pessoa” | Corrigir inferência e invalidar derivados; não marcar mentira/resistência | §§2–3 e 6 |
| T14 | Revoga saúde/inferência Diário com job em execução | Parar finalidade e reuso; consentVersion/lineage/tombstone bloqueiam derivado/reimport | Plataforma §6 e contratos |
| T15 | Erro de IA ou escrita, retry, reload, duplo clique | Indisponibilidade explícita, dado confirmado preservado, sem duplicate/sucesso falso | Contratos acima; fluxo futuro |
| T16 | Dados do HealthKit vazios ou consentimento parcial | “Sem dados disponíveis”; não acusar recusa nem calcular ausência como zero | Plataforma §3 |
| T17 | Post com alvo/escala/dimensões diferentes | Não mostrar delta global comparável; versão/máscara registradas | Dossiê §4 |
| T18 | Sem consentimento espiritual/visualização difícil | Orientação prática equivalente sem nomes de autores/selo | §§7 e 11; autores §9 |

## 4. Verificação necessária na implementação futura

- **Cálculos:** propriedades para intervalos/missing/domínio/MAD=0/GS, mesma máscara, unidades e versionamento; golden cases de segurança com relato, negação, ironia, aceleração e preferência secular. IA não muda valor determinístico.
- **Integração e persistência:** contrato Zod, autorização cruzada, dedupe/idempotência, concorrência do Objetivo, erro da IA depois de salvar, reload/readback, revogação em job, export e exclusão efetiva de derivados/memória. Auditar remoção além de solicitação agendada.
- **Jornada real:** criar objetivo→Check-in→proposta→confirmar/corrigir/vetar→episódio→post neutro/piora→Ação→Insights; mesma fonte/versão nas superfícies, sem destinos desligados. Nova, recorrente e baixa energia obrigatórias.
- **UX/idioma:** pt-BR/en dinâmicos, teclado/foco/ARIA, contraste/texto longo/reduced-motion, 320×800, 390×844, 768×1024 e desktop; disponibilidade de estados e controles, sem loop de medir de novo.
- **Pesquisa:** comparação dos quatro nomes com orientação atual e scores; desfecho principal utilidade/compreensão e segurança, não crescimento de nota. Coleta humana/sensor exige plano próprio, aprovação ética quando aplicável e privacidade.
- **Hardware:** concordância/viés/repetibilidade e taxa de rejeição com referência, aparelhos e subgrupos. Selecionar tamanhos de amostra e tolerâncias antes de coleta com especialista, separados de treino. Não liberar HRV por uma correlação ou demonstração em um aparelho.

Nesta tarefa documental: revisão de fontes/contratos e casos de mesa, integridade dos links, diff somente docs e pareceres independentes. Builds/browser não provam pesquisa; não serão apresentados como validação de motor/sensor.

## 5. Rollout, monitoramento e destino

Implementação começa em branch proprietária após novo ticket. Flags novas desligadas por default; nenhum flag atual de Planejador/Rotinas será ligado. Migração aditiva/compatível se necessária, com readback e rollback; shadow pode usar somente dados e finalidades consentidas, sem ingestão silenciosa.

Piloto voluntário: definir antes do recrutamento protocolo, população, precisão/amostra, duração, retenção, desfecho primário e critérios de parada. Dano grave, reforço de grandiosidade, indução de culpa ou promessa causal são veto de lançamento, mesmo com médias positivas. Monitorar correção/rejeição, interrompidos, adversidade, ausência de post, falha de IA/coleta e sugestões sem âncora. Telemetria técnica agregada sem Diário/saúde/crenças em texto.

Só publicar depois de qualidade/evidência, CI e autorização humana explícita de merge/deploy, com SHA e healthchecks exigidos. Rollback desliga capacidade nova sem apagar registros da pessoa, corta jobs e mantém núcleo atual; versões antigas continuam legíveis. Se sensor falha, continuar com relato e limitação visível, sem converter isso em “IA/sensor funcionando”.

**Destino desta entrega:** branch documental local `codex/state-intelligence-dossier-2026-10-02`, commit revisado, estado HANDOFF para leitura e decisão futura; sem publicação. Não criar outra worktree para esta tarefa documental. Mudanças preexistentes ficam fora do commit. Não exige tarefa recorrente/agente permanente: este dossiê é one-off.
