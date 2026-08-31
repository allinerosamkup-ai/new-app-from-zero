# Projeto de Governança Multiagente — Airia

**Versão:** proposta de arquitetura 1.0  
**Objetivo:** criar uma operação de agentes especializados que evolua cada página e cada capacidade da Airia com qualidade consistente, rastreabilidade, testes reais de jornada e coerência com o produto inteiro.  
**Natureza deste documento:** projeto normativo. Ele descreve **como o sistema ideal de agentes deve operar**; não declara que os papéis abaixo já existem, nem depende do estado atual de qualquer tela.

> **Regra-mãe:** cada mudança deve deixar a pessoa mais capaz de perceber seu estado, escolher o próximo passo e entender o motivo da proposta. Um agente pode otimizar sua página; somente o sistema pode aprovar uma mudança que afeta a jornada inteira.

## 1. Resultado esperado

O projeto cria uma organização com células especializadas. Cada página ativa recebe uma célula própria composta por: um agente de funcionalidade, um agente de UI/UX e um verificador independente. Um simulador humano percorre as jornadas entre páginas. Especialistas de prompts, banco, repositório, VPS, organização local e skills atendem o conjunto. Um coordenador geral arbitra prioridades, dependências, integrações e coerência de produto; um verificador global avalia o coordenador.

O objetivo não é ter muitos agentes mexendo simultaneamente no mesmo código. O objetivo é obter **propriedade clara, trabalho paralelo apenas quando seguro e uma única decisão integrada**. Cada entrega precisa ser funcional, visualmente compreensível, acessível, segura e coerente com a proposta da Airia.

| Camada | O que protege | Resultado que deve produzir |
|---|---|---|
| Célula de página | Qualidade local de uma superfície. | Uma página útil, clara, responsiva e integrada. |
| Especialistas de plataforma | Regras transversais que não pertencem a uma única página. | Prompts, dados, repositório, VPS e estrutura confiáveis. |
| Simulação humana | Experiência percebida, inclusive em estados de baixa energia ou confusão. | Evidência de que uma pessoa encontra o caminho e entende consequências. |
| Verificação independente | Qualidade mensurável, ausência de regressões e mérito percebido. | Parecer com nota, evidências, bloqueios e pontos fortes. |
| Coordenação geral | Coerência entre todas as entregas e com a visão do produto. | Uma versão única que funciona de ponta a ponta. |

## 2. Constituição de atuação

Todos os agentes trabalham sob uma constituição curta. Ela é carregada antes de qualquer proposta, planejamento, alteração ou revisão. Nenhum agente pode contrariá-la em nome de uma otimização local.

| Princípio | Regra operacional |
|---|---|
| Uma fonte de verdade | Estado, decisão e ação persistida devem ser produzidos uma vez e consumidos por todas as superfícies relevantes. |
| Menos carga, mais direção | O sistema reduz escolhas desnecessárias e oferece uma próxima ação proporcional; não cria uma nova lista para a pessoa gerenciar. |
| Ação concreta | Toda ação proposta exige verbo executável, objeto específico, vínculo de origem e critério de término. |
| Contexto antes de sugestão | Check-in, relato, objetivo, padrão ou pedido explícito devem sustentar a proposta; a IA não inventa trabalho para ocupar espaço. |
| Autonomia confirmável | A pessoa pode confirmar, editar, adiar, retirar, recusar ou corrigir uma proposta. Nenhuma decisão relevante é escondida. |
| Honestidade de evidência | Registro, hipótese, padrão e recomendação são apresentados como coisas diferentes. Dados insuficientes não viram certeza. |
| Saúde e segurança proporcionais | A Airia apoia, protege e encaminha quando necessário; não diagnostica, não prescreve e não dramatiza sem evidência. |
| Núcleo ativo | O produto opera Check-in, Home, Objetivos, Padrões, Diário, Airia central, Onboarding e Configurações. Recursos fora desse núcleo só entram por decisão explícita. |
| Privacidade por padrão | Dados pessoais e credenciais nunca entram em prompts, logs, snapshots, skills, commits ou relatórios. |
| Publicação controlada | Nenhum agente publica, altera banco remoto, muda segredo ou executa deploy de produção sem ticket de release aprovado e autorização humana. |

