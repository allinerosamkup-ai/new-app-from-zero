# Parecer independente de integração — AIRIA-SI-20261002

Data: 2026-10-02. Papel: integration_review. **PASS documental — 9,315/10.** Não aprova implementação, sensores, eficácia, publicação nem DONE; meta-verificador é gate seguinte.

## Contexto e evidência

Lidos: ticket, skill local, constituição, protocolo, rubrica, memória local relevante, README integral, plano integral, plataformas/privacidade integral e seções aplicáveis dos memos científico/interpretativo. Auditoria read-only independente: motor shared, contratos Check-in, contexto central, App.tsx/mobile Android/plugins, rotas Health Connect, consentimento/export/delete, Aura prompt e AiriaReading/schema. Achados e comunicação estão em integration-handoff.md. Nenhum arquivo do executor foi editado pelo verificador.

## Rubrica aplicada à natureza documental

| Dimensão | Peso | Nota | Evidência/limite |
|---|---:|---:|---|
| Fidelidade à intenção | 20% | 9,5 | 14 entregáveis mapeados; Planejador/Rotinas excluídos; investigação e plano, sem código/publicação |
| Funcionamento e dados | 20% | 9,3 | Fonte comum, ausência/proveniência/versões, pre/post imutável, erro/idempotência/readback; adequação de especificação, não runtime |
| UI/UX e acessibilidade | 20% | 9,0 | Uma proposta corrigível, secular default, nova/recorrente/baixa energia, estados e acessibilidade futura; sem estudo humano realizado |
| Segurança e privacidade | 15% | 9,5 | Risco antes de expansão, finalidades separadas, consent enum não herdado, revogação/lineage/export/purge; revisão jurídica/hardware futura |
| Qualidade de IA e conteúdo | 15% | 9,4 | IA interpreta sem alterar cálculo, contexto atual/âncora/veto, distinção científico/interpretativo, contraprovas e falha IA explícitas |
| Manutenibilidade | 10% | 9,2 | Reuso auditado com candidatos rejeitados, seis células e gates, compatibilidade e rollback definidos em nível de pesquisa |

Ponderada: 1,90 + 1,86 + 1,80 + 1,425 + 1,41 + 0,92 = **9,315/10**. 

## Achados, correções e reverificação

- **PASS:** README §1.3 não esconde divergência constituição/motor (composto versus humor EWMA, mixed e janelas registradas); reuso cego bloqueado até tarefa específica. Quatro direções não substituem oito fases.
- **PASS:** plataformas §5 confirma módulo Android rastreado e limita prova ao código; Health Connect sem HRV, ausência de sono virando 0/score5 e janela/overlap/origem são lacunas explícitas. RMSSD 3000/BPM rejeitado; nenhuma validação atual em aparelho alegada.
- **PASS após correção solicitada:** plano §2 explicita AiriaReading cache diário mutável com unicidade usuário/data, version de contrato e snapshots/revisões pre/post imutáveis. Teste futuro de rebuild/correção preserva histórico com invalidação, sem bloquear exclusão por privacidade. Evita perder baseline pre no mesmo readingId.
- **PASS após correção solicitada:** enum atual somente privacy_policy/terms_of_use está explicitado; ampliar contrato/UI/export/revogação conjuntamente, sem herdar aceite para saúde/crenças/pesquisa.
- **PASS:** conflito de copy prática/protocolo é documentado; adaptação futura localizada, sem mudar prompt nesta tarefa. RiskSafety não é anunciado como detector robusto de aceleração/grandiosidade.
- **PASS:** consumidores compartilham revisão; memória negativa e confirmação preservadas. Consentimento e sensores opcionais não enfraquecem ajuda secular. GS experimental usa mesma máscara/alvo/versão e ausente não zero.

## Casos de mesa e verificações

T01–T18 do plano foram confrontados com contratos e dossiê: nova/recorrente/baixa energia, dimensão ausente, sinal ruim, baseline imaturo/MAD=0, sensores/métricas discordantes, energia alta com pouco sono, neutro/piora, progresso contrário, citação/negação, revogação em job, falha IA/escrita/duplo clique/reload, HealthKit vazio, mudança de alvo e preferência secular. **PASS de coerência documental**, não execução no app. Um caso adicional de pre/post no mesmo dia foi exigido e incorporado na regra de imutabilidade.

`git diff --check` documental: PASS. Não rodados builds, testes runtime, browser ou coleta; seriam falsa prova de pesquisa nesta tarefa. Validação científica das métricas, UX com pessoas, sensores, exclusão efetiva e detector de segurança seguem gates futuros, não bloqueios ocultos da entrega documental.

## Diferenciais extraordinários sustentados

1. **Pesquisa que impede reuso perigoso:** separa constituição, implementação real e lacuna com três erros concretos (motor divergente, ausência de sono numérica, pseudo-HRV por bpm). Vai além de catálogo de ideias: transforma achados em gates de implementação e preserva produto existente.
2. **Integridade do antes/depois e contraprova:** revisão corrigiu referência a cache diário mutável; plano agora exige histórico imutável com invalidação e privacidade, e outcomes negativos/externos contrários não são apagados para salvar doutrina. Isso protege dados, interpretação e confiança da usuária com teste verificável.

Decisão: **PASS da integração documental, 9,315/10, sem falha crítica remanescente identificada.** Próxima ação: meta-verificador audita pareceres, fontes/links, diff, destino operacional e commit; somente ele registra meta-approve. Publicação não autorizada por este parecer.

