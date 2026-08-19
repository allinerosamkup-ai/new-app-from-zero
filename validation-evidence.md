# Evidências de validação autenticada

## 18 de agosto de 2026 — candidata local, viewport móvel

A sessão autenticada da conta de demonstração foi aberta na candidata local em português. A Home exibiu o estado localizado **“Começando a calibrar”**, sem a mistura anterior de inglês.

Na tela de Padrões, a conta tinha apenas dois check-ins. Por isso, o Histórico de fases ainda não é renderizado: a tela apresenta corretamente o estado de evidência insuficiente, com a explicação de que a leitura começa a ser mais útil após três check-ins. A verificação específica do card Histórico de fases permanece pendente até existir base suficiente.

Na tela de Objetivos, o DOM confirmou o carregamento da jornada e da proposta vinculada, inclusive o resumo do foco **“Organizar fluxo financeiro pessoal”**. A captura visual inicial pode mostrar o estado transitório de carregamento; a leitura do DOM confirmou que o conteúdo completo foi renderizado após a estabilização.

## Correção estrutural pendente de validação integrada

Foi identificado que a API de produção ainda devolve ações legadas sem `doneWhen`, pois a candidata aponta para o backend já publicado. A base local corrigida agora rejeita ações sem verbo executável, objeto específico e critério de término, preserva registros antigos sem torná-los operacionais e usa recuperação estruturada para reconstituir passos válidos. A validação integrada dessa correção depende de uma candidata com o backend local corrigido ou da publicação autorizada; nenhum registro de demonstração foi apagado.

Após incluir a proteção defensiva no cliente, a mesma página de Objetivos foi reaberta com a resposta ainda anterior da API. Os quatro cartões deixaram de promover as ações antigas como **“O que cabe agora”**. Em vez disso, cada um informa, em linguagem clara, que os passos antigos não dizem como terminam e oferece **“Definir próxima ação”** ou **“Pedir opções à Airia”**. A tela confirmou visualmente `0 de 4 objetivos têm um próximo passo`; não há mais ação abstrata apresentada como passo atual.

O formulário **Definir próxima ação** foi aberto no primeiro cartão em viewport móvel. Ele apresenta, de forma legível, dois campos distintos: **“Verbo + objeto concreto”** e **“Pronto quando…”**. Foi preenchido sem envio o exemplo `Abrir o app do banco e anotar o saldo atual` com o critério `o saldo estiver anotado em uma nota`; o controle Salvar ação somente fica disponível quando ambos os dados existem. A submissão foi deliberadamente cancelada para não enviar uma escrita à API de produção anterior durante a validação local.

O formulário de Check-in autenticado foi aberto em viewport móvel. A interface solicita explicitamente uma emoção, humor, energia e um fator — ou a confirmação de que não foi possível identificá-lo — e oferece uma nota livre opcional. A validação visual confirmou que o botão **Registrar** informa quais respostas ainda faltam, em vez de assumir valores padrão.

No Check-in de demonstração, foi selecionada a emoção **Cansada** e o fator **Dormi pouco (<6h)**. Depois das duas escolhas, a interface reduziu corretamente a mensagem de pendência para apenas humor e energia, confirmando que as seleções são registradas como dados do fluxo.

O Check-in de demonstração foi registrado com humor **5/10**, energia **4/10** e uma nota explicitamente identificada como validação. Depois do processamento, a PWA levou corretamente ao resultado. A devolutiva usou linguagem simples — **“cansaço estável”** — declarou a base como **3 registros confirmados hoje** e não tratou a leitura como certeza clínica. A proposta exibida apresenta quatro controles claros: **Fazer agora**, **Trocar ação**, **Não para hoje** e **Corrigir a Airia**.

Após esse registro, Padrões passou a exibir `Humor 6,0`, `Energia 4,7` e `Check-ins 3` em viewport móvel. O Histórico de fases ainda não aparece: os três registros pertencem ao mesmo dia e não formam uma sequência temporal de fases. O estado não inventa histórico nem força o card com dados insuficientes; a inspeção específica de tipografia desse componente continua bloqueada até haver registros em dias distintos.

Foi confirmado no banco autorizado que a conta de demonstração já possui registros preservados em abril, além dos registros atuais. A próxima verificação será feita pelo intervalo **Semestre**, sem criar nem alterar dados adicionais. A recarga dessa rota exibiu o estado transitório de carregamento por mais tempo do que o habitual; a operação está sendo observada antes de qualquer nova tentativa.

