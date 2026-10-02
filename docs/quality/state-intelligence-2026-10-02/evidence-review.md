# Parecer independente de evidência — AIRIA-SI-20261002

Verificador: evidence_verifier. Data: 2026-10-02. Escopo: pesquisa documental; não é validação científica de produto, sensor, UX ou intervenção clínica.

## Estado

**PASS documental de pesquisa — 9,28/10.** Síntese README, três memos e plano posterior final foram revisados. Não aprova sensor, intervenção clínica, comportamento runtime, merge ou deploy. DONE depende do meta-verificador.

## Conferência independente de fontes

| Afirmação | Verificação | Resultado |
|---|---|---|
| Plews: 29 saudáveis, repouso, 5 min, câmera PPG/Polar/ECG, RMSSD | [PubMed original](https://pubmed.ncbi.nlm.nih.gov/28290720/), Methods/Results | PASS: restrição ao protocolo e à métrica preservada |
| Chen: 60 adultos, smartphone recebe Polar H7 por Bluetooth | [JMIR final](https://mhealth.jmir.org/2020/7/e18761/), Recruitment/Experimental Procedure/HRV Recording, trechos indexados primários | PASS: não é câmera; HTML e PDF diretos apresentaram captcha no passe independente |
| SAM: 247 participantes sem treinamento norte-americanos | [ScienceDirect original](https://www.sciencedirect.com/science/article/pii/0005791694900639), resumo indexado | PASS para amostra e comparação, sem inferir licença ou desempenho pt-BR |
| PRV não equivale universalmente a HRV | [Schäfer/Vagedes original](https://pubmed.ncbi.nlm.nih.gov/22809539/) | PASS: extrapolação de repouso para qualquer câmera rejeitada |
| GEW comercial exige licença | [UNIGE](https://www.unige.ch/cisa/gew), Conditions and recommendations for use | PASS: pesquisa não comercial e aplicação comercial separadas |
| Hawkins: restrição de mapa e marca | [Veritas FAQ](https://veritaspub.com/faqs/), participação e study groups | PASS: relato de política do titular, sem declaração jurídica universal de validade |
| Hélio: informações canalizadas e restrição de associação | [Site oficial](https://www.heliocouto.com/), abertura e avisos | PASS: referência crítica documental; sem incorporar RH ou associação comercial |
| Neville: tese metafísica, sono/oração, alegações de doença | [Feeling Is the Secret](https://thenevillegoddard.com/works/feeling-is-the-secret/), introdução e capítulos | PASS: transcrição de terceiro identificada, sem herdar validade clínica ou licença |
| RMSSD em Health Connect | [Android oficial](https://developer.android.com/reference/android/health/connect/datatypes/HeartRateVariabilityRmssdRecord) | PASS: tipo documentado não comprova origem disponível nem integração no app |

Revisão por amostragem crítica, não revisão sistemática integral. Hélio Não Substitui abriu; Florence apresentou erro intermitente no localizador direto. Apple autorização retornou página dependente de JavaScript; texto de plataforma exige confirmação durante implementação. Esses limites de acesso não autorizam afirmar leitura integral independente dessas páginas. Fontes restantes foram avaliadas quanto à delimitação de inferências nos documentos; a revisão não reproduziu estudo algum.

## Achados

Nenhum achado crítico nos três documentos de pesquisa revisados. Não exigem números inventados de duração, baseline, SQI ou consentimento; bloqueiam instrumentalização clínica e espiritual indevida. Direitos não comprovados ficam pendentes, não são apresentados como licença ou proibição jurídica universal. Os quatro estados são orientação contextual autoral, não instrumento validado nem hierarquia.

O plano conserva consentimentos por finalidade, distinção RMSSD/SDNN/PRV, ausente diferente de zero, segurança acima de expansão e registro de piora/efeito nulo/evidência externa contrária. Os 14 componentes estão mapeados no README e as etapas A–F explicitamente futuras. Os 18 casos são especificação de mesa, nunca descritos como teste no app.

## Cálculos e casos de mesa

PASS: recomputação independente do exemplo GS resultou D=0,2915475947, GS pre=70,8452405 e GS post=92,9289322, coerentes com arredondamento 70,8/92,9. Fórmula é distância a um alvo confirmado, não probabilidade; missing não é zero, um par não produz GS, máscaras diferentes não são comparáveis e MAD=0 não recebe epsilon. RMSSD e SDNN conservam famílias/unidades distintas. As normalizações não são escalas espirituais validadas.

PASS: T04–T12, T14, T16–T18 preservam, respectivamente, ausência, qualidade ruim, baseline imaturo, conflito, aceleração/sono, neutralidade, piora, contraprovas, consentimento, negativa protegida de leitura e comparabilidade. Não há classificação de emoção por sensor, licença presumida nem tarefa no Planejador/Rotinas.

## Rubrica aplicada à entrega documental

| Dimensão | Nota | Evidência |
|---|---:|---|
| Fidelidade à intenção (20%) | 9,4 | 14 componentes, escopo documental explícito, núcleo ativo e exclusão Planejador/Rotinas |
| Funcionamento e dados (20%) | 9,1 | Proveniência, versões, máscara/lineage/recibos e cálculos demonstráveis; runtime conscientemente não atestado |
| UI/UX e acessibilidade (20%) | 9,2 | Uma direção corrigível, recusa livre, controle secular e critérios futuros de acessibilidade; sem alegação de estudo UX |
| Segurança e privacidade (15%) | 9,5 | Risco precede expansão, finalidade/consentimento/revogação e direitos em gates explícitos |
| Qualidade de IA e conteúdo (15%) | 9,2 | Fontes primárias, hipóteses separadas, falha de IA explícita e ausência de garantia externa |
| Manutenibilidade (10%) | 9,3 | Reuso com divergências abertas, plano faseado, condições de liberação e rollback |

Ponderada exata: **9,275/10**, apresentada como 9,28. Todas dimensões ≥7; zero bloqueio crítico identificado neste escopo. Testes do app/build são não aplicáveis à mudança documental; simulador executado é análise de consistência de casos sintéticos, sem observação de pessoas.

## Dois diferenciais que excedem o mínimo

1. **A pesquisa impede uma falsa validação concreta:** ciência §4 identifica Chen como Polar H7/Bluetooth em vez de câmera e separa versão final de preprint; README §1.3 ainda rejeita `3000/bpm` e explicita divergência motor/constituição. Isto evita reaproveitar um estudo ou implementação incompatível como prova de sensor.
2. **O desenho pode contrariar a própria hipótese:** README §§8–10 e plano T09–T12 obrigam resultados neutros, piora e progresso externo contrário, sem repetir até uma nota boa ou culpar fé. GS usa máscara/alvo versionados e indisponibilidade honesta, evitando evidência fabricada por seleção ou falsa comparação.

Qualidade do pedido: fonte/limite 9,3; direitos 9,3; honestidade científica 9,5; cálculo/confiança 9,1; segurança 9,5. Limitações remanescentes são explicitamente gates futuros: revisão sistemática, fac-símiles/licenças não obtidos, diretrizes 2026 integrais bloqueadas, validação psicométrica, coleta humana e hardware. Essas lacunas não são recursos aprovados.

Decisão: PASS para dossiê fundamentado e plano posterior, com encaminhamento à integração/meta. Não requer correção de conteúdo neste passe; implementação futura exige os gates descritos.
