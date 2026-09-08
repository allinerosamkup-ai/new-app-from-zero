import { validateConcreteAction } from '../lib/action-quality';

type GoalStep = {
  title: string;
  basedOn: 'stated' | 'inferred';
  rationale?: string;
  milestoneId?: string;
  doneWhen?: string;
  effortSize?: 'small' | 'medium' | 'large';
};

type GoalDecomposition = {
  mode: 'actions' | 'question';
  resultDefinition: string | null;
  currentReality: string | null;
  currentMilestoneId: string | null;
  milestones: Array<{
    id: string;
    title: string;
    order: number;
    doneWhen: string;
    actions: GoalStep[];
  }>;
  assumptions: string[];
  steps: GoalStep[];
  question: string | null;
};

type Starter = { title: string; doneWhen: string; effortSize: 'small' | 'medium' };

export function genericStarters(): Starter[] {
  return [
    { title: 'Separar o que já existe para __GOAL__', doneWhen: 'o que já existe para __GOAL__ estiver separado', effortSize: 'small' },
    { title: 'Listar o primeiro recorte executável de __GOAL__', doneWhen: 'o primeiro recorte de __GOAL__ estiver listado', effortSize: 'small' },
    { title: 'Realizar uma primeira versão pequena de __GOAL__', doneWhen: 'uma primeira versão de __GOAL__ estiver concluída', effortSize: 'medium' },
    { title: 'Registrar o que avançou em __GOAL__', doneWhen: 'o avanço de __GOAL__ estiver registrado', effortSize: 'small' },
  ];
}

export function getDomainStarters(title: string): Starter[] {
  const t = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  if (/\b(ler|livro|leitura|estudar|curso|aula)\b/.test(t)) {
    return [
      { title: 'Separar o material de __GOAL__', doneWhen: 'o material de __GOAL__ estiver à mão', effortSize: 'small' },
      { title: 'Listar o trecho da sessão de __GOAL__', doneWhen: 'o trecho da sessão de __GOAL__ estiver marcado', effortSize: 'small' },
      { title: 'Ler a primeira sessão de __GOAL__', doneWhen: 'a primeira sessão de __GOAL__ estiver concluída', effortSize: 'medium' },
      { title: 'Registrar onde parou em __GOAL__', doneWhen: 'a marcação de __GOAL__ estiver feita', effortSize: 'small' },
    ];
  }

  if (/\b(treino|academia|correr|corrida|exercicio|caminhada|yoga)\b/.test(t)) {
    return [
      { title: 'Separar a roupa de __GOAL__', doneWhen: 'a roupa de __GOAL__ estiver separada', effortSize: 'small' },
      { title: 'Marcar o horário de __GOAL__', doneWhen: 'o horário de __GOAL__ estiver marcado', effortSize: 'small' },
      { title: 'Realizar a sessão de __GOAL__', doneWhen: 'a sessão de __GOAL__ estiver concluída', effortSize: 'medium' },
      { title: 'Registrar a sessão de __GOAL__', doneWhen: 'a sessão de __GOAL__ estiver registrada', effortSize: 'small' },
    ];
  }

  if (/\b(comprar|compra|mercado|shopping)\b/.test(t)) {
    return [
      { title: 'Listar o que entra em __GOAL__', doneWhen: 'a lista de __GOAL__ estiver pronta', effortSize: 'small' },
      { title: 'Marcar o teto de gasto de __GOAL__', doneWhen: 'o teto de gasto de __GOAL__ estiver marcado', effortSize: 'small' },
      { title: 'Realizar a compra de __GOAL__', doneWhen: 'a compra de __GOAL__ estiver feita', effortSize: 'medium' },
      { title: 'Registrar o que foi comprado em __GOAL__', doneWhen: 'o registro de __GOAL__ estiver feito', effortSize: 'small' },
    ];
  }

  if (/\b(cozinhar|comida|receita|refeicao|jantar|almoco|lanche)\b/.test(t)) {
    return [
      { title: 'Listar os ingredientes de __GOAL__', doneWhen: 'os ingredientes de __GOAL__ estiverem listados', effortSize: 'small' },
      { title: 'Separar as panelas de __GOAL__', doneWhen: 'as panelas de __GOAL__ estiverem na bancada', effortSize: 'small' },
      { title: 'Cozinhar a primeira porção de __GOAL__', doneWhen: 'a primeira porção de __GOAL__ estiver pronta', effortSize: 'medium' },
      { title: 'Registrar o que foi cozinhado em __GOAL__', doneWhen: 'o registro de __GOAL__ estiver feito', effortSize: 'small' },
    ];
  }

  if (/\b(limpar|arrumar|faxina|quarto|sala)\b/.test(t)) {
    return [
      { title: 'Retirar o que não pertence a __GOAL__', doneWhen: 'o que não pertence a __GOAL__ estiver fora do lugar', effortSize: 'small' },
      { title: 'Colocar no lugar os objetos de uso de __GOAL__', doneWhen: 'os objetos de uso de __GOAL__ estiverem no lugar', effortSize: 'medium' },
      { title: 'Guardar o que ficou solto em __GOAL__', doneWhen: 'o que ficou solto em __GOAL__ estiver guardado', effortSize: 'medium' },
      { title: 'Registrar o estado final de __GOAL__', doneWhen: 'o estado final de __GOAL__ estiver registrado', effortSize: 'small' },
    ];
  }

  if (/\b(relatorio|apresentacao|reuniao|documento)\b/.test(t)) {
    return [
      { title: 'Abrir o arquivo de __GOAL__', doneWhen: 'o arquivo de __GOAL__ estiver aberto', effortSize: 'small' },
      { title: 'Listar os dados da primeira seção de __GOAL__', doneWhen: 'os dados da primeira seção de __GOAL__ estiverem listados', effortSize: 'medium' },
      { title: 'Escrever o rascunho da primeira seção de __GOAL__', doneWhen: 'o rascunho de __GOAL__ estiver escrito', effortSize: 'medium' },
      { title: 'Registrar o próximo recorte de __GOAL__', doneWhen: 'o próximo recorte de __GOAL__ estiver registrado', effortSize: 'small' },
    ];
  }

  return genericStarters();
}