O intervalo **Semestre** foi selecionado corretamente, mas o resumo visível permaneceu no modo **Agora**, com os indicadores do estado presente. A aba separada **Padrões** continua disponível e será aberta a seguir, pois é nela que a interface concentra a leitura histórica e o card de Histórico de fases.

Na aba Padrões, o intervalo Semestre revelou uma divergência: a interface anunciava uma janela de 180 dias, mas contabilizava apenas os registros vindos da consulta de 90 dias. A correção local passou a solicitar sob demanda até 180 dias quando o intervalo exige, e o endpoint agora aceita esse limite. A candidata continua ligada ao backend publicado anterior, portanto a confirmação visual integrada dessa alteração ficará bloqueada até haver uma candidata com ambos os lados atualizados.

Para validar Objetivos com um registro controlado, o formulário móvel foi aberto para o objetivo financeiro. A ação de demonstração preparada foi **“Abrir o app do banco e anotar o saldo atual”**, com o término **“o saldo estiver anotado em uma nota”**. Os dois campos estão visíveis no formulário e serão enviados como material de demonstração autorizado, preservado na conta.

A submissão pela candidata fechou o formulário, mas o cartão continuou sem um próximo passo visível. A barreira defensiva do cliente manteve o objetivo no estado seguro de revisão, o que indica que a API de produção anterior não devolveu o `doneWhen` necessário para tornar a ação operacional. A confirmação do payload armazenado será feita somente na tabela de Objetivos da conta de demonstração; nenhum material será removido.

A consulta controlada confirmou que a API anterior armazenou o título da ação manual, mas descartou o respectivo `doneWhen`. Por isso a interface corrigida a oculta como ação operacional: o dado permanece preservado para demonstração, mas não pode contaminar a leitura diária. Na versão local corrigida, a rota `POST /api/objectives/:id/actions` exige e persiste o critério; uma nova cobertura determinística confirmou `201` para a ação concreta e `422` para a ação abstrata. A suíte completa do backend terminou com **118 suítes aprovadas**.

Ao iniciar a validação do Diário, a rota autenticada apresentou o mesmo estado transitório de carregamento observado nas outras jornadas. Nenhuma entrada foi enviada enquanto esse estado não se estabiliza.

Com o Diário estabilizado, foi enviada a entrada explicitamente identificada como demonstração sobre organizar as contas da semana. A entrada contém uma ação e uma evidência concretas. A mensagem foi persistida na sessão e a Airia entrou no estado de processamento; a resposta ainda não estava disponível nesta observação.

A resposta do Diário foi persistida, usou linguagem direta e retomou corretamente o contexto financeiro sem sugerir Planner ou Hábitos. Contudo, embora tenha indicado uma ação específica (abrir o banco e olhar as três primeiras contas), ela não expôs um critério de término no formato visível exigido para sugestões de ação. A lacuna será verificada no contrato local antes de considerar este fluxo aprovado.

A investigação confirmou que o prompt compartilhado já descrevia o formato correto, mas o validador pós-geração ainda aceitava ação imperativa solta. O contrato local foi fortalecido: uma ação visível agora precisa aparecer como **“Próximo passo: <ação>. Pronto quando: <evidência observável>.”**; caso contrário, a resposta é reescrita uma única vez. A regressão da resposta observada foi adicionada ao teste do validador, a reescrita recebeu a mesma regra e a suíte completa do backend voltou a terminar com **118 suítes aprovadas**. A candidata ligada ao backend anterior não pode comprovar visualmente essa versão até que os dois lados estejam no mesmo ambiente.

Ao retomar a validação do Check-in, a rota autenticada também apresentou carregamento transitório; nenhuma nova submissão foi iniciada enquanto o formulário não se estabilizasse.

O formulário de Check-in estabilizou em viewport móvel. A demonstração selecionou manualmente a emoção **Cansada** e o fator **Estresse financeiro**; o próprio formulário atualizou a pendência para apenas humor e energia, confirmando a interação dos controles obrigatórios.

Com humor e energia selecionados pelos controles nativos, foi incluída uma nota marcada como demonstração e acionado **Registrar**. O botão entrou em estado de processamento; a submissão não foi repetida enquanto a resposta do fluxo não conclui.

Após reiniciar a candidata local, a rota de resultado confirmou que o Check-in foi persistido: o estado exibiu **cansaço estável**, três registros confirmados no dia e todos os controles da proposta ficaram disponíveis. A proposta ainda veio da API anterior (“Fazer fechamento de telas às 22h30”), sem critério de término visível. O comando **Trocar ação** foi acionado uma vez e a resposta permaneceu inalterada; a evidência não aprova essa integração antiga, mas confirma que o resultado e os controles renderizam no viewport móvel.