## 3. Topologia da organização

```text
                         Titular do produto
                                  │
                                  ▼
                    Coordenador Geral da Airia
                                  │
             ┌────────────────────┼────────────────────┐
             ▼                    ▼                    ▼
       Células de página    Especialistas          Integrador de versão
             │                    │                    │
             ▼                    ▼                    ▼
       Verificadores         Simulador humano      Verificador global
             └────────────────────┴────────────────────┘
                                  │
                                  ▼
                         Dossiê de evidências
                                  │
                                  ▼
                          Aprovação de release
```

O coordenador geral não reescreve o trabalho das células por preferência. Ele transforma objetivos de produto em contratos, resolve conflitos de escopo, bloqueia mudanças incoerentes e aceita a integração somente depois de evidências. O integrador de versão é um papel operacional separado: ele monta a versão aprovada em uma branch de integração, não inventa funcionalidade.

## 4. Células proprietárias de página

Cada página tem dois agentes de produção e um verificador independente. O agente de funcionalidade é dono do comportamento, dos contratos de dados, da acessibilidade de interação, das integrações e dos testes de sua superfície. O agente de UI/UX é dono da hierarquia visual, da linguagem, dos estados vazios, dos estados de carregamento, da responsividade, do uso com uma mão e da redução de carga cognitiva. O verificador não pode ser o autor de nenhuma alteração que avalia.

| Célula | Agente de funcionalidade | Agente próprio de UI/UX | Verificador independente | Pergunta de sucesso |
|---|---|---|---|---|
| **Onboarding / Pra começar** | Persiste contexto, objetivo inicial e conclusão; controla transições e retomada. | Mantém acolhimento, esforço baixo, uma decisão por vez e progresso compreensível. | Verifica ativação, persistência e passagem ao primeiro Check-in. | “A pessoa chega à primeira Home com algo útil já construído?” |
| **Check-in e resultado** | Registra sinais canônicos, trata campos opcionais, resultado, edição e segurança. | Diferencia humor e energia, reduz atrito e torna a devolução legível. | Verifica persistência, proporcionalidade e proposta com consequência. | “A pessoa consegue registrar o estado e entender o que muda agora?” |
| **Home / Hoje** | Orquestra dados do dia, CTA, foco, gráfico, proposta e continuidade. | Mantém a hierarquia Agora → Continuar → Entender, inclusive em primeiro acesso. | Verifica que Home nunca fica vazia e não esconde o caminho principal. | “Em poucos segundos fica claro o que fazer agora?” |
| **Objetivos** | Cria, atualiza, pausa, arquiva e organiza Resultado → Agora → Caminho. | Faz o caminho parecer vivo, não burocrático; reduz o próximo passo a algo possível. | Verifica vínculo semântico, critério de término e controles de autonomia. | “A ação atual é realmente executável para aquele objetivo?” |
| **Padrões** | Calcula fases, evidências, janelas, correlações, limites e visualizações. | Torna hipótese, evidência e incerteza distinguíveis sem excesso de gráficos. | Verifica que a tela não diagnostica nem afirma causalidade sem base. | “A pessoa aprende algo útil sem ser induzida a uma conclusão falsa?” |
| **Diário** | Mantém sessões, texto, voz, resumo, memória, proposta revisável e finalização. | Protege a sensação de escuta; separa relato, interpretação e ação opcional. | Verifica consentimento, persistência e ausência de tarefa automática a partir de desabafo. | “A pessoa sente que foi ouvida e controla o que vira ação?” |
| **Airia central** | Interpreta intenção, monta proposta, executa operações confirmadas e cancela com segurança. | Faz a conversa parecer direta, situada e não robótica; revela estados de processamento. | Verifica consequência real em módulos de destino e ausência de becos sem saída. | “A conversa produziu uma ajuda verificável, não só texto?” |
| **Configurações** | Controla perfil, idioma, notificações, tema, privacidade, dados, conta e integrações reais. | Agrupa opções por intenção e evita promessas de capacidades inativas. | Verifica controle, clareza, privacidade e reversibilidade. | “A pessoa consegue ajustar o que importa sem se perder?” |

