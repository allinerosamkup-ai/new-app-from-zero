import { ArrowRight, BrainCircuit, CalendarRange, HeartHandshake, ShieldCheck, Sparkles, Waves, type LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useNavigate } from "react-router-dom";

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
    title: "Para quem percebe tarde demais que saiu do eixo",
    description:
      "Humor, energia, foco e sobrecarga não aparecem em linha reta. A Airia ajuda a notar sinais de queda, aceleração e desgaste antes que isso vire resposta atravessada, promessa demais ou sumiço de si.",
  },
  {
    title: "Para quem quer entender o próprio ciclo sem se julgar",
    description:
      "Com o histórico dos check-ins, fica mais fácil reconhecer padrões: dias em que tudo pesa, dias em que a energia sobe demais e dias em que o corpo pede freio, silêncio e proteção.",
  },
  {
    title: "Para quem quer melhorar a vida prática",
    description:
      "Quando o ritmo interno fica mais claro, também fica mais simples proteger relações, organizar o trabalho, respeitar limites e aproveitar melhor os dias bons.",
  },
];

const flowSteps: StepCard[] = [
  {
    eyebrow: "01",
    title: "Perceba o dia antes do dia te levar",
    description:
      "Check-ins rápidos capturam humor, energia e sinais do corpo sem exigir esforço demais, justamente para caber também nos dias mais confusos.",
  },
  {
    eyebrow: "02",
    title: "Veja o padrão se formando",
    description:
      "A Airia cruza seus registros ao longo do tempo para mostrar gatilhos, repetições, dias de baixa, dias de aceleração e janelas em que tudo costuma funcionar melhor.",
  },
  {
    eyebrow: "03",
    title: "Escolha melhor antes do atrito",
    description:
      "Em vez de reagir no susto, você passa a entender se hoje é dia de avançar, recuar, proteger energia, evitar conflito ou aproveitar uma janela boa de foco.",
  },
];

const features: FeatureCard[] = [
  {
    icon: Waves,
    title: "Check-ins de humor e energia",
    description:
      "Em poucos toques, você entende se o dia está estável, sensível, acelerado ou pedindo mais proteção.",
  },
  {
    icon: CalendarRange,
    title: "Planner adaptativo",
    description:
      "A rotina deixa de tratar todo dia como igual. Isso ajuda a respeitar limite real e usar melhor os dias em que a energia está boa.",
  },
  {
    icon: BrainCircuit,
    title: "Insights que fazem sentido",
    description:
      "Os padrões ficam mais visíveis: baixa sustentada, aceleração, estabilidade, gatilhos recorrentes e mudanças que antes passavam batido.",
  },
  {
    icon: HeartHandshake,
    title: "Aura como camada de apoio",
    description:
      "A leitura interna vira atitude concreta: conversar melhor, recuar a tempo, reorganizar o dia, descansar ou focar com mais intenção.",
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
    description: "Visualizações para perceber ciclos, quedas, estabilidade e sinais recorrentes.",
    src: "/screenshots/insights-page.png",
  },
  {
    title: "Aura como apoio prático",
    description: "Uma conversa que ajuda a organizar o dia, destravar prioridades e transformar contexto em ação.",
    src: "/screenshots/aura-page.png",
  },
];

