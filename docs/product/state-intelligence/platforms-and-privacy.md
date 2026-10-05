# Plataformas, aquisição e privacidade — Airia State Intelligence

Consulta: 2026-10-02. Pesquisa de viabilidade; nenhum sensor foi executado ou validado nesta entrega. Decisões técnicas são recomendações futuras, não declaração de suporte no app publicado.

## 1. Decisão de plataforma

Começar a hipótese de produto no web existente, com sinais relatados e contexto, sem dependência de câmera ou relógio. Manter um experimento de câmera separado da entrega consumidor. Se passar por validação, a aquisição nativa pode alimentar o mesmo backend; não reconstruir a experiência em outro app.

| Opção | Capacidade documentada | Limite relevante | Decisão |
|---|---|---|---|
| Web/PWA, câmera de contato | Captura e constraints/capabilities de câmera; Image Capture descreve `torch` | API/documentação não prova suporte uniforme nem precisão temporal; câmera+flash simultâneos exigem teste por dispositivo/browser | Experimental, não obrigatório no MVP |
| Shell React Native existente | Ponte WebView, autenticação e chamada de sync presentes no código | Chamada de módulo não prova binário disponível; Expo 51/RN 0.74 no manifest exige auditoria de compatibilidade, sem atualização automática | Reutilizar shell se aquisição nativa for justificada |
| Health Connect | Dados autorizados em Android; HRV RMSSD tem tipo próprio | API não fabrica dados; origem pode não fornecer HRV, e autorização parcial/histórico limitado alteram cobertura | Fase posterior, somente leitura |
| HealthKit | Tipo de HRV SDNN e autorização granular | API nativa; leitura vazia não permite distinguir ausência de negativa de autorização | Fase posterior, somente leitura |
| Wear OS Health Services | Clientes de medição, exercício e monitoramento passivo | Consultar capacidades por dispositivo; FC não implica acesso a intervalos batimento a batimento | Biofeedback futuro, sem promessa de HRV ao vivo |