### 4.1 Contrato de entrada e saída de uma célula

Toda célula recebe um brief de página com intenção, cenários, dados de entrada, decisões permitidas, dependências e critérios de aceite. Ela devolve uma entrega que contém código, testes, registro de UI/UX, impactos em outras telas, evidências e plano de reversão.

| Artefato | Produzido por | Obrigatório |
|---|---|---|
| **Especificação da página** | Coordenador + agentes da célula | Sim |
| **Mapa de estados e transições** | Agente de funcionalidade | Sim |
| **Especificação de UI/UX e acessibilidade** | Agente de UI/UX | Sim |
| **Testes unitários, de integração e de jornada** | Agente de funcionalidade + simulador | Sim |
| **Parecer local com nota** | Verificador da página | Sim |
| **Registro de riscos entre páginas** | Célula + coordenador | Sim |
| **Proposta de skill, se houver repetição** | Agente autor | Condicional |

## 5. Especialistas transversais

Os especialistas não substituem as células. Eles trabalham quando uma mudança envolve regras que se repetem em várias páginas ou que podem causar dano fora da superfície local. Cada especialista tem um verificador próprio.

| Especialista | Responsabilidade | Verificador próprio | Limite de autoridade |
|---|---|---|---|
| **Agente de Prompts e Contratos de IA** | Lê o prompt inteiro, redesenha contratos de saída, exemplos, schema, fallback e avaliação semântica. | Verificador de Prompts avalia coerência, segurança, localidade, vínculo de ação e resistência a saída inválida. | Não altera uma página sem o agente proprietário; não faz remendos isolados. |
| **Agente Supabase e Dados** | Modelagem, RLS, migrações, retenção, consultas, consistência, backup e acesso mínimo. | Verificador de Dados revisa migrações, políticas, reversão, privacidade e impacto de consulta. | Não executa DDL/DML destrutivo ou altera produção sem ticket e autorização. |
| **Agente GitHub e Integridade de Repositório** | Branches, commits atômicos, CI, dependências, revisão de diff e origem de versões. | Verificador de Repositório revisa escopo do commit, dependências, CI e documentação de versão. | Não publica branch principal sem evidência de aceite. |
| **Agente VPS e Release** | Workflow, SSH, ambiente, saúde, rollback, logs e verificação pós-deploy. | Verificador de Operações valida segredos, host, saúde, rollback e confirmação pública. | Não acessa/expõe segredos nem faz deploy sem autorização humana. |
| **Agente de Organização Local** | Estrutura de pastas, fronteiras de módulos, arquivos órfãos, nomes, documentação e artefatos. | Verificador de Estrutura avalia imports, build, histórico e ausência de perdas de arquivo. | Não move arquivos transversais sem mapa de importações e plano de reversão. |
| **Agente de Skills e Reuso** | Converte capacidades repetidas em skills pequenas, testáveis, versionadas e documentadas. | Verificador de Skills avalia utilidade, concisão, gatilho, exemplos, validação e riscos. | Não instala ou atualiza skill em produção automaticamente. |

## 6. Agente de simulação humana

O simulador humano é uma camada independente, obrigatória e global. Ele não procura apenas erro técnico; ele testa se a experiência faz sentido para uma pessoa real. Não aprova uma tela porque “o botão funciona” se a pessoa não percebe que ele existe, não entende sua consequência ou sente que a tarefa exige energia demais.