O botão central abriu a rota **Comando central** corretamente em viewport móvel e exibiu a proposta atual. Foi enviado o pedido “Quero fazer um check-in agora.”; a interface entrou no estado “Organizando seu pedido…”, sem encaminhar para Planner ou Hábitos. A resposta ainda não retornou nesta observação e o pedido não será reenviado.

A resposta do comando central foi concluída: reconheceu o pedido de Check-in, pediu apenas o humor atual e manteve a pessoa na superfície ativa, sem Planner ou Hábitos. Para validar a versão corrigida ponta a ponta, a PWA foi temporariamente apontada ao backend local atualizado. A autenticação Supabase funcionou, mas a execução foi bloqueada antes das rotas de produto porque o ambiente local não dispõe de uma `DATABASE_URL` PostgreSQL válida para o Prisma. Como as rotas dependem de banco transacional, essa candidata integrada não é apta para validação funcional até haver conexão de banco efêmera autorizada; nenhum dado foi criado nessa tentativa.

Após a correção do contrato do Diário, o backend também foi compilado com sucesso por `tsc`, além da suíte de 118 testes já aprovada.

Na PWA atual, a tipagem, os **61 arquivos de teste / 457 testes** e o build de produção foram concluídos com sucesso. O lint não encontrou erros, mas permanece bloqueado por **110 avisos legados** de `any` explícito sob a política atual de máximo zero avisos; eles não foram tratados como aprovação de lint nem foram suprimidos artificialmente.

Foram removidos usos de `any` nas jornadas ativas de estado compartilhado, Objetivos, Home e Padrões; cada grupo passou por tipagem e lint local sem avisos. A linha de base caiu de **110 para 80 avisos**, todos ainda concentrados em fontes auxiliares, Service Worker e superfícies desativadas. A tentativa de apagar fisicamente arquivos de Planner, Hábitos e Pomodoro mostrou que testes estruturais ainda os leem; os arquivos foram restaurados imediatamente, sem retorno dessas superfícies às rotas ativas. A tipagem e a suíte completa da PWA voltaram a concluir com **61 arquivos / 457 testes aprovados**.

A candidata foi restaurada contra a API de demonstração estável depois da tentativa integrada. O resultado do Check-in voltou a carregar com o mesmo estado, controles e proposta herdada; isso preserva a possibilidade de validar a interação, mas não substitui a validação de conteúdo da versão atualizada do backend.

No resultado estável do Check-in, **Não para hoje** foi acionado uma vez. O organizador diário deixou de oferecer um passo legado e passou a orientar “Definir próximo passo”, demonstrando que a recusa teve consequência na seleção diária. O card de proposta herdado, porém, continuou visível e sem critério de término; essa diferença permanece uma limitação conhecida da API anterior, não uma aprovação da versão corrigida.

O controle **Corrigir a Airia** abriu um campo contextual no próprio resultado do Check-in. Foi preenchido um feedback de demonstração sobre exigir ação concreta com critério de término e o envio foi acionado uma vez. A interface não confirmou persistência nem atualizou a proposta durante esta observação; essa limitação será mantida como evidência não aprovada da integração anterior.

## 19 de agosto de 2026 — consolidação técnica local

As superfícies físicas de **Planner**, **Hábitos** e **Pomodoro** foram removidas do diretório de rotas depois de confirmar que não possuem importações de produção. Os testes estruturais que ainda exigiam a presença do Planner foram atualizados para validar exclusivamente as três superfícies de voz ativas: Comando central, Check-in e Diário. As rotas antigas continuam redirecionando ao destino canônico e não geram chunks de produção.

O contrato compartilhado de reconhecimento de voz passou a tipar explicitamente eventos, construtores e referências de navegador nas três jornadas ativas. A abertura de sessão do Comando central, as opções de notificação e a hidratação de check-ins também foram tipadas sem suprimir regras de lint. Durante esse trabalho, foi corrigido um erro latente: a atualização de acompanhamento proativo agora envia um `FollowUpPending` completo ao estado compartilhado, em vez de passar uma função para um setter que só aceita valores.

As verificações locais concluíram com sucesso: **lint da PWA sem avisos**, `typecheck` limpo, **61 arquivos / 457 testes aprovados** e build de produção concluída, incluindo a geração do Service Worker. Os avisos anteriores foram eliminados sem comentários de supressão artificial.

## 19 de agosto de 2026 — candidata integrada com banco autorizado