const heroHighlights = [
  "Perceba mais cedo quando o dia pede proteção",
  "Reconheça padrões antes que eles virem conflito",
  "Use os dias bons com mais intenção e menos excesso",
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
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(244,168,150,.22), transparent 28%), radial-gradient(circle at 82% 18%, rgba(184,217,200,.24), transparent 24%), radial-gradient(circle at 16% 82%, rgba(212,196,224,.18), transparent 24%), linear-gradient(180deg, #FDF9F5 0%, #FFFDFC 100%)",
      }}
    >
      <div
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          padding: "28px 20px 80px",
          display: "flex",
          flexDirection: "column",
          gap: 88,
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 18,
                background: "rgba(255,255,255,.78)",
                border: "1px solid rgba(255,255,255,.72)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 18px 34px rgba(107,91,87,.10)",
                overflow: "hidden",
              }}
            >
              <AiriaConstellationLogo size={54} />
            </div>
            <AiriaWordmark compact />
          </div>

          <button
            type="button"
            onClick={() => navigate("/login")}
            style={{
              border: "1px solid rgba(17,24,39,.08)",
              background: "rgba(255,255,255,.78)",
              color: BRAND.textWarm,
              borderRadius: 999,
              padding: "12px 18px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              backdropFilter: "blur(14px)",
              boxShadow: "0 14px 28px rgba(17,24,39,.06)",
            }}
          >
            Já tenho conta
          </button>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 36,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                width: "fit-content",
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
              Quando o humor muda, a vida sente junto
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <AiriaWordmark />
              <h1
                style={{
                  margin: 0,
                  fontSize: "clamp(42px, 7vw, 84px)",
                  lineHeight: 0.94,
                  letterSpacing: "-0.06em",
                  color: BRAND.textWarm,
                  fontWeight: 700,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  maxWidth: 720,
                }}
              >
                  Seu dia não precisa depender da sorte.
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
                  Tem dia em que tudo encaixa. Tem dia em que qualquer conversa pesa. E tem dia em que a energia sobe
                  tanto que parece que vai dar para abraçar o mundo inteiro, até passar do ponto. A Airia te ajuda a
                  perceber isso antes.
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 17,
                    lineHeight: 1.82,
                    color: BRAND.textSoft,
                  }}
                >
                  Com o tempo, fica mais fácil identificar padrões, entender se hoje é um bom dia ou um dia de
                  proteção, evitar decisões no impulso e cuidar melhor do trabalho, das relações e de si.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <button
                type="button"
                onClick={() => navigate("/login?tab=criar")}
                style={{
                  border: "none",
                  background: BRAND.nectarine,
                  color: "#6A3C28",
                  borderRadius: 18,
                  padding: "16px 22px",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 20px 34px rgba(243,176,140,.24)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                Criar minha conta
                <ArrowRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => navigate("/login")}
                style={{
                  border: "1px solid rgba(17,24,39,.08)",
                  background: "rgba(255,255,255,.82)",
                  color: BRAND.textWarm,
                  borderRadius: 18,
                  padding: "16px 22px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  backdropFilter: "blur(14px)",
                }}
              >
                Entrar na Airia
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              {heroHighlights.map((item) => (
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

          <div style={{ position: "relative", minHeight: 620, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                        Agenda, check-ins e padrões no mesmo lugar
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
                  Ao vivo
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
                    src="/screenshots/planner-page.png"
                    alt="Mood Energy planner"
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
                  top: 76,
                  right: -10,
                  padding: "12px 14px",
                  borderRadius: 18,
                  background: "rgba(255,255,255,.92)",
                  border: "1px solid rgba(17,24,39,.06)",
                  boxShadow: "0 18px 36px rgba(107,91,87,.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-3)", letterSpacing: ".08em", textTransform: "uppercase" }}>
                  Check-in
                </span>
                <span style={{ fontSize: 13, color: "var(--text-1)", fontWeight: 700 }}>Leitura do dia em poucos toques</span>
              </div>

              <div
                style={{
                  position: "absolute",
                  left: -14,
                  bottom: 42,
                  padding: "12px 14px",
                  borderRadius: 18,
                  background: "rgba(255,255,255,.94)",
                  border: "1px solid rgba(17,24,39,.06)",
                  boxShadow: "0 18px 36px rgba(107,91,87,.08)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
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
                  <span style={{ fontSize: 11, color: "var(--text-3)" }}>Planner adaptativo</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>Menos atrito, mais clareza</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <SplashSection
          kicker="Para quem é"
          title="Feito para pessoas que sentem o dia mudar por dentro."
          subtitle="A Airia faz sentido para quem vive oscilações de humor, energia, foco e regulação ao longo do tempo e quer parar de descobrir tudo tarde demais."
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 18,
            }}
          >
            {audienceCards.map((card) => (
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
                  justifyContent: "space-between",
                  gap: 24,
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
          kicker="Como funciona"
          title="Menos suposição. Mais leitura real do seu ritmo."
          subtitle="Tudo começa com uma leitura honesta do agora. Depois, os registros revelam o que se repete. E, com isso, fica muito mais fácil entender quando seguir, quando reduzir e quando se proteger."
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 18,
            }}
          >
            {flowSteps.map((step) => (
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
          kicker="Funções"
          title="O que começa a mudar quando você entende o seu ritmo"
          subtitle="Menos escuro sobre o que está acontecendo por dentro. Mais clareza para agir melhor, se relacionar melhor e trabalhar melhor."
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 18,
            }}
          >
            {features.map((feature) => {
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
          kicker="Veja o app em ação"
          title="Clareza que aparece na tela e muda o dia"
          subtitle="Cada tela existe para te mostrar mais cedo o que está acontecendo por dentro e o que fazer com isso na prática."
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: 22,
            }}
          >
            {screenshots.map((shot) => (
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
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
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
              Pronto para começar
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
              Quanto mais cedo você entende o seu ciclo, menos ele te pega no susto.
            </h2>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.8, color: BRAND.textSoft, maxWidth: 620 }}>
              A Airia te ajuda a reconhecer padrão, ajustar o dia e viver com menos culpa, menos conflito e mais
              clareza sobre si.
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "flex-start" }}>
            <button
              type="button"
              onClick={() => navigate("/login?tab=criar")}
              style={{
                border: "none",
                background: BRAND.nectarine,
                color: "#6A3C28",
                borderRadius: 18,
                padding: "16px 22px",
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 22px 34px rgba(243,176,140,.24)",
              }}
            >
              Criar minha conta
            </button>
            <button
              type="button"
              onClick={() => navigate("/login")}
              style={{
                border: "1px solid rgba(17,24,39,.08)",
                background: "rgba(255,255,255,.86)",
                color: BRAND.textWarm,
                borderRadius: 18,
                padding: "16px 22px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Entrar na Airia
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