O simulador usa contas de teste declaradas, dados sintéticos e cenários determinísticos. Nunca usa credenciais de pessoas reais, registros privados ou dados de produção para aprender comportamento.

| Persona de simulação | Objetivo do teste | Perguntas que o agente precisa responder |
|---|---|---|
| **Pessoa nova** | Descobrir valor sem conhecer a IA ou a navegação. | “O que é isso?”, “o que faço agora?”, “o que acontece se eu tocar?” |
| **Pessoa com pouca energia** | Completar apenas o essencial sem precisar ler muito. | “O próximo passo está óbvio?”, “há um caminho curto?”, “o texto cobra mais do que ajuda?” |
| **Pessoa com pressa** | Registrar e sair sem perder continuidade. | “Consigo terminar em poucos toques?”, “o app guardou o que eu fiz?” |
| **Pessoa confusa ou ansiosa** | Entender estado, evidência e opção de correção. | “Isto é fato, hipótese ou sugestão?”, “como discordo?” |
| **Pessoa recorrente** | Retomar uma decisão anterior e perceber progresso. | “O app lembra o contexto correto?”, “algo reapareceu indevidamente?” |
| **Pessoa em estado sensível** | Receber linguagem proporcional, opção de apoio e ausência de diagnóstico. | “O produto acolhe sem prescrever, assustar ou abandonar?” |

O simulador produz três tipos de evidência: roteiro percorrido, pontos de fricção e nota de confiança percebida. Um problema de simulação humana pode bloquear uma entrega mesmo quando todos os testes técnicos passam.

## 7. O ciclo de trabalho

Cada mudança segue um ciclo fechado. O processo pode ter agentes em paralelo na fase de descoberta ou análise, mas só uma célula de integração produz a versão combinada.

```text
1. Pedido da titular
       ↓
2. Coordenador traduz em contrato de produto
       ↓
3. Célula da página e especialista transversal planejam
       ↓
4. Agente funcional + agente UI/UX trabalham em branch isolada
       ↓
5. Testes automatizados + simulador humano
       ↓
6. Verificador da página emite nota e evidência
       ↓
7. Coordenador avalia impacto no produto inteiro
       ↓
8. Integrador monta versão candidata
       ↓
9. Verificador global aprova ou devolve
       ↓
10. GitHub, release e VPS somente após autorização humana
```

### 7.1 O ticket de trabalho

Nenhum agente trabalha com um pedido vago. O coordenador cria um ticket com os campos abaixo. Esse ticket é a fonte de verdade da mudança e viaja com a branch, os testes e o release.

| Campo | Conteúdo obrigatório |
|---|---|
| **Intenção da pessoa** | O problema em linguagem humana, sem solução presumida. |
| **Resultado desejado** | O que deve passar a ser verdade após a mudança. |
| **Páginas e domínios afetados** | Donos da célula, especialistas e dependências. |
| **Não escopo** | O que não deve ser alterado. |
| **Dados e decisões** | Fontes canônicas, efeitos persistidos, reversão e segurança. |
| **Cenários humanos** | Pelo menos uma pessoa nova, uma recorrente e uma em baixa energia quando aplicável. |
| **Critérios de aceite** | Regras observáveis, testes e evidências esperadas. |
| **Risco de release** | Nenhum, baixo, médio ou alto; plano de rollback. |

## 8. O padrão de verificação: nota 8–10 e “impressionado”

Cada agente de produção precisa de um verificador independente. O verificador não deve dizer apenas “passou” ou “falhou”. Ele emite uma nota estruturada de 0 a 10, justificativa, evidências reproduzíveis, bloqueios e pontos que merecem ser preservados.

Aprovar não é só ausência de defeito. “Impressionado” significa que o verificador encontrou pelo menos dois aspectos concretos que tornam a entrega mais clara, mais segura, mais simples ou mais coerente do que a solução mínima esperada — sem esconder riscos ou flexibilizar critérios.

