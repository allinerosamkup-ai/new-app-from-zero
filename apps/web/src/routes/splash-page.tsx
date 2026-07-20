import { ArrowRight, BrainCircuit, CalendarRange, ClipboardList, HeartHandshake, ShieldCheck, Sparkles, Waves, type LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useLocalizedCopy } from "../i18n";

import "../styles/aura.css";
import "../styles/editorial.css";

type InfoCard = {
  title: string;
  description: string;
};

type StepCard = {
  title: string;
  description: string;
  eyebrow: string;
};

type FeatureCard = {
  title: string;
  description: string;
  icon: LucideIcon;
};

type ScreenshotCard = {
  title: string;
  description: string;
  src: string;
  imageTransform?: string;
};

const BRAND = {
  nectarine: "#F4A896",
  nectarineLight: "#FDE8E3",
  menthe: "#B8D9C8",
  lagune: "#8FB8C4",
  pecheSoft: "#FEF3E0",
  lavender: "#D4C4E0",
  rosa: "#F0C4D4",
  textWarm: "#6B5B57",
  textSoft: "#8B7B77",
  bgLight: "#FDF9F5",
  bgDark: "#141211",
} as const;

const AIRIA_SERIF = "'Playfair Display', Georgia, serif";

const audienceCards: InfoCard[] = [
  {
    title: "A Airia cruza o que você sente com o que já vinha acontecendo",
    description:
      "Para quem percebe tarde demais que entrou em queda, aceleração ou exaustão. A Airia lê humor, energia, sono, agenda, diário e histórico para construir baseline pessoal, EWMA e leitura mais fiel do seu momento.",
  },
  {
    title: "Um espaço onde fato, história e decisão ficam separados",
    description:
      "Em vez de responder com frases genéricas, a Airia ajuda a entender o que aconteceu, qual interpretação tomou conta e qual decisão concreta está sendo evitada, protegida ou adiada.",
  },
  {
    title: "Bio-previsibilidade para ajustar o dia antes do atrito",
    description:
      "Quando o app percebe que sua energia está mudando, o planner, os alertas e as sugestões mudam junto. Não é cobrança de rotina: é leitura de ritmo para escolher melhor o próximo movimento.",
  },
  {
    title: "Histórico organizado para conversar melhor sobre você",
    description:
      "Sensações vagas viram registros de ciclo, estabilidade, quedas, pré-quedas, decisões e padrões recorrentes. Se você faz terapia ou acompanhamento médico, chega com contexto em vez de memória solta.",
  },
];

const flowSteps: StepCard[] = [
  {
    eyebrow: "01",
    title: "Check-in de 30 segundos",
    description:
      "Você registra humor, energia, sono e sinais do corpo sem transformar isso em obrigação. É o dado mínimo para o app começar a entender seu dia real.",
  },
  {
    eyebrow: "02",
    title: "O app calcula padrão, tendência e estabilidade",
    description:
      "O Mood Cycle Engine cruza EWMA individual, baseline pessoal, variação, sono e tendência de 7 dias para estimar sua faixa atual sem depender de média genérica.",
  },
  {
    eyebrow: "03",
    title: "A Airia transforma leitura em movimento",
    description:
      "Com contexto e memória, a Airia separa fato de interpretação, reconhece padrões e propõe uma manobra pequena: avançar, reduzir estímulo, reorganizar ou se expor gradualmente.",
  },
];

const features: FeatureCard[] = [
  {
    icon: Waves,
    title: "Humor e energia em 8 fases",
    description:
      "O app mostra se você está em voo alto, fluxo, estabilidade, desaceleração, recolhimento, pausa, retomada ou turbulência.",
  },
  {
    icon: CalendarRange,
    title: "Planner que respeita energia real",
    description:
      "Agenda, hábitos, ações e metas aparecem calibrados pela sua fase atual, sem transformar tudo em evento com horário.",
  },
  {
    icon: BrainCircuit,
    title: "Airia com memória de padrões",
    description:
      "A IA usa diário, check-ins, planner, metas e sugestões recentes para reconhecer repetição, custo oculto e decisão pendente.",
  },
  {
    icon: HeartHandshake,
    title: "Diário que conversa e vira plano",
    description:
      "O diário não só acolhe: ele ajuda a testar ideias, validar sugestões e transformar o que fez sentido em ações para o planner.",
  },
  {
    icon: ClipboardList,
    title: "Histórico para ver suas fases ao longo do tempo",
    description:
      "Gráficos semanais, mensais e previsões mostram humor e energia juntos, com faixas, baseline pessoal e alertas baseados em dados do próprio uso.",
  },
];