Foi confirmada, no painel do projeto Supabase `mood-energy-mvp`, a redefinição autorizada da senha PostgreSQL. O endpoint direto `db.<projeto>.supabase.co:5432` não era alcançável pela rede local porque o projeto Free expõe essa rota por IPv6. A documentação oficial do Supabase determina o uso do **Shared Pooler em modo de sessão** para backend persistente em rede IPv4; o painel confirmou o host `aws-1-sa-east-1.pooler.supabase.com:5432` e o usuário `postgres.ksdvzqvwhrmvgozobjbt`. A candidata foi iniciada com essa conexão apenas em memória, sem escrever a senha no repositório ou em arquivos de ambiente. Fonte: https://supabase.com/docs/guides/database/connecting-to-postgres

O Diário recebeu entrada autenticada sobre contas e devolveu uma resposta contextual e concreta: **“Próximo passo: Abre o app do banco agora e anota as três contas que vencem primeiro. Pronto quando: as três estiverem na nota.”** A resposta foi exibida no chat e a proposta global antiga não reapareceu.

Foi corrigida a repetição deslocada da leitura global. A proposta **“Fazer fechamento de telas às 22h30”** era uma ação operacional vinculada a Objetivo e leitura diária, mas aparecia no Diário sem relação com a conversa sobre contas. O Diário agora mostra exclusivamente a conversa e eventuais planos explicitamente gerados nela. O resultado de Check-in recebeu uma regra de elegibilidade: uma proposta só é mostrada se estiver em estado proposto, vinculada a ação concreta de Objetivo, acompanhada de motivo de capacidade e sustentada por pelo menos dois dias observados com confiança mínima. Na candidata integrada, com três registros no dia, a proposta sem esse contexto permaneceu corretamente oculta.

Após essa correção, a PWA concluiu com **62 arquivos / 460 testes aprovados**, typecheck aprovado e lint sem avisos.

Na candidata integrada, a página de Objetivos também expunha a mesma proposta global antiga no topo, embora o cartão do objetivo financeiro já apresentasse outra ação concreta. O card redundante foi removido. Após a recarga, a única orientação operacional visível é **“Abrir o app do banco e anotar o saldo atual”**, com o critério **“o saldo estiver anotado em uma nota”**. O controle Editar abriu os dois campos preenchidos, confirmando que ambos os elementos do contrato persistiram no backend integrado.

O Comando central também mostrava a proposta global antiga e, além disso, bloqueava a execução de todo pedido enquanto uma proposta existisse. O card e esse bloqueio foram removidos; a leitura de segurança continua disponível. Em sessão autenticada, o pedido **“Quero fazer um check-in agora.”** entrou no estado de processamento e foi respondido com **“Como está seu humor agora, de 1 a 10 ou em uma palavra?”**, sem Planner, Hábitos ou referência à proposta global anterior.

Na repetição autenticada após a normalização do JSON estruturado e a separação do trabalho derivado de pós-persistência, uma nova solicitação de Check-in entrou em **“Organizing your request...”** e seguia sem resposta nos primeiros cinco segundos. A interação permaneceu em observação para medir a chegada do evento SSE final e confirmar que não reaparece o erro de JSON visível na interface.

Após aproximadamente 80 segundos, a primeira etapa não devolveu a pergunta de Check-in e a interface exibiu a falha genérica em inglês **“I ran into a problem completing that. Try asking again with a little more detail.”**. Esta tentativa não aprova o fluxo; o diagnóstico deve identificar o erro específico retornado pelo backend e restaurar uma mensagem localizada e recuperável antes de reenviar qualquer solicitação.

O backend registrou que o provedor devolveu uma escolha sem `message.content` (`Falha ao interpretar o comando da Airia`). A segunda tentativa reproduziu a mesma falha antes de a recuperação ser incluída. A implementação agora trata conteúdo vazio ou exceção do provedor como resposta segura e deixa a camada determinística de recuperação converter um pedido explícito de Check-in na pergunta necessária; a nova tentativa integrada será feita em seguida.

A nova tentativa integrada concluiu o primeiro turno: em vez de exibir a falha genérica, o Comando central perguntou **“Entendi sua energia. Como está seu humor agora, de 1 a 10 ou em uma palavra?”**. A pergunta foi localizada, permaneceu no Comando central e não criou nenhum item em Planner ou Hábitos. O segundo turno ainda precisa confirmar a persistência e a entrega do evento SSE final.

No segundo turno, a resposta curta **“5, cansada.”** recebeu evento SSE e permaneceu na mesma superfície, mas a Airia repetiu a pergunta sobre humor em vez de reconhecer `5` como a resposta solicitada. Não houve nova persistência; esta observação reprova a continuidade contextual e exige que a recuperação de Check-in leia a pergunta imediatamente anterior ao interpretar uma resposta numérica curta.