| Dimensão | Peso | Nota 8–10 exige |
|---|---|---|
| **Fidelidade à intenção** | 20% | Resolve a necessidade humana, não somente um sintoma técnico. |
| **Funcionamento e dados** | 20% | Estados, persistência, erros e efeitos entre telas são corretos. |
| **UI/UX e acessibilidade** | 20% | Hierarquia, toque, texto, contraste, estado vazio e mobilidade funcionam. |
| **Segurança e privacidade** | 15% | Não cria exposição de dados, ação irreversível escondida ou resposta de risco inadequada. |
| **Qualidade de IA e conteúdo** | 15% | Prompts e saídas são contextuais, concretos, localizados e explicáveis. |
| **Manutenibilidade** | 10% | Código, testes, contratos, nomes e skills deixam a próxima alteração mais segura. |

### 8.1 Regras de aprovação

Uma entrega só é aprovada quando todas as condições abaixo são verdadeiras:

- A nota ponderada é igual ou superior a 8,0/10.
- Nenhuma dimensão recebe nota menor que 7,0/10.
- Não há bloqueio crítico de segurança, dados, acessibilidade, coerência de produto ou regressão.
- Testes definidos no ticket passam; testes existentes continuam passando.
- O simulador humano conclui que os cenários aplicáveis são compreensíveis e realizáveis.
- O verificador registra, no mínimo, dois pontos positivos específicos que justificam a classificação “impressionado”.
- O coordenador geral confirma que a entrega não viola outra jornada ou o núcleo ativo.

Notas de 8 a 10 não autorizam complacência. Um verificador que não encontra risco, trade-off ou limite deve explicar por que a superfície foi suficientemente explorada. Se houver conflito, a decisão não é “quem tem mais agentes”; é “qual evidência protege melhor a pessoa e o contrato do produto”.

### 8.2 Tipos de verificação

| Verificação | Dono | Evidência mínima |
|---|---|---|
| **Contrato de dados e domínio** | Agente funcional + verificador | Teste de regra, persistência, casos nulos e falhas recuperáveis. |
| **UI/UX local** | Agente de UI/UX + verificador | Viewport móvel, desktop quando aplicável, contraste, foco e estados de carregamento/vazio/erro. |
| **Jornada humana** | Simulador humano | Roteiro, resultado esperado, fricção, ambiguidade e percepção da consequência. |
| **Regressão técnica** | Célula + integrador | Typecheck, lint, testes, build e rotas afetadas. |
| **Coerência transversal** | Coordenador + verificador global | Mapa de produtores/consumidores, idioma, segurança, navegação e efeitos em outras telas. |
| **Release** | GitHub/VPS + verificadores | Commit atômico, CI, saúde de deploy, versão e rollback. |

## 9. Processo de criação e evolução de skills

Uma habilidade não vira skill porque um agente teve uma boa ideia uma única vez. Ela vira skill quando há recorrência, benefício claro e modo de validação. A skill é um manual operacional para o próximo agente repetir um processo com qualidade; não é memória livre, nem lugar para segredos, opiniões soltas ou instruções contraditórias.

```text
Observar repetição
       ↓
Propor skill pequena
       ↓
Especificar gatilho, limite e exemplos
       ↓
Criar recursos reutilizáveis
       ↓
Testar em caso real e caso adverso
       ↓
Verificador de skills avalia
       ↓
Coordenador aprova e versiona
       ↓
Medir uso, corrigir ou descontinuar
```

### 9.1 Gatilho de uma nova skill

Uma proposta deve existir apenas quando pelo menos um dos critérios abaixo se confirma:

| Gatilho | Evidência necessária |
|---|---|
| **Repetição** | O mesmo procedimento apareceu em três tickets independentes. |
| **Risco** | A tarefa é frágil e uma sequência exata reduz erro significativo. |
| **Conhecimento específico** | Há contrato, schema, glossário, conjunto de testes ou detalhe de produto que não cabe na instrução geral. |
| **Ganho mensurável** | A skill reduz tempo, retrabalho, regressão ou variação de saída. |

### 9.2 Estrutura obrigatória de uma skill

Cada skill tem nome, gatilho claro, escopo, limites, processo, exemplos, artefatos e validação. Ela deve ser curta no núcleo e usar referências apenas quando necessárias. Deve declarar explicitamente quando não deve ser usada.

| Componente | Exigência |
|---|---|
| **Metadados** | Nome e descrição que indiquem o que faz e quando usar. |
| **Contrato** | Entrada esperada, saída, riscos, dados proibidos e condições de parada. |
| **Fluxo** | Passos na ordem certa, com liberdade compatível com a fragilidade da tarefa. |
| **Recursos** | Scripts determinísticos, templates e referências versionadas quando de fato reutilizáveis. |
| **Testes** | Pelo menos um caso representativo, um caso adverso e um critério de falha. |
| **Dono** | Agente ou célula responsável por revisar a relevância da skill. |
| **Versão e depreciação** | Histórico de mudança, critério de retirada e substituta quando aplicável. |

### 9.3 Freios contra autoexpansão descontrolada

Os agentes podem propor skills e preparar uma versão em branch isolada. Eles não podem instalar, substituir ou expandir instruções de produção por conta própria. Toda skill nova exige parecer do verificador de skills com nota mínima de 8/10, exemplos executáveis, teste de regressão e aprovação do coordenador. Skills que não são usadas, duplicam outra, aumentam contexto sem ganho ou causam erro são depreciadas.

Nenhuma skill pode conter chaves, senhas, dados pessoais, identificadores de pacientes, capturas privadas, instruções para ignorar segurança ou permissão implícita de deploy. O agente de skills deve sanitizar exemplos e usar fixtures sintéticas.

## 10. Governança de prompts

O agente de prompts é responsável por toda linguagem que produz decisão ou ação: Check-in, Diário, Objetivos, Padrões, Airia central e respostas de segurança. Ele trabalha a partir de contratos de entrada e saída, não de remendos locais.

| Etapa | Regra |
|---|---|
| **Leitura integral** | Antes de alterar, ler prompt, schemas, exemplos, chamadores, consumidores e testes associados. |
| **Redesenho** | Reescrever de forma coerente quando o contrato muda; não adicionar exceção que contradiga o resto. |
| **Ação concreta** | Requer verbo, objeto, contexto, vínculo de origem e “Pronto quando”. |
| **Localização** | Evitar texto fixo e exemplos que vazem idioma entre PT e EN. |
| **Segurança** | Separar apoio, atenção e crise; nunca diagnosticar ou inventar risco. |
| **Avaliação** | Rodar casos positivos, adversos, multilíngues e de dados insuficientes. |

O verificador de prompts precisa inspecionar a saída final em vez de confiar apenas no texto do prompt. Um prompt bonito que ainda gera uma ação sem sentido recebe reprovação.

## 11. Governança Supabase e dados

O agente de dados é dono do ciclo de dados, não apenas do banco. Antes de qualquer mudança, ele mapeia produtor, consumidor, RLS, retenção, migração, rollback, telemetria e impacto de custo/consulta. Toda alteração de schema é proposta como migração reversível quando possível, validada com fixtures e revista pelo verificador de dados.

| Tipo de mudança | Exigência mínima |
|---|---|
| **Nova coluna ou tabela** | Schema, RLS, índice quando necessário, migração, rollback e testes de acesso. |
| **Alteração de leitura** | Explicar janela, ordenação, paginação, estado vazio e efeito em gráficos/insights. |
| **Exclusão ou retenção** | Aprovação explícita, simulação, backup aplicável e confirmação pós-operação. |
| **Dados de teste** | Identificação clara, conta isolada e preservação/limpeza conforme decisão da titular. |
| **Chaves e conexões** | Somente canais de segredo; nunca arquivos, prompts, commits, logs ou skills. |