const screenshots: ScreenshotCard[] = [
  {
    title: "Home com leitura do dia",
    description: "Abertura com estado atual, sinais da semana e leitura rápida do que pede mais cuidado agora.",
    src: "/screenshots/home-page.png",
  },
  {
    title: "Check-in rápido e tátil",
    description: "Fluxo simples para registrar humor e energia sem fricção desnecessária.",
    src: "/screenshots/checkin-page.png",
  },
  {
    title: "Planner com agenda adaptativa",
    description: "Blocos, prioridades e replanejamento com mais respeito ao estado real do dia.",
    src: "/screenshots/planner-page.png",
  },
  {
    title: "Insights e padrões",
    description: "Visualizações para perceber fases, quedas, estabilidade e sinais recorrentes.",
    src: "/screenshots/insights-page.png",
  },
  {
    title: "Airia: padrões, decisões e fases",
    description: "Uma conversa que lê contexto, reconhece padrões e transforma clareza emocional em ação prática.",
    src: "/screenshots/aura-page.png",
  },
];

const testimonials = [
  {
    name: "Mariana G.",
    role: "Designer (TDAH)",
    content: "A Airia é o primeiro app que não me faz sentir culpado por mudar o plano quando minha energia cai. O planner adaptativo é o que eu sempre precisei.",
  },
  {
    name: "Ricardo S.",
    role: "Empreendedor",
    content: "Perceber o sinal de exaustão 3 dias antes de acontecer mudou meu jogo. Menos 'apagões', mais clareza sobre meus limites.",
  },
  {
    name: "Julia W.",
    role: "Escritora",
    content: "Não é só um tracker genérico, é uma conversa que faz sentido. A IA realmente entende meus padrões e me ajuda a decidir o próximo passo.",
  },
];

const faqs = [
  {
    question: "Meus dados de humor estão seguros?",
    answer: "Sim. Seus registros são privados e usados apenas pela IA para te dar contexto. Não vendemos dados nem usamos para treinar modelos públicos.",
  },
  {
    question: "O que é Bio-sincronia?",
    answer: "É a técnica de ajustar suas tarefas e expectativas à sua biologia real (energia, sono, fases de humor) em vez de seguir uma agenda rígida.",
  },
  {
    question: "Por que o app está grátis?",
    answer: "Estamos em fase Beta Privada. Queremos construir a base do produto com usuários reais antes de definir o modelo de assinatura futuro.",
  },
];

const heroHighlights = [
  "Perceba queda, aceleração e exaustão antes que virem apagão",
  "Entenda o padrão por trás do problema, não só o sentimento do momento",
  "Receba uma próxima ação possível para a fase em que você está",
];

const audienceCardsEn: InfoCard[] = [
  { title: "Airia connects how you feel with what was already happening", description: "For people who notice too late that they are dropping, accelerating, or exhausted. Airia reads mood, energy, sleep, agenda, journal, and history to build a personal baseline and a more faithful reading of the moment." },
  { title: "A space where facts, stories, and decisions stay separate", description: "Instead of generic phrases, Airia helps you understand what happened, which interpretation took over, and which concrete decision is being avoided, protected, or postponed." },
  { title: "Biological predictability to adjust the day before friction", description: "When the app notices your energy changing, the planner, alerts, and suggestions change with it. It reads your rhythm so you can choose the next move more intelligently." },
  { title: "Organized history for better conversations about you", description: "Vague sensations become records of cycles, stability, drops, early signals, decisions, and recurring patterns. You can bring useful context to therapy or medical care instead of relying on scattered memory." },
];

const flowStepsEn: StepCard[] = [
  { eyebrow: "01", title: "A 30-second check-in", description: "Record mood, energy, sleep, and body signals without turning it into an obligation. It is the minimum data Airia needs to begin understanding your real day." },
  { eyebrow: "02", title: "The app calculates patterns, trends, and stability", description: "The Mood Cycle Engine combines your personal baseline, individual EWMA, variation, sleep, and seven-day trend instead of relying on a generic average." },
  { eyebrow: "03", title: "Airia turns the reading into movement", description: "With context and memory, Airia separates facts from interpretation, recognizes patterns, and suggests a small maneuver: move forward, reduce stimulation, reorganize, or expose yourself gradually." },
];

