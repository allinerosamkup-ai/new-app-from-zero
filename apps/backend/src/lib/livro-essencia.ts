/**
 * Essência do livro "Além da Solidão — A Jornada de Desvendar sua Essência e
 * Redescobrir as Relações" (autora: Alline Izabel da Rosa — a mesma pessoa por
 * trás da Airia). É o embrião conceitual do app.
 *
 * Dois usos:
 * 1. LIVRO_ESSENCE_LENS  → injetado no prompt da Aura: dá TEMA, profundidade e
 *    voz (a alma do livro), sem afrouxar as regras de movimento e voz do app.
 * 2. JORNADA_STEPS       → backbone de dados da "Jornada Interior": 13 passos
 *    que espelham os capítulos do livro e desembocam em features que já existem.
 *
 * Fonte: apps/backend/src/content/livro-alem-da-solidao.txt
 */

export const LIVRO_ESSENCE_LENS = [
  'BASE FILOSOFICA (alma do produto, vinda do livro "Alem da Solidao" da propria autora da Airia). Use como lente de tema e profundidade, NUNCA como nome citado.',
  'Tese raiz, identica a da Airia: conhecimento sem pratica diaria nao muda nada. A autora escreve "de nada adianta ler sem praticar todos os dias" e "firme na acao". Isso REFORCA a regra de movimento — nunca a afrouxa.',
  'Autoconhecimento e a base de toda conexao: quem nao se conhece se perde nas relacoes e na solidao. Primeiro a pessoa se reconcilia consigo, depois constroi pontes com o outro.',
  'Solidao nao e falha nem fim: e processo de cura, renovacao e autoaceitacao. Trate um dia de recolhimento como parte da jornada, nao como derrota.',
  'O amor proprio e a base de qualquer amor. Celebrar a individualidade vale mais que buscar aprovacao externa. Celebre comportamento e escolha concreta, nao identidade vaga.',
  'Caminhos concretos de conexao que o livro ensina e a Aura pode ativar: limites saudaveis, comunicacao assertiva, empatia, vulnerabilidade autentica, gratidao. Trate como acao, nao como conceito bonito.',
  'Imagens da casa (use no maximo UMA por resposta, so quando couber natural, nunca empilhe nem vire poesia vazia): pedra que faz ondas no lago, sementes pro eu futuro, jardineiro que rega todo dia, construir pontes, florescer, pagina em branco.',
  'ESTE BLOCO DA TEMA E PROFUNDIDADE, NAO LICENCA PRA AFROUXAR: continua proibido autoajuda vaga e validacao sem movimento. A profundidade do livro vem sempre junto de uma acao concreta.',
];

/** Domínios onde a alma do livro entra no prompt (superfícies reflexivas). */
export const SOUL_DOMAINS = new Set([
  'general',
  'home',
  'journal',
  'journal-live',
  'journal-finalize',
  'checkin',
  'aura-command',
  'insight',
  'summary',
  'onboarding',
]);

export type JornadaFeature = 'journal' | 'habits' | 'checkin' | 'insights' | 'planner';

export type JornadaStep = {
  n: number;
  slug: string;
  titulo: string;
  /** Tema do capítulo, em linguagem humana. */
  tema: string;
  /** Reflexão curta que a Aura usa pra abrir o passo (voz do livro, sem jargão). */
  reflexao: string;
  /** Ação concreta — desemboca numa feature que já existe. */
  exercicio: string;
  /** Feature do app que o passo aciona. */
  feature: JornadaFeature;
  /** Versão mínima pra fase baixa (Recolhimento/Pausa/Turbulência), anti-inércia. */
  faseBaixa: string;
};

/**
 * Os 13 passos espelham os 13 capítulos do livro, mas como prática contínua e
 * adaptativa — não como curso linear que se conclui. A pessoa revisita temas
 * conforme o humor cicla. Cada passo aciona uma feature existente.
 */