Após a correção de continuidade, o segundo turno reconheceu a resposta, montou o plano de **Check-in** com humor `5` e energia `3` e chegou ao cartão **“Review before applying”**. Porém, o próprio cartão exibiu o erro técnico **“Cannot read properties of undefined (reading '0')”** antes da aplicação. A resposta já não fica presa, mas esta nova falha visível precisa ser removida antes de considerar a jornada aprovada.

Depois de aplicar a leitura proporcional de fallback, a reaplicação do plano persistiu o Check-in e exibiu o recibo **“I saved how you are right now”**, com humor `5/10` e energia `3/10`. A falha técnica ainda apareceu porque era o erro armazenado da tentativa anterior; foi identificado que o Prisma ignora `undefined` em atualização de JSON, e a limpeza foi ajustada para usar seu sentinela explícito de nulo de banco. A validação final abaixo cria um novo plano para confirmar a ausência desse erro legado.

No novo primeiro turno, a Airia respondeu em português **“Como está seu humor agora, de 1 a 10 ou em uma palavra?”**, sem falha genérica, sem Planner ou Hábitos. O segundo turno será usado para verificar a aplicação e a ausência de erro técnico no cartão concluído.

No segundo turno final, **“5, cansada.”** foi interpretado usando a pergunta imediatamente anterior; o Check-in foi aplicado e exibiu **“CHECK-IN LOGGED”**, humor **5/10**, energia **3/10**, estado **“ritmo mais baixo”** e a devolutiva proporcional **“Hoje pede um ritmo menor. Vale proteger sua energia e escolher apenas o que realmente cabe.”**. O plano concluído de Check-in permaneceu visível sem o texto técnico antigo. A validação aprova o primeiro turno, a continuidade contextual, a persistência, a devolutiva de fallback e a limpeza do erro transitório nesta jornada do Comando central.

Após essas correções, a suíte completa do backend terminou com **118 suítes aprovadas** e a compilação TypeScript do backend foi concluída sem erros. Os avisos de cenários de fallback simulados nas suítes não representam falha de teste; os fluxos correspondentes seguiram a recuperação prevista.

O limite de saída foi centralizado por família de modelo: Claude e Gemini recebem `max_tokens`, enquanto GPT mantém `max_completion_tokens`. A mudança foi aplicada às chamadas estruturadas de produção e passou por nova compilação e por **118 suítes aprovadas**. Na candidata integrada já recarregada, um novo primeiro turno de Check-in concluiu em português com **“Como está seu humor agora, de 1 a 10 ou em uma palavra?”**, sem erro genérico.

Após o reinício manual da candidata PWA local para a validação de Objetivos, a rota `/goals` passou a renderizar apenas o rodapé, sem conteúdo autenticado. Esta é uma observação nova e não invalida a validação previamente aprovada do Comando central; a causa visual precisa ser diagnosticada antes de retomar as jornadas remanescentes.

A causa da tela vazia foi a ausência de configuração Supabase no processo PWA reiniciado; ela foi restabelecida somente em memória e a rota autenticada voltou a carregar. Em `/goals`, foi confirmada uma ação concreta existente: **“Abrir o app do banco e anotar o saldo atual”**, com término **“o saldo estiver anotado em uma nota”**, e controles de editar, adiar, retirar e concluir visíveis. A observação também revelou o marco técnico legado **“Caminho atual”** em uma interface inglesa; o rótulo foi localizado sem traduzir o conteúdo específico da pessoa. A suíte PWA posterior passou com **62 arquivos e 460 testes**.

Após o recarregamento, o cartão exibiu **“Now · Current step”** no lugar do marco técnico em português e o aviso transitório de nova tentativa não permaneceu visível. Os títulos, ações e propostas persistidos em português continuam identificados como conteúdo específico da conta de demonstração, não como cópia estática da interface.

Foi acionada a opção da Airia para um objetivo sem ação atual. Após o processamento, a tela exibiu uma mensagem localizada de que o objetivo está salvo e seria revisitado, sem erro técnico exposto; contudo, a ação concreta ainda não foi materializada. A validação de geração de microações permanece em aberto até identificar a causa no backend.

Uma nova tentativa foi feita após aplicar o orçamento de raciocínio estruturado exigido pelo Claude e aguardar 90 segundos. A tela retornou ao estado de revisão sem erro técnico, mas sem criar a microação concreta; portanto, essa configuração isolada não resolveu a geração integrada e a pendência permanece aberta.