## 12. Governança GitHub, VPS e pastas locais

### 12.1 Repositório

O agente GitHub mantém uma branch ou worktree por ticket. O commit é atômico, tem mensagem orientada ao comportamento, contém somente arquivos necessários e referencia a evidência de verificação. O verificador de repositório compara diff, testa a base remota antes do push e impede que protótipos, credenciais ou trabalho de outro ticket entrem por acidente.

### 12.2 VPS e release

O agente VPS só trabalha a partir de uma release candidata. Ele confirma a versão, variáveis necessárias sem exibi-las, saúde do workflow, disponibilidade pós-deploy e rollback. Quando o deploy falha, ele diagnostica antes de repetir; não dispara tentativas indefinidas. Uma alteração de infraestrutura passa pelo mesmo padrão de nota, evidência e autorização humana.

### 12.3 Estrutura local

O agente de organização local protege legibilidade sem iniciar refatorações cosméticas. Ele mantém código por domínio, contratos perto de seus consumidores, testes próximos ao comportamento e documentação em locais previsíveis. Movimentos de arquivo exigem mapa de importações, build e rollback simples.

| Área | Convenção proposta |
|---|---|
| `apps/web/src/routes/` | Páginas e composição de rotas; não concentrar regra de domínio complexa. |
| `apps/web/src/features/<domínio>/` | Estado, regras, contratos, helpers e testes de um domínio. |
| `apps/web/src/components/` | Componentes transversais, acessíveis e sem lógica de negócio específica. |
| `apps/backend/src/services/` | Serviços de domínio e contratos de IA/dados. |
| `docs/product/` | Constituição, visão, especificações de página, decisões e dossiês. |
| `docs/quality/` | Rubricas, cenários humanos, evidências e pareceres. |
| `skills/` | Skills aprovadas, enxutas, versionadas e testadas; nunca segredos. |
| `agents/` | Registro de papéis, contratos de agente, rubricas e templates de ticket. |

## 13. Coordenador geral e verificador global

O coordenador geral é o dono do todo coerente, não o gerente de microtarefas. Ele recebe a intenção da titular, cria o contrato de produto, decide quais células e especialistas participam, resolve conflitos de escopo e transforma evidências locais em uma decisão integrada. Ele precisa analisar a jornada inteira: entrada, onboarding, Home, Check-in, Objetivos, Padrões, Diário, Airia, Configurações, dados, idioma, segurança, testes e release.

O coordenador também possui um verificador global independente. Esse verificador reavalia a mudança como produto completo e recebe a mesma regra de 8/10 com condição de “impressionado”. Ele pode vetar uma versão que tenha páginas locais excelentes, mas jornada quebrada entre elas.

| Pergunta do coordenador | Decisão esperada |
|---|---|
| **A mudança resolve o problema que a titular descreveu?** | Rejeitar solução que melhore uma métrica local, mas não a experiência humana. |
| **Qual é a fonte de verdade?** | Impedir novos estados paralelos, ações duplicadas ou interpretações divergentes. |
| **Que página passa a produzir ou consumir algo?** | Acionar células afetadas e incluir testes de integração. |
| **Qual é a pior consequência de falhar?** | Definir proteção, fallback, rollback e necessidade de aprovação. |
| **A experiência é proporcional?** | Bloquear excesso de textos, perguntas, alertas e tarefas para uma pessoa com pouca energia. |
| **A versão está pronta para produção?** | Exigir evidência de todas as células, simulador humano, verificadores e operação. |

## 14. Matriz de autoridade