export function bindFallbackSteps(title: string, capacity?: 'quick' | 'moderate' | 'heavy' | null): GoalStep[] {
  const maxSteps = capacity === 'quick' ? 3 : 4;
  const bind = (starter: Starter): GoalStep => ({
    ...starter,
    title: starter.title.replaceAll('__GOAL__', title.toLowerCase()),
    doneWhen: starter.doneWhen.replaceAll('__GOAL__', title.toLowerCase()),
    basedOn: 'inferred',
    rationale: 'sugerido sem consulta completa à IA: passos práticos de começo',
    milestoneId: 'milestone-now',
  });
  let steps = getDomainStarters(title).map(bind).filter((step) => validateConcreteAction(step).ok);
  if (steps.length < maxSteps) {
    const seen = new Set(steps.map((step) => step.title.toLowerCase()));
    for (const starter of genericStarters()) {
      const step = bind(starter);
      if (!validateConcreteAction(step).ok || seen.has(step.title.toLowerCase())) continue;
      seen.add(step.title.toLowerCase());
      steps.push(step);
    }
  }
  return steps.slice(0, maxSteps);
}

export function buildDomainFallbackDecomposition(
  input: { goalTitle: string; userStatements?: string[]; capacity?: 'quick' | 'moderate' | 'heavy' | null },
): GoalDecomposition {
  const title = input.goalTitle.trim().replace(/\s+/g, ' ');
  if (!title) {
    return {
      mode: 'question',
      resultDefinition: null,
      currentReality: null,
      currentMilestoneId: null,
      milestones: [],
      assumptions: [],
      steps: [],
      question: 'Me conta: o que "começado" significa para você nesse objetivo?',
    };
  }

  const steps = bindFallbackSteps(title, input.capacity);
  return {
    mode: 'actions',
    resultDefinition: `você ter produzido uma primeira evidência de avanço em ${title.toLowerCase()}`,
    currentReality: null,
    currentMilestoneId: 'milestone-now',
    milestones: [{
      id: 'milestone-now',
      title: 'Começo',
      order: 0,
      doneWhen: 'os primeiros passos práticos estiverem feitos',
      actions: steps,
    }],
    assumptions: ['sugerido pela Airia sem consulta completa à IA — edite como quiser'],
    steps,
    question: null,
  };
}