Após alterar o gerador de caminhos para GPT de raciocínio, a solicitação de opções permaneceu em **“Thinking…”** por mais de 60 segundos, sem materializar ação nem retornar erro. A validação está bloqueada nesta etapa e requer inspeção da requisição do backend antes de uma nova tentativa.

Após reinício automático do backend com o limite de tempo aplicado, a candidata integrada concluiu a revisão do objetivo **“Consolidar rotina de execução sustentável”**. A página passou de **1 para 2 objetivos com próximo passo**, exibiu a ação concreta **“Open the banking app”** e o critério observável **“The banking app is visible on the device screen.”**. O caminho também apresentou uma segunda ação delimitada e um marco futuro. A validação confirma persistência e renderização de uma microação estruturada, sem erro técnico exposto.

Após essa correção, a compilação do backend foi concluída sem erros e a suíte completa voltou a terminar com **118 suítes aprovadas**. A cobertura específica também verifica que cada chamada estruturada da inteligência de Objetivos recebe o limite de tempo de 25 segundos.

Na sessão autenticada do Diário, foram preservadas as entradas de demonstração e uma resposta anterior da Airia já cumpre o contrato visível: **“Próximo passo: Abre o app do banco e anota as três contas que vencem primeiro. Pronto quando: as três estiverem na nota.”**. A sessão permanece aberta e pronta para uma nova entrada de validação.

Uma nova entrada de validação foi respondida sem falha ou carregamento indefinido. Como a própria pessoa já trouxe ação e critério de parada concretos, a Airia confirmou de modo breve que o movimento estava definido e que não era necessário ampliar o escopo. A próxima verificação é salvar a sessão e confirmar a persistência, sem apagar os materiais de demonstração.

A sessão foi encerrada e salva com êxito. O Diário exibiu um resumo da sessão preservando o contexto de cansaço e preocupação financeira e materializou o compromisso: **“Hoje: Abrir o app do banco e anotar as três contas que vencem primeiro, com o saldo atual, numa nota — parar quando as três estiverem registradas.”**. A validação confirma entrada, resposta, resumo e persistência sem remover os dados de demonstração.

O formulário autenticado de Check-in foi carregado sem erro, com seleção explícita de humor, energia, fatores e nota livre. A validação seguinte usará valores baixos de energia, cansaço e preocupação financeira para verificar a devolutiva proporcional, sem introduzir situação de crise.

Para a validação, foram selecionados humor **4/10**, energia **3/10**, as emoções **cansaço** e **estresse**, e os fatores **sono curto** e **estresse financeiro**. Os campos foram preenchidos explicitamente no formulário, sem inferência de valor não informado.

O Check-in foi enviado com a nota de validação, mas a interface permaneceu em **“Saving…”** por mais de 45 segundos, sem avançar para o resultado. A validação de devolutiva, proposta e controles está bloqueada até que a persistência seja diagnosticada no backend.

A rota de Check-in foi ajustada para devolver a persistência e a leitura principal sem aguardar a revisão derivada de caminhos de Objetivos, que continua em segundo plano. O backend compilou sem erros e a regressão completa posterior terminou com **118 suítes aprovadas**. A candidata integrada ainda precisa ser retestada com essa separação carregada.

Após o reinício automático, o Check-in autenticado voltou ao formulário limpo e interativo, sem manter a interface em “Saving…”. A tentativa anterior continua registrada como evidência; a nova tentativa será preenchida novamente para verificar a entrega do resultado com a rota corrigida.

No reteste, humor, energia, emoções, fatores e nota foram preenchidos novamente. A abertura acidental da seção opcional de detalhes não alterou seus valores; o formulário principal permaneceu pronto para envio.

O reteste concluiu com êxito: o Check-in foi persistido, a rota avançou ao resultado e exibiu uma leitura proporcional de **ritmo mais baixo**, com energia registrada em **3/10**, além de uma ação concreta dos Objetivos e seus quatro controles: fazer agora, trocar, não para hoje e corrigir a Airia. A observação visual também identificou rótulos estáticos mistos na localidade inglesa — por exemplo, **“ritmo mais baixo”**, **“Pronto quando”** e a frase de calibragem em português — que precisam ser localizados antes de encerrar a validação.

Após a primeira localização, os rótulos passaram a inglês, mas a razão de capacidade informou incorretamente que apoio, e não uma tarefa, era prioridade, apesar de a própria tela exibir uma ação curta contextual. Esse descompasso semântico precisa ser corrigido antes de aprovar a leitura final.

A apresentação corrigida foi confirmada na candidata: **“lower pace”**, **“Open the banking app. Done when: The banking app is visible on the device screen.”** e **“I kept today’s scope as small as possible: your energy is 3 out of 10.”**. A razão agora é coerente com a proposta de ação curta e não exibe cópia estática em português na localidade inglesa.

