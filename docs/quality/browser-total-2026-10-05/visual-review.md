# Avaliação visual independente — 2026-10-06

Papel: UX/UI independente, somente leitura do produto. Escopo: imagens capturadas pelo coordenador; não é aprovação funcional, de integração ou publicação. Constituição e governança local consultadas. Sem controle concorrente do navegador.

## Evidência e limites

| Evidência | Ambiente | Leitura |
|---|---|---|
| home-production-resumed.jpg | Produção anterior | Home longa, muitos cards e prioridades repetidas; não prova a correção atual |
| home-corrected-month-mobile.jpg | Local corrigido, dados sintéticos | Histórico mensal visível com um ponto; ponto único não deve virar curva inventada |
| home-corrected-mobile320.jpg | Local corrigido, viewport 320×844 | Rótulos da navegação colidem; navegação cobre conteúdo no scroll capturado |
| goals-modal-covered.jpg | Produção anterior | Navegação sobre os controles do modal; corrigir exige nova evidência do portal |
| checkin-en-mobile-dark.jpg | Produção anterior, inglês e tema escuro | Boa organização de emoções e escalas, mas último item da navegação está cortado |

Imagens longas foram reduzidas pelo visualizador. Não se declara razão de contraste WCAG, tamanho de fonte ou área de toque por aparência. Essas medidas exigem DOM e cores calculadas. A imagem de 320 pixels confirma colisão visual, independentemente dos tamanhos técnicos dos botões. Dados sintéticos e produção não são comparáveis para validar estado ou contadores. O denominador de nível ausente no fixture não é tratado como defeito de produção.

## Achados priorizados

**P1 — Navegação em 320 pixels não está resolvida.** Hoje/Metas e Padrões/Diário se encostam ou sobrepõem; o mascote central ocupa área demais para os quatro rótulos. No scroll mostrado, a barra encobre o CTA Criar objetivo. Recomenda-se limitar o centro a 64 pixels no breakpoint até 360 pixels, manter quatro alvos com largura medida de pelo menos 44 pixels, texto próprio centralizado e rótulos de 10–11 pixels sem sobreposição. Reservar espaço inferior na página não basta para impedir cobertura temporária de conteúdo durante scroll; validar que cada ação pode ser alcançada e acionada sem conflito. Reavaliar 320, 390 e desktop com hit-test.

**P2 — Gráfico presente, leitura ainda fraca.** Fundo, linhas, eixos, legenda e textos secundários são muito tênues. A única observação tem valor/data, mas o espaço grande do gráfico não oferece contexto legível proporcional. Recomenda-se fortalecer cores de texto e linhas, medir contraste dos labels e explicitar uma observação no período. Não conectar pontos inexistentes nem preencher valores. O objetivo é entender o registro, não preencher a área.

**P2 — Home exige rolagem excessiva para uma decisão diária.** O fixture mensal tem aproximadamente 2492 pixels de altura em 375 pixels de largura; a produção antiga, aproximadamente 3289. Mascote, calibração, presença, atalhos, incentivo de notificações, ritmo, saúde e resumo competem por atenção. Recomenda-se manter estado, próximo passo e Check-in como prioridade; tornar detalhes do ritmo e histórico secundários e reduzir avisos duplicados de registrar. Preservar acesso ao gráfico e ações quando detalhes estiverem recolhidos. Trata-se de recomendação de UX, não autorização para reconstruir a Home.

**P2 — Modal antigo falha visualmente no ponto decisivo.** A barra sobreposta impede ver os controles finais. O portal proposto é coerente, mas sua correção visual não pode ser aprovada usando a imagem anterior. Exigir screenshot e hit-test da versão corrigida, incluindo teclado e scroll.

**P3 — Peso do texto secundário.** Informações como última janela registrada, dias sem check-in e explicação de calibração são pequenas e claras demais. A leitura principal tem boa hierarquia, mas as explicações necessárias à honestidade do dado ficam difíceis. Aumentar legibilidade antes de adicionar conteúdo.

## Pontuação parcial

