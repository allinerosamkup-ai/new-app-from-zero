A Home ocultava gráficos e parte da próxima ação; o modal de Objetivos ficava sob a navegação e a confirmação enviava metadados rejeitados pelo contrato estrito. Esta correção recupera acesso a gráficos/ações, isola o modal com foco e rolagem, e adapta as escritas de Objetivos preservando ordem e validação.

Inclui correções relacionadas de onboarding, idempotência da nota do Check-in no Diário, nomes acessíveis de login/composers e apresentação PT/EN de presença/insights/compartilhamento. Planejador e Rotinas permanecem excluídos. Nenhuma captura privada de navegador acompanha o PR; imagens ficam locais.

Evidência independente disponível: técnico 9,05; visual 8,1 e integração 8,5 delimitados. Casos locais usam frontend/rotas reais com autenticação/repositório/provedor sintéticos; não provam PostgreSQL, qualidade do provedor ou todas as jornadas de produção. Cadastro/login/logout integrais, aplicação/expansão de caminho e demais casos pendentes estão explicitados na matriz, sem PASS inventado.

O erro observado na Home do harness veio de DTO sintético sem `canWait`, corrigido exclusivamente na fixture. A hipótese de nested create foi refutada pelo readback de arrays e não foi tratada como correção do produto.

Fonte congelada pelo coordenador em 2026-10-07: 78 arquivos/529 testes web PASS, build final Vite/PWA PASS; typecheck e testes proporcionais/backend constam nos handoffs. Browser local reconfirmou Home após reload com preferência recolhida, acessos preservados e CTA de Check-in navegando de fato.

Publicação corretiva autorizada pela titular; este PR permanece draft até meta independente e CI verde. Não declara verificação total encerrada. Publicação usará SHA completo de master conferido antes/depois do workflow VPS.
