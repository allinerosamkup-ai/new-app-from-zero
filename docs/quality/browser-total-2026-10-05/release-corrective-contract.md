# Contrato operacional — release corretiva Airia PR22

Data: 2026-10-07. Meta independente: release_meta_final. Este contrato delimita a publicação corretiva autorizada pela titular ("ATUALIZAR VPS CASO ESTEJA TUDO CERTO"). Não substitui nem encerra AIRIA-BROWSER-TOTAL-20261005. O contrato JSON desse pedido permanece ativo; cadastro, login/logout legítimos, PostgreSQL/provedor real e jornadas não executadas continuam abertos na matriz.

## Escopo e identidade

Publicar exclusivamente o pacote do PR22, mais o reparo isolado de login-page.test.tsx após revisão independente. Nenhum módulo desligado é reativado. Arquivos alheios, material Realnews, credenciais e capturas privadas não pertencem a esta release. A aprovação identifica o SHA final; revisão/CI de SHA anterior não o substituem.

## Evidência já disponível

- Técnico independente: PASS delimitado 9,05/10; produtores/consumidores strict, confirmação parcial, ausência de dados e erro explícito.
- Visual independente: PASS 8,1/10, somente gráfico/nav Home320/390 e apresentação modal320; não mede WCAG nem oito superfícies.
- Integração independente: PASS delimitado 8,5/10; Home/histórico, prévia→criação strict→readback sintético e modal/foco. Auth/repos/IA da fixture são sintéticos.
- Regressão fonte inicial: 529 testes web/78 arquivos e build/PWA PASS. CI37643681503 falhou em um teste login React/i18next; backend completo ficou SKIPPED. Esse CI é FAIL, preservado.
- Patch posterior examinado por esta meta: apenas teste, mantém LoginPage/renderer/router reais, tradução real, ampliação PT/EN, erro genérico e cleanup. Não prova integração do provider i18next. Parecer técnico independente e CI completo do SHA final são obrigatórios.

## Portões de autorização

Estado atual: PENDING, sem autorização de merge/deploy nesta versão do parecer.

1. Verificador independente aprova o patch final, com typecheck e regressão proporcional.
2. Commit final escopado, PR revisável e CI remoto completo SUCCESS no mesmo SHA; nenhum job essencial skipped/fail.
3. Meta registra PASS delimitado com nota ponderada >=8, todas dimensões >=7 e zero bloqueio crítico no pacote; dois diferenciais extraordinários vinculados a evidência.
4. Merge somente após esses portões; CI master SUCCESS e despacho Deploy VPS com SHA completo exato. Autorização humana já existe.
5. Após deploy, conferir master=fonte /opt/airia/app-src=versões backend/web=release.json/sw e HTTP/api/health + /home. Observar UI real da correção dentro do acesso legítimo disponível, preservando limitações.

A igualdade acima refere-se ao SHA da fonte real, não ao checkout operacional antigo /opt/airia/app. Falha de qualquer portão impede conclusão da publicação. Uma autorização pré-deploy não equivale ao PASS pós-deploy.

## Critérios extraordinários e limites

Dois ganhos concretos sustentam a candidatura: o adapter UI satisfaz o backend strict e preserva ordem sem relaxar schema; fonte vazia/histórico/erro parcial deixam de produzir falso zero ou falso salvo e preservam o próximo passo. A navegação320 e o modal voltam a conservar controles legíveis e acionáveis no escopo evidenciado. Nenhum desses ganhos comprova eficácia de IA, sensores ou cadastro integral.

Handoff: coordenador é dono serial do protocolo e entrega SHA final/CI e parecer do patch; meta decide autorização específica aqui. CLI do contrato total recebe somente mensagem de handoff/PASS delimitado, nunca meta-approve global para contornar casos abertos. DONE integral permanece BLOCKED. Próximo passo: receber os portões 1–2 e emitir parecer meta final da release.