O controle **“Correct Airia”** abriu o campo localizado de correção e retornou ao resultado sem perder a decisão ao selecionar **“Back”**. O próximo passo é validar uma decisão persistida de não executar hoje, mantendo o registro como material de demonstração.

O controle **“Not for today”** foi acionado e, após a persistência, a proposta deixou de aparecer no resultado de Check-in. A tela manteve a leitura e as demais rotas disponíveis, confirmando que o feedback de rejeição não apaga o Check-in nem deixa a decisão ativa de forma indevida.

Em Objetivos, foram confirmadas duas metas com próximo passo. Uma delas contém a ação concreta **“Open the banking app”**, com critério observável, além de controles para concluir, editar, adiar e retirar. A validação seguirá nesses controles preservando as ações produzidas como material de demonstração.

O controle de edição abriu campos para ação e critério de término. O critério da ação de demonstração foi refinado de forma concreta para **“o saldo atual estiver anotado em uma nota”**; o vínculo com o objetivo e a ação original foram preservados antes do salvamento.

A edição foi salva com sucesso: a tela confirmou **“Action updated.”**, fechou o formulário e passou a exibir o novo critério de término. Isso confirma persistência e retorno ao estado de leitura sem perder a ação concreta.

O controle **“Leave for later”** foi acionado na mesma ação. O cartão deixou de contar a ação como passo atual, passou de `2` para `1` objetivo com próximo passo e exibiu **“You left this action for later. It remains available here when it makes sense.”** com a opção **“Resume this action”**. A decisão foi aplicada sem apagar a ação de demonstração.

O controle **“Resume this action”** foi acionado em seguida. A ação retornou como passo atual com seu critério de término intacto, o contador voltou a `2` objetivos com próximo passo e a confirmação **“The action is active again.”** foi exibida. O ciclo de adiar e retomar está persistindo corretamente.

No Comando central autenticado, a jornada anterior foi carregada e manteve seu histórico. O turno pendente de Check-in recebeu a resposta curta **“5, cansada.”** e o envio abriu o estado **“Organizing your request...”**. A requisição foi enviada uma única vez; a conclusão será observada antes de qualquer nova solicitação.

A resposta do Comando central foi concluída sem erro técnico: ele exibiu **“CHECK-IN LOGGED”**, humor `5/10`, energia `3/10`, estado **“ritmo mais baixo”** e a leitura proporcional **“Hoje pede um ritmo menor. Vale proteger sua energia e escolher apenas o que realmente cabe.”**. O plano concluído apresentou um único item de Check-in e permaneceu na superfície ativa, sem Planner ou Hábitos.

Foi identificada uma lacuna na jornada: o carregamento do Comando central era apenas passivo, sem forma de interromper a solicitação. A PWA e o backend receberam cancelamento cooperativo: a interface aborta a requisição e o backend deixa de persistir plano, resposta assistente ou aplicar operações se detectar a desconexão antes dessas etapas. As duas camadas passaram por typecheck e compilação sem erros. Na candidata autenticada, um pedido conversacional não operacional entrou em processamento e exibiu o novo controle **“Stop”**.

Na primeira tentativa do controle, a resposta de recuperação do provedor foi concluída antes que o clique de validação pudesse ser entregue. Não houve plano nem decisão aplicada; o teste de interrupção seguirá com um pedido de decomposição deliberadamente mais demorado, sem confirmar qualquer decisão.

Um pedido de criação de Objetivo que exige decomposição foi enviado apenas para a validação do cancelamento. Durante o estado **“Organizing your request...”**, o botão **“Stop”** permaneceu visível e acionável; a próxima interação interromperá o pedido antes da geração de plano.

Também nessa tentativa, o provedor devolveu sua recuperação antes do clique automatizado alcançar o controle, sem criar plano ou objetivo. Para isolar o comportamento do novo cancelamento da latência do provedor, a próxima verificação manterá apenas a requisição do navegador pendente de modo controlado; nenhuma chamada será enviada ao backend nessa simulação.

Na simulação controlada, a chamada do navegador foi mantida pendente e não alcançou o backend. A interface exibiu o estado de processamento e **“Stop”** de forma estável, pronta para validar que o cancelamento encerra a solicitação local e não materializa plano, ação ou resposta do servidor.

Ao selecionar **“Stop”**, o carregamento terminou imediatamente, o botão desapareceu e a Airia exibiu **“All right, I stopped before applying any decision.”**. Não surgiu cartão de plano, ação ou resposta do servidor; como a simulação não enviou a chamada ao backend, não houve efeito externo. A rede normal da candidata foi restaurada depois do teste.

