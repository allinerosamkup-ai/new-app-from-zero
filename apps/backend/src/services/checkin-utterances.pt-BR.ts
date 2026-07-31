export type CheckinUtteranceExpectation = {
  text: string;
  status: 'ready' | 'needs_clarification' | 'unsupported';
  mood?: number | null;
  energy?: number | null;
};

export const CHECKIN_UTTERANCES_PT_BR: CheckinUtteranceExpectation[] = [
  { text: 'Estou chateada e cansada', status: 'ready', mood: 3, energy: 3 },
  { text: 'Tô triste e sem energia', status: 'ready', mood: 2, energy: 1 },
  { text: 'Acordei péssima e exausta', status: 'ready', mood: 2, energy: 1 },
  { text: 'Estou irritada e cansada hoje', status: 'ready', mood: 4, energy: 3 },
  { text: 'Estou feliz e muito disposta', status: 'ready', mood: 8, energy: 8 },
  { text: 'Meu humor está 7 e minha energia 6', status: 'ready', mood: 7, energy: 6 },
  { text: 'Minha energia hoje é 8', status: 'needs_clarification', mood: null, energy: 8 },
  { text: 'Estou chateada', status: 'needs_clarification', mood: 3, energy: null },
  { text: 'Só estou desabafando; não registre', status: 'unsupported', mood: null, energy: null },
  { text: 'Não faça check-in com isso: estou cansada', status: 'unsupported', mood: null, energy: null },
  { text: 'Preciso comprar ração amanhã', status: 'unsupported', mood: null, energy: null },
];