export const JORNADA_STEPS: JornadaStep[] = [
  {
    n: 1, slug: 'conexao-consigo', titulo: 'Conexão consigo mesma',
    tema: 'Autodescoberta — paixões, metas e valores como alicerce.',
    reflexao: 'Antes de qualquer conexão com o outro, vem a conexão com você. O que faz seu coração pulsar?',
    exercicio: 'Escreva no diário 3 coisas que mais importam pra você hoje e como elas guiam suas escolhas.',
    feature: 'journal',
    faseBaixa: 'Só uma linha: uma coisa que importa pra você agora.',
  },
  {
    n: 2, slug: 'autoconfianca', titulo: 'Autoconfiança e autoestima',
    tema: 'Afirmações que viram prática diária, não frase de parede.',
    reflexao: 'Autoestima não se conserta com discurso. Se constrói com um gesto repetido.',
    exercicio: 'Crie um hábito diário de autocuidado — pequeno, do tamanho da sua fase.',
    feature: 'habits',
    faseBaixa: 'Marque um hábito que já existe. Um só. Já conta.',
  },
  {
    n: 3, slug: 'aceitacao-bem-estar', titulo: 'Aceitação e bem-estar',
    tema: 'Autenticidade e hábitos saudáveis sustentando o dia.',
    reflexao: 'Ser quem você é, sem se anular pra caber. O bem-estar nasce daí.',
    exercicio: 'Escolha um hábito de bem-estar concreto pra repetir esta semana.',
    feature: 'habits',
    faseBaixa: 'Beba água agora e marque. O corpo primeiro.',
  },
  {
    n: 4, slug: 'comunicacao-assertiva', titulo: 'Comunicação assertiva',
    tema: 'Dizer o que sente e precisa, com clareza e respeito.',
    reflexao: 'Comunicação clara muda relação. O não dito apodrece por dentro.',
    exercicio: 'Escreva no diário uma conversa que você está adiando e a primeira frase dela.',
    feature: 'journal',
    faseBaixa: 'Só nomeie: com quem é a conversa que pesa.',
  },
  {
    n: 5, slug: 'padroes-relacionamento', titulo: 'Padrões de relacionamento',
    tema: 'Reconhecer o que se repete nas suas relações.',
    reflexao: 'Cada escolha é uma pedra no lago — as ondas chegam nas suas relações.',
    exercicio: 'Olhe seus padrões: o que se repete nas relações que te marcaram?',
    feature: 'insights',
    faseBaixa: 'Uma frase: um padrão que você já percebeu em você.',
  },
  {
    n: 6, slug: 'redes-fortalecedoras', titulo: 'Redes que fortalecem',
    tema: 'Construir uma rede de apoio sólida.',
    reflexao: 'Solidão não se cura sozinha. Quem é a pessoa que te faz bem e você não procura há tempo?',
    exercicio: 'Mande uma mensagem hoje pra alguém que te faz bem.',
    feature: 'planner',
    faseBaixa: 'Só um emoji pra essa pessoa já abre a porta.',
  },
  {
    n: 7, slug: 'vulnerabilidade', titulo: 'Força na vulnerabilidade',
    tema: 'A coragem de se mostrar como é.',
    reflexao: 'Vulnerabilidade genuína não é fraqueza — é onde a conexão real começa.',
    exercicio: 'Escreva no diário algo verdadeiro que você costuma esconder.',
    feature: 'journal',
    faseBaixa: 'Uma palavra pro que você sente agora. Sem explicar.',
  },
  {
    n: 8, slug: 'limites-saudaveis', titulo: 'Limites saudáveis',
    tema: 'Proteger seu espaço, ritmo e energia.',
    reflexao: 'Limite não é muro — é cuidar do que é seu. Em fase baixa, o app já protege isso por você.',
    exercicio: 'Nomeie um limite que você precisa colocar e com quem.',
    feature: 'journal',
    faseBaixa: 'Hoje seu limite é descansar sem culpa. Aceite esse.',
  },
  {
    n: 9, slug: 'empatia', titulo: 'Empatia nas relações',
    tema: 'Entender o outro fortalece o laço.',
    reflexao: 'Empatia não é concordar — é enxergar de onde o outro fala.',
    exercicio: 'Pense numa pessoa difícil e escreva o que ela pode estar sentindo.',
    feature: 'journal',
    faseBaixa: 'Só pergunte interno: o que essa pessoa pode estar carregando?',
  },
  {
    n: 10, slug: 'pontes', titulo: 'Construindo pontes',
    tema: 'Sustentar conexões ao longo do tempo.',
    reflexao: 'Pontes precisam de manutenção. Qual relação anda esquecida e merece um gesto?',
    exercicio: 'Faça um gesto concreto por uma relação que importa: uma mensagem, um plano, um obrigada.',
    feature: 'planner',
    faseBaixa: 'Um agradecimento curto pra alguém. Só isso.',
  },
  {
    n: 11, slug: 'relacionamentos-autenticos', titulo: 'Relacionamentos autênticos',
    tema: 'Confiança, comunicação, compreensão e cumplicidade.',
    reflexao: 'Relação autêntica é onde você pode ser você sem medo. Onde você tem isso na sua vida?',
    exercicio: 'Escolha uma pessoa pra aprofundar a conexão e dê o primeiro passo gradual.',
    feature: 'planner',
    faseBaixa: 'Pense em uma pessoa com quem você é você mesma. Guarde o nome.',
  },
  {
    n: 12, slug: 'individualidade', titulo: 'Celebrando a individualidade',
    tema: 'Valorizar a sua singularidade.',
    reflexao: 'O amor próprio é a base de qualquer amor. O que em você merece ser celebrado hoje?',
    exercicio: 'Registre uma qualidade ou conquista sua de hoje — por menor que pareça.',
    feature: 'checkin',
    faseBaixa: 'Uma coisa que você fez hoje, mesmo mínima. Reconheça.',
  },
  {
    n: 13, slug: 'novo-comeco', titulo: 'Um novo começo',
    tema: 'A jornada é contínua — cada dia, uma página em branco.',
    reflexao: 'Isso não é um ponto final, é um florescer contínuo. Você é o autor principal.',
    exercicio: 'Olhe o caminho até aqui e escolha um foco pra próxima semana.',
    feature: 'insights',
    faseBaixa: 'Uma intenção pra amanhã, em poucas palavras.',
  },
];
