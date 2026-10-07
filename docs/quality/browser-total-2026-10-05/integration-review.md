# Parecer independente de integração — AIRIA-BROWSER-TOTAL

Papel: browser_integration, distinto dos executores e do verificador técnico. Coordenador é proprietário exclusivo do CUA. Revisão em 2026-10-05 do checkout com alterações locais, sem assumir publicação. Fontes: governança, protocolo, constituição, ticket, browser-evidence, handoffs e diff dos produtores/consumidores. Nenhum código de produto produzido por este papel.

## Resultado atual

**BLOCKED para aprovação integral, nota provisória 7,0/10.** Contratos locais abaixo têm evidência de integração técnica consistente, mas não comprovam a correção humana em navegador nem todo o aceite solicitado. A nota não é PASS de integração, nem dispensa de cadastro/entrada/saída/mobile.

- Preview Objetivos → adapter UI real → endpoint Express strict → persistência de fixture: **PASS técnico**. Execução própria `npm run test -w apps/backend -- objectives-preview`, exit0, 1 suíte. Raw metadata `order` recebe400 sem escrita; adapter ordena cópia, remove somente order, conserva IDs e sequência; HTTP201/readback preservam ordem sequencial. Fonte e teste real revisados. Não prova PostgreSQL/provedor/produção. Chamada de aplicar caminho também usa adapter, mas teste HTTP existente cobre criação; aplicar preview requer execução/readback específica.
- API histórico → store → gráfico/insight: **PASS técnico proporcional**. [] é autoridade e remove histórico/insight antigo; null conserva histórico e ativa aviso+retry. Home calcula elegibilidade sobre histórico válido, respeita vazio por período e oferece histórico30dias. Execução própria Vitest helpers/hydration/modal:3arquivos/33testes, exit0. Helpers não equivalem à montagem completa do provider com transporte real; API90dias[] não foi observado nesta conta e não deve ser descrito como causa provada.
- Home preferência/gráficos → ações: gate de colapso termina antes de Check-in/Objetivos/Ações; defaults/formatos legados têm teste. **Browser corrigido pendente**, produção antiga só mostrou gráfico após expansão.
- Portal Objetivos → navegação: fonte escapa contexto ancestral via body, z1000>nav50, scroll limitado, foco/Escape/restauração testados. **Hit-testing, mobile/teclado virtual e confirmação persistente pendentes**; JSDOM não prova CSS/hitTest. Não presumir background inert.
- Composer Diário/Aura → handler/API existentes: semântica button/nome PT/EN/disabled compatíveis; evidência de produção antiga prova resposta e persistência, não operação por teclado da correção local. Reimportação da nota ao reiniciar Diário continua achado separado, sem PASS por este patch.
- Navegação responsiva: ajustes coerentes com mínimos44px e centro88px; exige geometria real320/390 e toque sem sobreposição. Copy EN Presence/tabs corrigida em fonte não herda screenshot antigo.

## Próxima ação e condições para atualizar

Coordenador deve fornecer versão observada e provas reais do patch: Home default/collapse/reload/empty/error/retry; modal desktop/mobile hitTest+Escape/foco+confirmar→GET/reload→Home; aplicar/expandir caminho com ordem preservada; composer por nome e teclado; nav320/390. Executar cadastro/onboarding/login/logout e demais linhas do roteiro ou registrar bloqueio concreto. Regressão/build final devem cobrir diff final. Só então este parecer pode registrar nota final/PASS delimitado; conclusão global continua dependente de aceite completo e meta-verificador separado.

## Reavaliação delimitada — 2026-10-07

**PASS de integração delimitada, 8,5/10**, para estes três contratos locais: (1) histórico/API → Home e acesso ao gráfico/ação; (2) prévia de Objetivos → strict create → readback em repositório sintético; (3) modal de Objetivos → camada de navegação/foco. **O aceite integral AIRIA-BROWSER-TOTAL permanece BLOCKED**. Este PASS não aprova cadastro/login/logout completos, aplicação/expansão de caminho, Diário/Onboarding reais, respostas de provider, Postgres, CI, release ou produção. A aprovação manual não constitui evidência desses casos. Arquivo histórico mantém reprovação integral anterior para não substituir escopo por uma nota.

Evidência adicional examinada: `visual-review.md` reavaliação independente8,1 com imagens home-visual-final320/390 e goals-modal-corrected-mobile320; `independent-verifier-review.md` técnico9,05; `fixture-isolation-handoff.md` e observações CUA do coordenador. O coordenador executou: histórico antigo mensal com um ponto/médias5/6; Week sem registro → CTA30dias; gráfico recolhido preserva Check-in, ações e acesso; em320 modal Desdobrar92×42 com hitTesttrue e Cancelar restaurando foco ao opener; criação por campo→prévia→Confirmar produziu toast e objetivo único presente após reload. Readback de diagnóstico próprio confirmou subgoals1, milestones/notes arrays. Apenas o coordenador operou navegador; este papel revisou contratos e executou testes, não refez CUA concorrente.

A hipótese nestedcreate foi refutada pelo DTO lido e source/dist; Home undefined.length veio de override fixture incompleto `canWait`, corrigido no harness sem alterar produto. Após restart do coordenador37801/isolation+READY, o ambiente mantém frontend real com auth/repo/IA sintéticos e leituras Home adjacentes simuladas. A criação/readback prova strict transporte e conservação entre renders/reload no processo em memória; não durabilidade após reinício do servidor. Provider fictício não valida qualidade da decomposição. Esse limite integra a decisão, não é omitido para ganhar nota.

### Critérios da fatia

| Critério | Nota | Evidência |
|---|---:|---|
| Produtor/consumidor e integridade |9,0|Adapter UI contra rota strict real, ordem/IDs/readback; não relaxa validação |
| Acesso útil e dados honestos |8,5|Histórico antigo acessível, vazio por período, um ponto real e CTA fora do colapso |
| Controles entre superfícies |8,0|Portal/hitTest320/foco mais visual320/390; desktop/zoom/teclado virtual adicionais pendentes |
| Falha e feedback |8,5|Erro na prévia preserva entrada; null versus[] explícitos e retry sem dados inventados |
| Rastreabilidade e limites |8,5|Fixture isolada, correção de hipótese refutada e distinção local/produção/repo/provider |

Média simples8,5 desta fatia. Dois diferenciais extraordinários verificáveis: a prévia real pode ser confirmada sem afrouxar schema nem perder ordem, eliminando o400 observado; o acesso ao histórico e ao próximo passo continua coerente mesmo numa semana vazia ou com gráfico recolhido, sem apresentar dados fictícios ou esconder toda a operação. São ganhos sistêmicos entre produtor e consumidor, não apenas polimento.

Gates ainda obrigatórios antes do corretivo ser publicado/concluído: regressão/build do diff congelado, CI remoto, merge/deploy autorizados e identidadeSHA; repetir casos em produção após deploy. Para ampliar aprovação UI: desktop, scroll/alcançabilidade dos CTAs, reload da preferência, navegação geral/teclado e casos erro/retry visíveis. Para encerrar pedido total: matriz completa ou aceite humano de fechamento explicitamente delimitado com não-executados preservados. Meta independente deve decidir o escopo; este papel não registra meta-approve e não produz DONE.