const featuresEn: Array<Omit<FeatureCard, "icon">> = [
  { title: "Mood and energy across eight phases", description: "See whether you are in high flight, flow, stability, slowdown, retreat, pause, resumption, or turbulence." },
  { title: "A planner that respects real energy", description: "Agenda items, habits, actions, and goals are calibrated to your current phase without turning everything into a timed event." },
  { title: "Airia with pattern memory", description: "AI uses your journal, check-ins, planner, goals, and recent suggestions to recognize repetition, hidden cost, and pending decisions." },
  { title: "A journal that talks and becomes a plan", description: "The journal does more than welcome you: it helps test ideas, validate suggestions, and turn what makes sense into planner actions." },
  { title: "History that shows your phases over time", description: "Weekly and monthly charts and forecasts show mood and energy together, with personal baselines and alerts grounded in your own usage." },
];

const screenshotsEn: Array<Omit<ScreenshotCard, "src" | "imageTransform">> = [
  { title: "Home with a reading of your day", description: "Open to your current state, weekly signals, and a quick reading of what needs care now." },
  { title: "A fast, tactile check-in", description: "A simple flow for recording mood and energy without unnecessary friction." },
  { title: "Planner with an adaptive agenda", description: "Blocks, priorities, and replanning that respect the day's real state." },
  { title: "Insights and patterns", description: "Visualizations for noticing phases, drops, stability, and recurring signals." },
  { title: "Airia: patterns, decisions, and phases", description: "A conversation that reads context, recognizes patterns, and turns emotional clarity into practical action." },
];

const testimonialsEn = [
  { role: "Designer (ADHD)", content: "Airia is the first app that does not make me feel guilty for changing the plan when my energy drops. The adaptive planner is what I always needed." },
  { role: "Entrepreneur", content: "Noticing the exhaustion signal three days early changed everything. Fewer blackouts and more clarity about my limits." },
  { role: "Writer", content: "It is not another generic tracker; it is a conversation that makes sense. The AI understands my patterns and helps me choose the next step." },
];

const faqsEn = [
  { question: "Is my mood data secure?", answer: "Yes. Your records are private and used to give you context. We do not sell your data or use it to train public models." },
  { question: "What is bio-synchrony?", answer: "It is the practice of aligning tasks and expectations with your real biology — energy, sleep, and mood phases — instead of forcing a rigid agenda." },
  { question: "Why is the app free?", answer: "Airia is in private beta. We are building the product foundation with real users before defining a future subscription model." },
];

const heroHighlightsEn = [
  "Notice drops, acceleration, and exhaustion before they become a blackout",
  "Understand the pattern behind the problem, not only the feeling of the moment",
  "Get a possible next action for the phase you are in",
];

const sectionTitleStyle = {
  margin: 0,
  fontSize: "clamp(28px, 4vw, 46px)",
  lineHeight: 1.05,
  letterSpacing: "-0.04em",
  color: BRAND.textWarm,
  fontWeight: 800,
  fontFamily: "'Plus Jakarta Sans', sans-serif",
} satisfies CSSProperties;

function AiriaConstellationLogo({
  size = 84,
  hybrid = false,
}: {
  size?: number;
  hybrid?: boolean;
}) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} style={{ overflow: "visible", display: "block" }}>
      {hybrid ? (
        <g opacity="0.28">
          {[52, 70, 88].map((radius, index) => (
            <circle
              key={radius}
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke={BRAND.nectarine}
              strokeWidth="1"
              strokeDasharray={index === 1 ? "0" : "3 5"}
            />
          ))}
        </g>
      ) : null}

      <circle cx="90" cy="80" r="42" fill={BRAND.nectarine} fillOpacity="0.88" stroke="white" strokeWidth="1.5" />
      <circle cx="130" cy="85" r="32" fill={BRAND.menthe} fillOpacity="0.88" stroke="white" strokeWidth="1.5" />
      <circle cx="75" cy="115" r="28" fill={BRAND.lagune} fillOpacity="0.88" stroke="white" strokeWidth="1.5" />
      <circle cx="125" cy="120" r="30" fill={BRAND.rosa} fillOpacity="0.88" stroke="white" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="16" fill={BRAND.nectarineLight} fillOpacity="0.98" stroke="white" strokeWidth="2" />

      {[
        [90, 80],
        [130, 85],
        [75, 115],
        [125, 120],
        [100, 100],
      ].map(([x, y], index) => (
        <circle key={`${x}-${y}-${index}`} cx={x} cy={y} r="2.2" fill={BRAND.nectarine} />
      ))}
    </svg>
  );
}

