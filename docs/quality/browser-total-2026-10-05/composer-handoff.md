# Executor UI — envio acessível Diário/Aura

Contexto: coordenador observou no navegador o ícone de avião do Diário visível, mas ausente como botão acessível; envio exigiu coordenada. Papel executor não opera navegador/protocolo, não commita/publica nem aprova a própria entrega. Arquivos exclusivos: journal-page.tsx e aura-chat-page.tsx; comunicado horizontalmente ao executor Home.

## Busca e decisão

Buscas no Diário/Aura, componentes existentes, CSS de foco, i18n e histórico de journal-page (972bd21/fdb8f02/9afece0). Diário usava div com onClick e SVG sem nome/semântica; sendMessage já recusava vazio/sessão ausente/carga/finalização. Aura usava AuraButtonV2, componente existente baseado em button que transmite atributos nativos, mas ícone não tinha nome acessível. globals.css já aplica foco visível aos buttons no layout.

Reuso: botão HTML nativo no Diário e AuraButtonV2 existente na Aura, mantendo handler, endpoint e visual. Rejeitado adicionar role/tabIndex/keydown a div (semântica nativa resolve foco e Enter/Espaço com menor manutenção) e novo componente/dependência/estilo global (desnecessários para esta correção). Nenhum backend/copy visível alterado.

## Alteração e evidência

Diário: type=button, aria-label localizado “Enviar mensagem”/“Send message”, disabled coerente com guard existente (vazio, sem sessão, isTyping, isFinalizing), aria-busy durante resposta, SVG decorativo oculto. Cursor/opacidade refletem condição completa, borda nativa removida para preservar aparência. Aura: mesmo nome localizado/type/busy/SVG oculto, disabled existente preservado. Enter/Espaço sobre botão usam comportamento HTML nativo; não alterado Enter do textarea ou temporizador de resposta automática.

`npm run typecheck -w apps/web`: exit0. `npm run test -w apps/web -- src/i18n/source-audit.test.ts --maxWorkers=2`: um arquivo/um teste PASS, exit0. `git diff --check` dos dois arquivos exit0; somente avisos de conversão CRLF. Não escritos testes que espelham atributos triviais; validação comportamental necessária é navegador real, AX/foco/Enter/Espaço/estado disabled, sob propriedade do coordenador. Build/regressão da entrega composta permanecem gates do coordenador.

## Achado separado — reimportação da nota

Coordenador reportou envio/resposta/finalização reais e histórico com resumo salvo, mas reload reabriu sessão só com nota Check-in. Código explica possível causa: mount Diário chama openJournal→POST /journal/start; finalizeSession limpa estado de conversa e retorna overview; index.ts:3701 injeta context.checkinToday.note quando created e messages vazias, sem conferir consumo por sessão anterior. Isso pode criar outra sessão/nota ao reload após finalização. Não demonstra perda do resumo, que foi encontrado nos anteriores pelo coordenador. Nenhuma correção dessa idempotência/backend nesta fatia; exige ticket/casos específicos, evitando confundir histórico com sessão ativa.

Estado **READY_VERIFY**, sem autoaprovação. Próxima ação coordenador/revisor: em ambiente da revisão, localizar envio por nome/role PT/EN; conferir foco visível, Enter/Espaço, vazio/carga e envio com persistência/reload; registrar produção versus local claramente. App publicado ainda não recebe esta correção sem novo ciclo release autorizado. Reimportação permanece achado separado e não deve ganhar PASS por esta mudança.