Fontes: [P1](#p1), [P2](#p2), [P3](#p3), [P4](#p4), [P5](#p5), [P6](#p6), [P7](#p7). A escolha web é decisão de custo/risco da Airia, não resultado clínico.

## 2. Matriz de dados disponíveis nas plataformas

| Dado | Health Connect | HealthKit | Tratamento proposto |
|---|---|---|---|
| Frequência cardíaca | Registros disponibilizados por origens autorizadas | Amostras quando disponíveis | bpm; preservar momento, origem e contexto, não substituir por média diária em leitura atual |
| Variabilidade | `HeartRateVariabilityRmssdRecord` [P4] | `heartRateVariabilitySDNN` [P5] | ms e família da métrica separados; sem conversão RMSSD↔SDNN |
| Sono/atividade | Leitura por tipos autorizados [P3] | Leitura por tipos autorizados [P6] | Contexto temporal, não medida de crença ou prontidão espiritual |
| Respiração/temperatura/EDA | Verificar suporte do tipo, sistema e origem antes de prometer | Verificar suporte do tipo, sistema e origem antes de prometer | Não obrigatórios; não assumir equivalência entre temperatura corporal e cutânea |
| PRV de câmera | Não confundir com dado importado de wearable | Não gravar como HRV clínica | Sinal óptico de pulso com algoritmo, duração e qualidade próprios |

Não há especificação de cadência comum para todas as fontes. A Airia deve armazenar `observedAt/startAt/endAt` além de `ingestedAt`; `syncedAt` não torna uma amostra antiga atual. Baseline segmentado por pessoa, métrica, dispositivo/origem, algoritmo, duração e contexto de coleta. Mudança de dispositivo abre segmento novo, sem migração automática do baseline.

## 3. Permissões e estados negativos

Health Connect: conferir disponibilidade em runtime. A documentação consultada exige Android 9+ com serviços Google Play; Android 14+ incorpora o serviço e versões anteriores usam app separado. Perfis de trabalho têm limitação declarada [P2]. Pedir apenas tipos usados; manter funcionamento quando houver permissão parcial. Acesso histórico e em background têm permissões/capacidades próprias; não solicitar no MVP [P3].

HealthKit: conferir disponibilidade, capability e mensagem de finalidade antes da solicitação. `authorizationStatus` trata escrita, não revela negativa de leitura. Consulta vazia deve aparecer como “Não há dados disponíveis para esta leitura”, não “Você negou acesso” [P6]. Não pedir escrita no experimento inicial. Uma autorização de sistema não substitui autorização para enviar dados ao backend/IA.

Wear OS: `MeasureClient`, `ExerciseClient` e `PassiveMonitoringClient` atendem usos distintos; a lista de capacidades do relógio é gate. Não estimar intervalos RR a partir de FC média ou de uma série de bpm arredondados [P7].

## 4. Protocolo de experimento de câmera

Não instalar SDK nem construir sensor neste trabalho. Antes de uma célula de implementação:

1. Validar segurança física e protocolo com especialista; câmera traseira, repouso, posição/pressão consistente, duração e período de estabilização definidos no estudo, não pela conveniência do timer.
2. Registrar modelo, SO/browser, câmera, resolução, exposição, timestamps reais dos frames, quedas/jitter de frames e disponibilidade efetiva de iluminação. Ausência de `torch` é dispositivo não suportado para aquele protocolo, não autorização para leitura simulada.
3. Processar frames localmente; converter região de interesse em série óptica e detectar pulsos somente no segmento válido. Guardar intervalos e metadados mínimos apenas com consentimento separado; não enviar vídeo à IA.
4. Qualidade deve incluir saturação, amplitude/perfusão, contato, periodicidade, movimento, cobertura e proporção de intervalos corrigidos. Não inventar corte universal de qualidade; estimar e congelar limiares em conjunto de desenvolvimento separado da validação.
5. Medir concordância contra ECG para intervalos/PRV e contra referência adequada para FC, com análise de viés e limites de concordância. Correlação alta sozinha não libera. Ver [pesquisa científica](scientific-evidence.md).
6. Cobrir aparelhos, diferenças de perfusão/pele, repouso e artefatos; separar falha de coleta de erro entre leituras aceitas. Publicar taxa de rejeição e incerteza por subgrupo/dispositivo, não só acertos.
7. Interromper câmera/flash ao cancelar, mudar de página, perder foco ou relatar desconforto/calor. Limite máximo de iluminação é requisito do experimento a definir antes da coleta física, nunca liberar coleta sem ele.
8. Não detectar arritmia, diagnosticar, prescrever respiração nem atribuir emoção específica ao pulso. Sinal irregular/ruim interrompe cálculo; mensagem técnica proporcional sem diagnóstico.

Os candidatos iniciais são APIs nativas da plataforma e processamento local isolado. Não foi selecionada biblioteca de PPG: nenhuma dependência instalada inspecionada nesta tarefa entrega algoritmo validado para esse protocolo. Escolha externa exige manutenção, licença comercial, privacidade, compatibilidade e validação próprias. Uma biblioteca de câmera não é uma biblioteca clínica.

## 5. Código existente: verdade verificada e lacunas

Referência base `5dcf2ad`, leitura estática em 2026-10-02, sem prova de funcionamento em aparelho.

- `apps/mobile/App.tsx` define shell WebView, autenticação, `HealthSnapshot` e chamada a `NativeModules.AiriaHealthConnectModule`, depois POST autenticado ao backend. Isto confirma contrato/call site, não prova binário publicado ou funcionamento em aparelho.
- `apps/web/src/utils/native-shell.ts` envia `health.connectSync`, correlaciona `requestId` e tem timeout de 45 s. Ausência de ponte devolve indisponibilidade explícita.
- `apps/backend/src/index.ts` contém GET `/api/health-connect/latest` e POST `/api/health-connect/sync`: snapshot Zod de sono, passos, FC média e exercício; persiste `health_connect.synced` em EventLog.
- `apps/backend/src/services/context-grounding.service.ts` lê e normaliza esse snapshot; `GroundedHealthSignals` não contém HRV/PRV, duração de medida, SQI, baseline por sensor ou proveniência completa.
- `apps/mobile/android/app/src/main/java/pro/airia/app/health/AiriaHealthConnectModule.kt` e Package estão rastreados, com registro em MainApplication: há implementação nativa Android. Ela lê sono/passos/FC/exercício, sem HRV. Coleta entre ontem à meia-noite e agora; soma sem deduplicação/origem explícita e usa `sleepMinutes=0`, `sleepScore=5` se não há sessões. Ausência vira um valor aparentemente observado: bloquear uso cego no State Engine até corrigir null/cobertura/janela/overlap.
- Permissões efetivas, coleta em aparelho, regeneração de código por prebuild, HRV, HealthKit, privacidade desse transporte e limpeza dos dados precisam de auditoria adicional. Existência de módulo/API não basta para declarar integração atual concluída.
- A tela histórica `apps/mobile/src/presentation/screens/HrvTestScreen.tsx` possui aproximação a partir de bpm (`3000 / bpm`): rejeitada como fonte de HRV/PRV. Ela não valida câmera nem substitui intervalos; o entrypoint atual é o shell WebView.

A memória antiga que chama mobile de “pausado” não descreve sozinha o estado do código: há shell implementado. Não foi atestado release Android/iOS funcional. Ver divergências no [dossiê](README.md).

## 6. Privacidade e governança de dados

Saúde e convicção religiosa são categorias sensíveis no art. 5º II da LGPD. A finalidade opt-in do recurso precisa de base legal documentada; para este desenho, recomendar consentimento específico e destacado, com revisão jurídica antes de coleta real. Direitos e exceções de retenção precisam ser implementados, não prometidos. O dossiê não é certificação de conformidade [P8, P9].

| Finalidade | Default proposto | Controle e consequência |
|---|---|---|
| Leitura prática usando registros do app | Escopo atual permanece; nova finalidade revisada antes de ampliar | Mostrar fontes e permitir corrigir a leitura |
| Linguagem espiritual | Desligada até escolha explícita | Alterar estilo não muda dado nem cálculo; sem perfil religioso inferido |
| Inferência de crenças a partir de Diário | Desligada | Consentimento separado; exemplos contextuais minimizados, corrigíveis e excluíveis |
| Sensor/health import | Desligado; apenas tipos necessários | Revogação corta ingestão e uso futuro imediatamente |
| Envio de dados de saúde a provedor IA | Desligado | Opt-in e contrato/provedor/região/finalidade claros; preferir contexto mínimo derivado |
| Aprendizagem pessoal | Apenas finalidade consentida, por pessoa | Não treinar modelo entre pessoas por default |
| Pesquisa com participantes | Fora desta entrega | Protocolo, aprovação ética quando aplicável, riscos/retirada e consentimento de pesquisa próprios |

Revogação de permissão no SO não apaga cópias já importadas. A UI deverá separar desconectar, parar análise e excluir dados. Excluir/corrigir uma fonte invalida snapshots, padrões, embeddings, scores e propostas que dependam dela; trabalhos pendentes e reimportação devem respeitar tombstone/versão de consentimento. Não usar esses dados em publicidade ou analytics comportamentais; políticas Apple têm restrições expressas de uso de saúde [P10].

Retenção proposta: nenhum vídeo PPG persistido; buffer em memória encerrado no fim/cancelamento. Intervalos brutos ficam locais efêmeros por default; eventual armazenamento de pesquisa exige prazo numérico pré-registrado, separado e consentido. Derivações persistentes seguem o ciclo de vida da fonte e da finalidade autorizada; prazo máximo, backups e exclusões legais serão aprovados na revisão de privacidade antes de implementação, não escondidos num default eterno.

Código de consentimento, exportação e exclusão já existe, mas não certifica cobertura do novo motor. Exportação inclui EventLog; o serviço de exclusão registra solicitação/estado e agenda. A célula futura precisa demonstrar execução da exclusão, cobertura de derivados/backups e isolamento por `userId`. Nunca declarar “apagado” porque apenas agendou.

Proposta de segurança: processamento local de sinal, transporte autenticado, criptografia em trânsito/repouso conforme infraestrutura auditada, least privilege/RLS, logs sem texto/saúde, exportação com proveniência/versões, revisão de operadores e transferências internacionais. Auditoria e teste de revogação são gates; sem coleta de registros privados nesta pesquisa.

## 7. Fontes oficiais consultadas

### P1
[W3C — MediaStream Image Capture](https://www.w3.org/TR/image-capture/), §§3 e 9, Working Draft de 23/04/2025. Fonte de API/constraints, não certificação de compatibilidade ou precisão biométrica.

### P2
[Android — Health Connect availability](https://developer.android.com/health-and-fitness/health-connect/availability). Fonte de disponibilidade e limitações do sistema.

### P3
[Android — Read raw data](https://developer.android.com/health-and-fitness/health-connect/read-data). Fonte de leitura, histórico, permissões e background. Confirmar disponibilidade das features no aparelho.

### P4
[Android — HeartRateVariabilityRmssdRecord](https://developer.android.com/reference/android/health/connect/datatypes/HeartRateVariabilityRmssdRecord). Fonte do tipo RMSSD; conferir versão framework/SDK no projeto nativo selecionado.

### P5
[Apple — heartRateVariabilitySDNN](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/heartratevariabilitysdnn). A página consultada fornece o identificador; validar unidade e metadados na integração, sem inferir duração comum a todos os dispositivos.

### P6
[Apple — Authorizing access](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data) e [HKAuthorizationStatus](https://developer.apple.com/documentation/healthkit/hkauthorizationstatus). Regras de autorização e proteção da negativa de leitura.

### P7
[Android — Health Services](https://developer.android.com/health-and-fitness/health-services) e [compatibility](https://developer.android.com/health-and-fitness/health-services/compatibility). Clientes e capacidades; não garantia de RR/PRV disponível.

### P8
[LGPD — texto compilado](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm), arts. 5º, 6º, 11, 18 e 46. Fonte normativa; esta leitura é delimitação de requisitos, não parecer jurídico.

### P9
[ANPD — perguntas frequentes](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes). Categorias sensíveis e direitos do titular.

### P10
[Apple — App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), §§5.1.2 e 5.1.3. Limites de publicidade, dados falsos e pesquisa com participantes. Revisar versão novamente antes de submissão; nenhum estudo humano foi feito aqui.