function AiriaWordmark({
  compact = false,
  align = "left",
}: {
  compact?: boolean;
  align?: "left" | "center";
}) {
  return (
    <div style={{ textAlign: align }}>
      <div
        style={{
          fontFamily: AIRIA_SERIF,
          fontStyle: "italic",
          fontSize: compact ? 24 : 34,
          lineHeight: 1,
          letterSpacing: "0.18em",
          textTransform: "lowercase",
          color: "#B28A7F",
          marginBottom: compact ? 6 : 10,
        }}
      >
        airia
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: compact ? 0 : 2, alignItems: align === "center" ? "center" : "flex-start" }}>
        <span
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: compact ? 18 : 28,
            lineHeight: 1,
            fontWeight: 300,
            letterSpacing: compact ? "0.28em" : "0.36em",
            textTransform: "uppercase",
            color: BRAND.textWarm,
          }}
        >
          Mood
        </span>
        <span
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: compact ? 18 : 28,
            lineHeight: 1,
            fontWeight: 700,
            letterSpacing: compact ? "0.28em" : "0.36em",
            textTransform: "uppercase",
            color: BRAND.nectarine,
          }}
        >
          Energy
        </span>
      </div>
    </div>
  );
}

function SplashSection({
  kicker,
  title,
  subtitle,
  children,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={{ maxWidth: 760 }}>
        <p
          style={{
            margin: "0 0 12px",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          {kicker}
        </p>
        <h2 style={sectionTitleStyle}>{title}</h2>
        {subtitle ? (
          <p
            style={{
              margin: "14px 0 0",
              fontSize: 16,
              lineHeight: 1.75,
              color: "var(--text-2)",
              maxWidth: 680,
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ScreenshotPhone({ shot }: { shot: ScreenshotCard }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: 18,
        borderRadius: 30,
        background: "rgba(255,255,255,.78)",
        border: "1px solid rgba(17,24,39,.06)",
        boxShadow: "0 22px 60px rgba(17,24,39,.08)",
      }}
    >
      <div
        style={{
          borderRadius: 32,
          background: "#171717",
          padding: 10,
          boxShadow: "0 28px 70px rgba(17,24,39,.18)",
        }}
      >
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 24,
            background: "#fff",
            aspectRatio: "9 / 19.5",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "0 auto auto 50%",
              transform: "translateX(-50%)",
              width: 96,
              height: 24,
              borderRadius: "0 0 16px 16px",
              background: "#171717",
              zIndex: 2,
            }}
          />
          <img
            src={shot.src}
            alt={shot.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              background: "linear-gradient(180deg, #FFFFFF 0%, #F7F4F1 100%)",
              transform: shot.imageTransform ?? "none",
              transformOrigin: "top center",
            }}
          />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 18,
            lineHeight: 1.2,
            fontWeight: 700,
            color: "var(--text-1)",
          }}
        >
          {shot.title}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.7,
            color: "var(--text-2)",
          }}
        >
          {shot.description}
        </p>
      </div>
    </div>
  );
}