| Critério visual | Nota | Evidência |
|---|---:|---|
| Hierarquia e direção | 7.0 | Títulos claros, mas próximo passo compete com muitos blocos |
| Legibilidade e contraste aparente | 5.5 | Gráfico e textos secundários muito tênues; medição pendente |
| Responsividade e navegação | 5.0 | Colisão explícita em 320 pixels corrigidos |
| Gráfico e honestidade visual | 7.5 | Histórico acessível e ponto único legítimo, leitura contextual fraca |
| Consistência visual e carga cognitiva | 7.0 | Linguagem visual consistente, excesso de cards e repetição |
| Média visual | **6.4** | Média simples dos cinco critérios; não substitui rubrica global |

**Decisão: FAIL visual parcial, não aprovar como avaliação completa.** O mínimo de 8/10 não foi atingido e há falha de navegação. A organização do Check-in escuro e a manutenção de um ponto real em vez de curva fictícia são aspectos positivos verificáveis, porém não constituem os dois diferenciais extraordinários necessários à aprovação local. Funcionamento, persistência, IA, privacidade e manutenibilidade não recebem nota a partir de screenshots.

Próxima ação: corrigir colisão da navegação, medir contraste e apresentar captura do modal corrigido. Rever com o mesmo conjunto de larguras e registrar separadamente a evidência de produção após publicação.

## Reavaliação visual da fatia corrigida — 2026-10-06

Novas evidências locais: `home-visual-final320.jpg`, `home-visual-final390.jpg` e `goals-modal-corrected-mobile320.jpg`. Capturas renderizadas com o Tailwind do projeto carregado fielmente. A primeira avaliação de 320 pixels continha utilities ausentes no ambiente local: não é descrição da produção atual. O parecer inicial permanece como histórico da evidência examinada, sem promover essa montagem a defeito de produção.

**Escopo desta decisão: gráfico e navegação da Home em 320/390 pixels e apresentação do modal Objetivo com IA em 320 pixels.** Não é aprovação da Home inteira, cadastro, respostas de IA, persistência, produção ou integração global. A imagem do modal contém `Failed to fetch` no fundo do fixture; esse erro não prova falha da produção nem permite declarar criação persistida. O denominador do nível segue incompleto no fixture e não recebe reprovação de produto.

| Critério da fatia visual | Nota | Evidência atual |
|---|---:|---|
| Hierarquia da informação do gráfico | 8.0 | Período, valor, data e médias explícitas têm leitura sequencial |
| Legibilidade da informação essencial | 8.0 | Valor 5.0 e resumo Humor 5.0/10, Energia 6.0/10 legíveis; grid continua discreto |
| Navegação compacta | 8.0 | Quatro rótulos distintos em 320 e 390 pixels, sem colisão observada |
| Honestidade visual do registro | 8.5 | Um dia com registro e um ponto, sem curva inventada; médias da mesma janela explícitas |
| Modal e controles finais | 8.0 | Título, campo, data, Cancelar e Desdobrar inteiros, sem navegação sobre os controles |
| Média da fatia | **8.1** | Média simples, não pontuação ponderada global |

**Decisão: PASS visual da fatia delimitada, 8.1/10.** Nenhuma falha crítica visual observada nessas três imagens. Os dois diferenciais concretos são: (1) a leitura de um histórico mínimo permanece útil e honesta ao apresentar médias da janela sem fabricar continuidade; (2) navegação e modal passam a preservar controles identificáveis numa largura de 320 pixels, resolvendo a colisão e a cobertura observadas anteriormente. A avaliação não exige redesign para reconhecer esses ganhos. O hit-test do modal e o foco foram informados pelo coordenador; esta revisora não executou esses testes e não os usa como prova visual independente.

Pendências P3: a seta para avançar período fica numa segunda linha no cabeçalho do gráfico; agrupar melhor o cabeçalho reduziria espaço vertical. Linhas de grade continuam tênues, embora o resumo textual forneça a informação necessária. Medição WCAG permanece pendente; nenhum número de contraste é inferido. A barra fixa cobre temporariamente uma legenda ou CTA no scroll capturado: isso é aceitável somente se o scroll real permitir alcançar integralmente cada ação, prova que cabe à integração. A Home inteira ainda merece redução de carga e avisos repetidos, sem impedir a aprovação desta correção restrita.

Próxima ação: coordenador validar desktop, Home recolhida, alcance e acionamento dos CTAs no scroll, integrar evidência funcional e repetir a prova após publicação. Não transportar este PASS para cadastro ou conclusão global.