O Check-in conversacional aprovado já apresenta um recibo de persistência no Comando central. Na Home autenticada, contudo, o resumo carregado exibiu apenas **“2 entries in 14 days”**, divergindo do número de registros mostrado anteriormente no resultado de Check-in. A discrepância de resumo será triada antes de considerar a consequência entre superfícies como plenamente aprovada.

A divergência da Home foi explicada pela implementação: o gráfico agrega registros por **dia**, mas a cópia chamava esse total de entradas. A cópia foi corrigida para informar dias com registro nos dois idiomas; a contagem de `2` dias não contradiz os vários Check-ins feitos no mesmo dia. A ação financeira de demonstração foi então concluída em Objetivos. Após a persistência, o cartão saiu da lista ativa, a tela passou de `2 de 4` para `1 de 3` objetivos com próximo passo e exibiu **“Achieved results · 1”**, preservando o resultado alcançado.

A confirmação nativa de retirada foi o motivo do primeiro tempo limite de interação; a operação não foi repetida até confirmar o estado. Com a confirmação explicitamente aceita na validação, a ação foi marcada como rejeitada e deixou de ser um passo operacional: a tela passou a `0 de 3 objetivos com próximo passo` e ofereceu somente o próximo marco sob demanda. O registro não foi apagado. A cópia desse estado ainda usa indevidamente “Você concluiu o que estava em foco”, embora a ação tenha sido retirada; isso será corrigido antes de aprovar o controle como concluído.

Após a correção, a rota de Objetivos passou a declarar corretamente **“You removed this action from the current path. It stays recorded, but does not count as completed.”**. A Home autenticada, após reinício da candidata com configuração efêmera, exibiu **“Your rhythm taking shape — 2 days with entries in the last 14 days”**, confirmando que o número representa dias distintos com registro. A suíte PWA final concluiu com **62 arquivos / 462 testes aprovados**, e typecheck, lint e build de produção passaram. A suíte final do backend também concluiu com **118 suítes aprovadas**; avisos de cenários de fallback nas saídas de teste não corresponderam a falhas.

No intervalo **Semestre**, Padrões carregou `92` Check-ins e renderizou o **Recent phase history** com cinco faixas temporais distintas, permitindo finalmente inspecionar sua tipografia e seu layout em viewport móvel. A composição está alinhada ao sistema do aplicativo. Contudo, a superfície em inglês ainda apresentou cópia estática em português, como **“Pronto quando”**, **“Escolhi…”** e **“1 dia nesta fase”**. Essa regressão deve ser corrigida antes de encerrar o inventário.

A correção de localização foi ampliada para toda a leitura estrutural de Padrões: proposta, motivo de capacidade, duração da fase, descrição, dica, duração estimada, previsão de energia e alertas. Um erro de ordem de inicialização identificado durante a verificação foi corrigido imediatamente. No novo teste autenticado em **Semestre**, a tela exibiu integralmente em inglês **“Done when”**, **“I kept today’s scope as small as possible…”**, **“1 day in this phase”**, descrição e dica da fase, **“~3 days”**, **“Moderate — sustainable pace”** e **“High volatility”**. O Histórico recente de fases permaneceu renderizado e legível em viewport móvel.

Na regressão final posterior a essa correção, a PWA concluiu com **62 arquivos / 462 testes aprovados**, typecheck limpo, lint sem avisos e build de produção aprovado. O build gerou o Service Worker com `57` itens no precache. A suíte final do backend, executada após a barreira de cancelamento do Comando central, terminou com **118 suítes aprovadas**.

## Publicação autorizada — 19 de agosto de 2026

Os commits `fdb8f02` (correções validadas), `c2612a8` (sincronização de conexão de banco) e `a998172` (sincronização de `DIRECT_URL` para migrações Prisma) foram enviados à branch `master` do repositório remoto. A primeira tentativa de publicação revelou a senha antiga na VPS; a segunda confirmou a sincronização, mas evidenciou que a migração usa `DIRECT_URL`. Após armazenar a conexão somente como segredo criptografado `DATABASE_URL` do GitHub Actions e sincronizar `DATABASE_URL` e `DIRECT_URL` para o ambiente remoto, a publicação `32215317640` foi concluída com sucesso.

Após o deploy, `https://airia.pro/`, `https://www.airia.pro/` e `https://airia.pro/api/health` responderam HTTP `200`. O arquivo público `release.json` confirmou a versão `a998172485da4f49ff5627395b641bd17c97a411`.