export function SplashPage() {
  const l = useLocalizedCopy();
  const navigate = useNavigate();
  const localizedAudienceCards = audienceCards.map((card, index) => ({ ...card, title: l(card.title, audienceCardsEn[index].title), description: l(card.description, audienceCardsEn[index].description) }));
  const localizedFlowSteps = flowSteps.map((step, index) => ({ ...step, title: l(step.title, flowStepsEn[index].title), description: l(step.description, flowStepsEn[index].description) }));
  const localizedFeatures = features.map((feature, index) => ({ ...feature, title: l(feature.title, featuresEn[index].title), description: l(feature.description, featuresEn[index].description) }));
  const localizedScreenshots = screenshots.map((shot, index) => ({ ...shot, title: l(shot.title, screenshotsEn[index].title), description: l(shot.description, screenshotsEn[index].description) }));
  const localizedTestimonials = testimonials.map((item, index) => ({ ...item, role: l(item.role, testimonialsEn[index].role), content: l(item.content, testimonialsEn[index].content) }));
  const localizedFaqs = faqs.map((item, index) => ({ question: l(item.question, faqsEn[index].question), answer: l(item.answer, faqsEn[index].answer) }));
  const localizedHeroHighlights = heroHighlights.map((item, index) => l(item, heroHighlightsEn[index]));

  return (
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        overflowX: "hidden",
        background:
          "radial-gradient(circle at top left, rgba(244,168,150,.22), transparent 28%), radial-gradient(circle at 82% 18%, rgba(184,217,200,.24), transparent 24%), radial-gradient(circle at 16% 82%, rgba(212,196,224,.18), transparent 24%), linear-gradient(180deg, #FDF9F5 0%, #FFFDFC 100%)",
      }}
    >
      <div
        style={{
          maxWidth: "100%",
          margin: "0 auto",
          padding: "20px 16px 60px",
          display: "flex",
          flexDirection: "column",
          gap: 52,
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            flexWrap: "wrap",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <AiriaConstellationLogo size={62} hybrid />
            <AiriaWordmark compact />
          </div>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 28,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 28, position: "relative" }}>
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -54%)",
                opacity: 0.13,
                pointerEvents: "none",
                zIndex: -1,
              }}
            >
              <AiriaConstellationLogo size={480} hybrid />
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                width: "fit-content",
                position: "relative",
                zIndex: 1,
                padding: "10px 14px",
                borderRadius: 999,
                background: "rgba(255,255,255,.78)",
                border: "1px solid rgba(17,24,39,.06)",
                color: "var(--text-2)",
                fontSize: 12,
                fontWeight: 700,
                boxShadow: "0 14px 28px rgba(17,24,39,.06)",
              }}
            >
              <Sparkles size={14} color="#B86D4C" />
              {l("BIO-SINCRONIA · NEURODIVERGENTES · IA QUE ACOLHE", "BIO-SYNCHRONY · NEURODIVERGENCE · SUPPORTIVE AI")}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: "clamp(36px, 9vw, 56px)",
                  lineHeight: 0.98,
                  letterSpacing: "-0.05em",
                  color: BRAND.textWarm,
                  fontWeight: 700,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  maxWidth: "100%",
                }}
              >
                  {l("Sincronize seu dia com sua energia real, não com o relógio.", "Sync your day with your real energy, not the clock.")}
              </h1>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 660 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 18,
                    lineHeight: 1.82,
                    color: BRAND.textSoft,
                  }}
                >
                  {l("O tracker de humor e planner adaptativo que entende seu ritmo e prevê quedas de energia antes que você possa desabar.", "The mood tracker and adaptive planner that understands your rhythm and anticipates energy drops before you crash.")}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: "var(--text-3)",
                  }}
                >
                  {l("Gratuito durante o Beta • 100% Privado • Sem cartão de crédito.", "Free during Beta • 100% private • No credit card.")}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => navigate("/login?tab=criar")}
                style={{
                  border: "none",
                  background: BRAND.nectarine,
                  color: "#6A3C28",
                  borderRadius: 22,
                  padding: "20px 40px",
                  fontSize: 18,
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 24px 48px rgba(243,176,140,.32)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  width: "100%",
                  maxWidth: 400,
                }}
              >
                {l("Começar grátis", "Start free")}
                <ArrowRight size={20} />
              </button>
              
              <button
                type="button"
                onClick={() => navigate("/login")}
                style={{
                  border: "none",
                  background: "none",
                  color: BRAND.textSoft,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  textDecoration: "underline",
                  opacity: 0.8,
                }}
              >
                {l("Já tenho conta", "I already have an account")}
              </button>
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                width: "fit-content",
                padding: "9px 12px",
                borderRadius: 999,
                background: "rgba(184,217,200,.26)",
                border: "1px solid rgba(80,112,91,.14)",
                color: "#50705B",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              <Sparkles size={14} color="#50705B" />
              {l("Acesso Beta: Gratuito hoje", "Beta access: Free today")}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 12,
              }}
            >
              {localizedHeroHighlights.map((item) => (
                <div
                  key={item}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: 16,
                    borderRadius: 20,
                    background: "rgba(255,255,255,.72)",
                    border: "1px solid rgba(17,24,39,.06)",
                    boxShadow: "0 16px 32px rgba(107,91,87,.05)",
                  }}
                >
                  <ShieldCheck size={16} color={BRAND.menthe} style={{ marginTop: 2, flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: BRAND.textSoft }}>{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ position: "relative", minHeight: 480, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 8 }}>
            <div
              style={{
                position: "absolute",
                inset: "8% auto auto 6%",
                width: 180,
                height: 180,
                borderRadius: "50%",
                background: "rgba(184,217,200,.46)",
                filter: "blur(24px)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: "auto 4% 10% auto",
                width: 220,
                height: 220,
                borderRadius: "50%",
                background: "rgba(212,196,224,.24)",
                filter: "blur(30px)",
              }}
            />

            <div
              style={{
                width: "min(100%, 430px)",
                padding: 18,
                borderRadius: 36,
                background: "rgba(255,255,255,.68)",
                border: "1px solid rgba(17,24,39,.05)",
                boxShadow: "0 28px 80px rgba(107,91,87,.10)",
                backdropFilter: "blur(16px)",
                position: "relative",
                zIndex: 1,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 14,
                  padding: "0 8px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <AiriaConstellationLogo size={38} hybrid />
                    <div>
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text-3)" }}>
                        Preview
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 700, color: BRAND.textWarm }}>
                        {l("Agenda, check-ins e padrões no mesmo lugar", "Agenda, check-ins, and patterns in one place")}
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    padding: "8px 10px",
                    borderRadius: 999,
                    background: "rgba(244,168,150,.16)",
                    color: "#A45D3D",
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  {l("Ao vivo", "Live")}
                </div>
              </div>

              <div
                style={{
                  borderRadius: 34,
                  background: "#171717",
                  padding: 10,
                  boxShadow: "0 34px 90px rgba(17,24,39,.24)",
                }}
              >
                <div style={{ position: "relative", overflow: "hidden", borderRadius: 26, aspectRatio: "9 / 19.5", background: "#fff" }}>
                  <div
                    style={{
                      position: "absolute",
                      inset: "0 auto auto 50%",
                      transform: "translateX(-50%)",
                      width: 110,
                      height: 26,
                      background: "#171717",
                      borderRadius: "0 0 18px 18px",
                      zIndex: 2,
                    }}
                  />
                  <img
                    src="/screenshots/home-page.png"
                    alt="Mood Energy home"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  position: "absolute",
                  top: 172,
                  right: -20,
                  padding: "10px 13px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,.96)",
                  border: "1px solid rgba(17,24,39,.06)",
                  boxShadow: "0 14px 32px rgba(107,91,87,.10)",
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  maxWidth: 170,
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    background: "rgba(244,168,150,.22)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Waves size={14} color="#B86D4C" />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "var(--text-3)", letterSpacing: ".08em", textTransform: "uppercase" }}>
                    Check-in
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-1)", fontWeight: 700, lineHeight: 1.3 }}>{l("Leitura do dia em poucos toques", "Read your day in a few taps")}</span>
                </div>
              </div>

              <div
                style={{
                  position: "absolute",
                  left: 12,
                  bottom: 42,
                  padding: "10px 13px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,.94)",
                  border: "1px solid rgba(17,24,39,.06)",
                  boxShadow: "0 18px 36px rgba(107,91,87,.08)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  maxWidth: 200,
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 14,
                    background: "rgba(184,217,200,.30)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Sparkles size={16} color="#5A7A64" />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 11, color: "var(--text-3)" }}>{l("Planner adaptativo", "Adaptive planner")}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>{l("Menos atrito, mais clareza", "Less friction, more clarity")}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <SplashSection
          kicker={l("Para quem é", "Who it is for")}
          title={l("Feito para pessoas que sentem o dia mudar por dentro.", "Made for people who feel the day change from within.")}
          subtitle={l("A Airia faz sentido para quem vive oscilações de humor, energia, foco e regulação ao longo do tempo e quer parar de descobrir tudo tarde demais.", "Airia is for people whose mood, energy, focus, and regulation fluctuate over time and who want to stop noticing everything too late.")}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 18,
            }}
          >
            {localizedAudienceCards.map((card) => (
              <article
                key={card.title}
                style={{
                  padding: 24,
                  borderRadius: 28,
                background: "rgba(255,255,255,.74)",
                border: "1px solid rgba(17,24,39,.06)",
                boxShadow: "0 18px 44px rgba(107,91,87,.06)",
                minHeight: 220,
                display: "flex",
                flexDirection: "column",
                  justifyContent: "flex-start",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 18,
                    background: "linear-gradient(135deg, rgba(244,168,150,.22) 0%, rgba(212,196,224,.22) 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Sparkles size={18} color="#B86D4C" />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 22, lineHeight: 1.12, color: BRAND.textWarm }}>{card.title}</h3>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: BRAND.textSoft }}>{card.description}</p>
                </div>
              </article>
            ))}
          </div>
        </SplashSection>

        <SplashSection
          kicker={l("O que dizem", "What people say")}
          title={l("Quem já está usando para entender seus ciclos.", "People already using Airia to understand their cycles.")}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 18,
            }}
          >
            {localizedTestimonials.map((t) => (
              <article
                key={t.name}
                style={{
                  padding: 24,
                  borderRadius: 28,
                  background: "rgba(255,255,255,.86)",
                  border: "1px solid rgba(17,24,39,.06)",
                  boxShadow: "0 18px 44px rgba(107,91,87,.06)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", gap: 4 }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Sparkles key={s} size={14} color="#F4A896" />
                  ))}
                </div>
                <p style={{ margin: 0, fontSize: 16, fontStyle: "italic", lineHeight: 1.6, color: BRAND.textWarm }}>
                  "{t.content}"
                </p>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: BRAND.textWarm }}>{t.name}</span>
                  <span style={{ fontSize: 12, color: BRAND.textSoft }}>{t.role}</span>
                </div>
              </article>
            ))}
          </div>
        </SplashSection>

        <section
          style={{
            padding: "clamp(28px, 4vw, 44px)",
            borderRadius: 32,
            background: "rgba(255,255,255,.86)",
            border: "1px solid rgba(17,24,39,.06)",
            boxShadow: "0 18px 44px rgba(107,91,87,.06)",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: "var(--text-3)",
            }}
          >
            {l("Diferenciais", "What makes Airia different")}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {[l("Tracker genérico", "Generic tracker"), l("Agenda rígida", "Rigid agenda"), l("Métricas vazias", "Empty metrics")].map((label) => (
              <div
                key={label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 16px",
                  borderRadius: 999,
                  background: "rgba(239,68,68,.06)",
                  border: "1px solid rgba(239,68,68,.12)",
                  color: "#A05050",
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "line-through",
                  textDecorationColor: "rgba(160,80,80,.4)",
                }}
              >
                {label}
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
              padding: "18px 24px",
              borderRadius: 20,
              background: "rgba(184,217,200,.12)",
              border: "1px solid rgba(184,217,200,.28)",
            }}
          >
            <Sparkles size={20} color="#5A7A64" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ margin: 0, fontSize: "clamp(17px, 2.2vw, 22px)", fontWeight: 700, color: BRAND.textWarm, lineHeight: 1.3 }}>
                Bio-Sincronia: Onde o plano encontra o corpo.
              </p>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: BRAND.textSoft }}>
                {l("Enquanto outros apps te cobram rotinas que você não consegue cumprir, a Airia recalcula sua carga cognitiva baseada no seu humor e energia real. Menos atrito, mais sustentabilidade.", "While other apps demand routines you cannot sustain, Airia recalculates your cognitive load from your real mood and energy. Less friction, more sustainability.")}
              </p>
            </div>
          </div>
        </section>

        <SplashSection
          kicker={l("Como funciona", "How it works")}
          title={l("Menos surpresa. Mais clareza antes do atrito.", "Fewer surprises. More clarity before friction.")}
          subtitle={l("Tudo começa com uma leitura honesta do agora. Depois, os registros revelam o que se repete. E, com isso, fica muito mais fácil entender quando seguir, quando reduzir e quando se proteger.", "It begins with an honest reading of the present. Records then reveal what repeats, making it easier to know when to move forward, slow down, or protect yourself.")}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 18,
            }}
          >
            {localizedFlowSteps.map((step) => (
              <article
                key={step.eyebrow}
                style={{
                  padding: 24,
                  borderRadius: 28,
                  background: "rgba(255,255,255,.82)",
                  border: "1px solid rgba(17,24,39,.06)",
                  boxShadow: "0 18px 44px rgba(107,91,87,.05)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                }}
              >
                <span
                  style={{
                    width: "fit-content",
                    padding: "8px 12px",
                    borderRadius: 999,
                    background: "rgba(244,168,150,.16)",
                    color: "#9D5C3E",
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: ".12em",
                    textTransform: "uppercase",
                  }}
                >
                  {step.eyebrow}
                </span>
                <h3 style={{ margin: 0, fontSize: 24, lineHeight: 1.08, color: BRAND.textWarm }}>{step.title}</h3>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: BRAND.textSoft }}>{step.description}</p>
              </article>
            ))}
          </div>
        </SplashSection>

        <SplashSection
          kicker={l("Funções", "Features")}
          title={l("O que começa a mudar quando você entende o seu ritmo", "What starts to change when you understand your rhythm")}
          subtitle={l("Menos escuro sobre o que está acontecendo por dentro. Mais clareza para agir melhor, se relacionar melhor e trabalhar melhor.", "Less uncertainty about what is happening inside. More clarity to act, relate, and work better.")}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 18,
            }}
          >
            {localizedFeatures.map((feature) => {
              const Icon = feature.icon;

              return (
                <article
                  key={feature.title}
                  style={{
                  padding: 22,
                  borderRadius: 26,
                  background: "rgba(255,255,255,.74)",
                  border: "1px solid rgba(17,24,39,.06)",
                  boxShadow: "0 18px 44px rgba(107,91,87,.05)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  }}
                >
                  <div
                    style={{
                    width: 46,
                    height: 46,
                    borderRadius: 18,
                    background: "linear-gradient(135deg, rgba(244,168,150,.18), rgba(184,217,200,.18))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    }}
                  >
                    <Icon size={20} color="#6C5D59" />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 18, color: BRAND.textWarm }}>{feature.title}</h3>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.75, color: BRAND.textSoft }}>{feature.description}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </SplashSection>

        <SplashSection
          kicker={l("Dúvidas frequentes", "Frequently asked questions")}
          title={l("Tudo o que você precisa saber para começar.", "Everything you need to know to get started.")}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 18,
            }}
          >
            {localizedFaqs.map((f) => (
              <article
                key={f.question}
                style={{
                  padding: 24,
                  borderRadius: 28,
                  background: "rgba(255,255,255,.82)",
                  border: "1px solid rgba(17,24,39,.06)",
                  boxShadow: "0 18px 44px rgba(107,91,87,.05)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: BRAND.textWarm }}>{f.question}</h3>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: BRAND.textSoft }}>{f.answer}</p>
              </article>
            ))}
          </div>
        </SplashSection>

        <SplashSection
          kicker={l("Veja o app em ação", "See the app in action")}
          title={l("Clareza que aparece na tela e muda o dia", "Clarity on screen that changes your day")}
          subtitle={l("Cada tela existe para te mostrar mais cedo o que está acontecendo por dentro e o que fazer com isso na prática.", "Every screen helps you notice sooner what is happening inside and what to do with it in practice.")}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 22,
            }}
          >
            {localizedScreenshots.map((shot) => (
              <ScreenshotPhone key={shot.title} shot={shot} />
            ))}
          </div>
        </SplashSection>

        <section
          style={{
            padding: "36px clamp(22px, 5vw, 44px)",
            borderRadius: 34,
            background:
              "linear-gradient(135deg, rgba(255,255,255,.9) 0%, rgba(254,243,224,.98) 52%, rgba(240,196,212,.44) 100%)",
            border: "1px solid rgba(17,24,39,.06)",
            boxShadow: "0 24px 56px rgba(107,91,87,.08)",
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 24,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: ".16em",
                textTransform: "uppercase",
                color: "var(--text-3)",
              }}
            >
              {l("Pronto para começar", "Ready to start")}
            </p>
            <h2
              style={{
                margin: 0,
                fontSize: "clamp(28px, 4vw, 46px)",
                lineHeight: 1.02,
                letterSpacing: "-0.05em",
                color: BRAND.textWarm,
                fontWeight: 800,
              }}
            >
              {l("O fim da montanha-russa emocional para quem faz acontecer.", "Step off the emotional roller coaster without giving up your drive.")}
            </h2>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.8, color: BRAND.textSoft, maxWidth: 620 }}>
              {l("A Airia te ajuda a reconhecer padrão, ajustar o dia e decidir o próximo movimento com menos culpa, menos repetição e mais clareza sobre si.", "Airia helps you recognize patterns, adjust your day, and choose the next move with less guilt, less repetition, and more self-clarity.")}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20, alignItems: "center", width: "100%" }}>
            <button
              type="button"
              onClick={() => navigate("/login?tab=criar")}
              style={{
                border: "none",
                background: BRAND.nectarine,
                color: "#6A3C28",
                borderRadius: 22,
                padding: "20px 40px",
                fontSize: 18,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 22px 44px rgba(243,176,140,.28)",
                width: "100%",
                maxWidth: 400,
              }}
            >
              {l("Começar minha leitura de ritmo", "Start my rhythm reading")}
            </button>
            <button
              type="button"
              onClick={() => navigate("/login")}
              style={{
                border: "none",
                background: "none",
                color: BRAND.textSoft,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                textDecoration: "underline",
                opacity: 0.8,
              }}
            >
              {l("Entrar na conta", "Sign in")}
            </button>
          </div>
        </section>

        <footer
          style={{
            marginTop: 40,
            paddingTop: 30,
            borderTop: "1px solid rgba(107,91,87,0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 20
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AiriaConstellationLogo size={32} />
            <span style={{ fontSize: 13, color: BRAND.textSoft, fontWeight: 500 }}>
              &copy; {new Date().getFullYear()} Airia Health. {l("Todos os direitos reservados.", "All rights reserved.")}
            </span>
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            <button 
              onClick={() => navigate("/privacy")}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: BRAND.textSoft, fontWeight: 600 }}
            >
              {l("Política de Privacidade", "Privacy Policy")}
            </button>
            <button 
              onClick={() => navigate("/terms")}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: BRAND.textSoft, fontWeight: 600 }}
            >
              {l("Termos de Uso", "Terms of Use")}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
