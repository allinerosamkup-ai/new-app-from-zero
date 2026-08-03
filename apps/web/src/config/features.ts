/**
 * Funcionalidades ligadas e desligadas do produto.
 *
 * O app foi reduzido ao núcleo — check-in, objetivos, padrões e diário. Planner
 * e Hábitos saíram de circulação, mas o código deles continua inteiro: nenhum
 * arquivo foi apagado, nenhuma tabela sumiu, nenhuma chave de tradução foi
 * removida. Trocar `false` por `true` aqui devolve barra de navegação, rotas,
 * pré-carregamentos, alvo das notificações, ação principal da home, cards de
 * atalho e todos os CTAs de uma vez.
 *
 * As rotas desligadas continuam registradas em App.tsx, redirecionando para a
 * home. Isso não é sobra: notificação push já entregue no celular de alguém e
 * link salvo apontam para /planner, e cair em 404 é pior que cair na home.
 *
 * Por que constante literal e não variável de ambiente: a CI roda build,
 * typecheck e testes sem .env — literal é determinístico em qualquer máquina, e
 * o empacotador consegue remover os ramos desligados do pacote final.
 *
 * Este arquivo mora em `config/` de propósito, fora de `routes/` e
 * `components/`, que é o que o audit de i18n varre.
 */
export const FEATURES = {
  planner: false,
  habits: false,
} as const;

/** Para onde vai quem tenta abrir uma rota desligada. */
export const FEATURE_FALLBACK_ROUTE = "/home";