| Decisão | Pode propor | Pode aprovar tecnicamente | Exige autorização da titular |
|---|---|---|---|
| **Ajuste local de UI/UX** | Agente UI/UX da página | Verificador da página + coordenador | Não, se não muda escopo, dados ou produção. |
| **Nova regra de produto** | Célula ou coordenador | Verificador global recomenda | Sim. |
| **Novo prompt ou contrato de IA** | Agente de prompts | Verificador de prompts + coordenador | Sim, quando muda comportamento percebido ou segurança. |
| **Migração de banco** | Agente Supabase | Verificador de dados + coordenador | Sim. |
| **Nova skill** | Qualquer agente | Verificador de skills + coordenador | Não para branch isolada; sim para adoção operacional ampla. |
| **Commit e push** | Agente GitHub | Verificador de repositório | Sim, salvo autorização de escopo previamente registrada. |
| **Deploy em produção** | Agente VPS | Verificador de operações + coordenador | Sempre sim. |
| **Rollback** | Agente VPS | Verificador de operações + coordenador | Sim, exceto proteção emergencial previamente autorizada. |

## 15. Artefatos obrigatórios

Cada ciclo deve deixar um rastro legível. Isso permite que a titular, um investidor ou um novo agente entendam o que mudou, por que mudou e como foi verificado.

| Artefato | Quem mantém | Atualização |
|---|---|---|
| **Constituição de produto** | Coordenador geral | Quando houver decisão de produto aprovada. |
| **Especificação por página** | Célula de página | A cada mudança de comportamento ou UI relevante. |
| **Registro de prompts e schemas** | Agente de prompts | A cada alteração de IA. |
| **Registro de dados e migrações** | Agente Supabase | A cada alteração de schema, RLS ou retenção. |
| **Catálogo de skills** | Agente de skills | A cada aprovação, revisão ou depreciação. |
| **Matriz de cenários humanos** | Simulador humano | A cada nova jornada ou estado de risco. |
| **Parecer de verificação** | Verificadores | Por ticket e por release. |
| **Manifesto de release** | Integrador / VPS | Para cada publicação. |

## 16. Plano de implantação da organização

Não é necessário ativar todos os papéis ao mesmo tempo. A implantação ideal ocorre por camadas e sempre mede se a governança está ajudando, em vez de criar burocracia.

| Etapa | Escopo | Saída de sucesso |
|---|---|---|
| **1. Fundação** | Constituição, ticket padrão, rubrica de 8/10, coordenador, verificador global e simulador humano. | Toda nova alteração tem intenção, não escopo, testes e parecer. |
| **2. Células prioritárias** | Onboarding, Home, Check-in/resultado e Objetivos com UI/UX próprio. | O primeiro ciclo e a ação concreta são confiáveis. |
| **3. Células de compreensão** | Padrões, Diário e Airia central. | Contexto, memória e proposta mantêm o mesmo sentido entre telas. |
| **4. Plataforma** | Prompts, Supabase, GitHub, VPS e organização local com verificadores. | Mudanças transversais têm dono, revisão e rollback. |
| **5. Skills governadas** | Catálogo, proposta, teste, revisão, adoção e depreciação. | Processos repetidos ficam melhores sem autoexpansão descontrolada. |
| **6. Operação contínua** | Release gates, painel de evidências e retrospectivas mensais. | A qualidade sobe de forma mensurável sem perder velocidade. |

## 17. Definição final de “pronto”

Uma funcionalidade só é considerada pronta quando é mais do que código entregue. Ela deve cumprir a intenção humana, passar o contrato de dados, ser compreensível em UI/UX, sobreviver ao simulador humano, receber nota mínima de 8/10 de cada verificador aplicável, ter ao menos dois aspectos identificados como superiores ao mínimo esperado e permanecer coerente na avaliação do coordenador geral.

O sistema multiagente ideal não substitui a titular. Ele transforma a visão dela em contratos claros, entrega evidências e impede que excelência local esconda uma jornada ruim. A decisão final de produto, dados sensíveis e publicação continua humana.
