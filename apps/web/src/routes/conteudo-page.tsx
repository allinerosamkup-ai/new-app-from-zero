/**
 * Conteúdo — Biblioteca de mini-conteúdo estático
 * Cartões educativos sobre TDAH, bipolar II, ciclotimia e produtividade cíclica.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, X } from "lucide-react";
import "../styles/aura.css";

type ContentCard = {
  id: string;
  title: string;
  emoji: string;
  category: "tdah" | "bipolar" | "ciclotimia" | "produtividade";
  summary: string;
  body: string;
};

const CARDS: ContentCard[] = [
  {
    id: "tdah-energia",
    title: "TDAH e oscilação de energia",
    emoji: "⚡",
    category: "tdah",
    summary: "Por que energia muda em horas, não em dias — e como aproveitar isso.",
    body: `O TDAH adulto não é só dificuldade de foco. É uma regulação inconsistente de energia — momentos de hiperfoco intenso alternados com paralisia, mesmo quando a tarefa importa.

**O que acontece no ciclo**
Energia pode mudar em horas, não em dias. A "preguiça" muitas vezes é exaustão neurológica real. Hiperfoco é um estado fisiológico, não falta de disciplina.

**O que ajuda**
- Aproveitar janelas de foco quando aparecem, sem culpa por precisar parar depois
- Tarefas pesadas no início do dia ou nos primeiros 20 minutos de energia boa
- Pausas curtas e frequentes mantêm mais do que sessões longas forçadas

**Na Airia**
Quando seu ciclo mostra hiperfoco, a Airia não empilha tarefas novas. Ela sugere usar o estado no que já está em andamento — protegendo a janela real de entrega.`,
  },
  {
    id: "hiperfoco-recurso",
    title: "Hiperfoco como recurso",
    emoji: "🔬",
    category: "tdah",
    summary: "Como reconhecer, usar e sair do hiperfoco com inteligência.",
    body: `Hiperfoco não é concentração normal elevada. É um estado neurológico de absorção total — onde fome, cansaço e tempo deixam de existir temporariamente.

**Por que acontece no TDAH**
O TDAH tem déficit de dopamina basal. Quando uma tarefa ativa o sistema de recompensa fortemente, o cérebro "trava" nela para manter o nível dopaminérgico.

**Como usar com inteligência**
1. Reconhecer o estado antes de embarcar em algo novo
2. Definir um ponto de parada antes de começar — "paro quando chegar em X"
3. Usar o hiperfoco no que já está em andamento, não abrindo nova frente
4. Comer e beber antes de mergulhar — o corpo vai ser ignorado

**Na Airia**
Quando você marca hiperfoco no check-in, a Airia não sugere nada novo. Ela mostra o que está em andamento e propõe uma saída com limite.`,
  },
  {
    id: "regulacao-emocional-tdah",
    title: "Regulação emocional no TDAH",
    emoji: "🌊",
    category: "tdah",
    summary: "Reações intensas não são falta de maturidade — têm base neurológica.",
    body: `O TDAH é frequentemente descrito como déficit de atenção. Mas uma das características mais impactantes é a disregulação emocional — reações intensas, rápidas e difíceis de modular.

**Como se manifesta**
- Frustração que escala rápido diante de obstáculos pequenos
- Excitação intensa que some tão rápido quanto veio
- Dificuldade de sair de um estado ruim mesmo quando a situação mudou
- Sensibilidade intensa a críticas e rejeição

**Estratégias que funcionam**
- Nomear o estado em tempo real: "Estou em sobrecarga agora" — não julgamento, só dado
- Pausa ativa antes de responder em situações de alta frustração
- Reduzir estímulo antes de tentar regular — menos tela, menos ruído
- Movimento curto (5-10 min de caminhada) é regulador eficiente

**Na Airia**
Quando check-in mostra irritabilidade alta, a Airia adapta o tom e reduz o peso operacional das sugestões.`,
  },
  {
    id: "bipolar-ii-ciclos",
    title: "Bipolar II e ciclos longos",
    emoji: "🌙",
    category: "bipolar",
    summary: "Ciclos de dias a semanas — como reconhecer sem dramatizar.",
    body: `Bipolar II não é "bipolar leve". É uma condição com ciclos de dias a semanas — hipomanias sutis que parecem produtividade normal, seguidas de baixas que parecem preguiça.

**O que diferencia do bipolar I**
- Episódios hipomaníacos sem surtos psicóticos
- As baixas (depressão) costumam ser mais longas e frequentes que as altas
- A hipomania pode parecer ótima — até virar exaustão de repente

**Reconhecendo os padrões**
Alta: sono reduzido sem cansaço, muita produtividade, otimismo exagerado, decisões impulsivas.
Baixa: lentidão cognitiva, dificuldade de iniciar, sensação de vazio mesmo sem evento claro.

**Na Airia**
A Airia registra seu ciclo ao longo do tempo. Quando detecta 3+ dias elevados, o alerta aparece antes da queda — para você usar a alta com inteligência, não até o fundo.`,
  },
  {
    id: "ciclotimia-explicada",
    title: "Ciclotimia explicada",
    emoji: "〰️",
    category: "ciclotimia",
    summary: "Oscilações mais frequentes e menos intensas — mas que afetam tudo.",
    body: `Ciclotimia é um padrão de oscilações de humor mais frequentes e menos intensas que o bipolar II — mas que afetam a rotina de forma significativa.

**Como se sente**
- Dias bons e dias ruins sem causa aparente
- Dificuldade de planejar porque o estado muda antes de executar
- Sensação de inconsistência — "por que ontem eu consegui e hoje não?"

**Como viver com ciclos curtos**
- Ancorar tarefas importantes em dias de alta, não em datas fixas
- Ter um "cardápio de dias ruins" — lista de tarefas possíveis em baixa capacidade
- Não julgar o estado atual como permanente

**Na Airia**
A Airia lê tendência de 7 dias, não só ontem. Quando detecta oscilação frequente, adapta as sugestões para o estado real — não para o estado médio.`,
  },
  {
    id: "dia-ruim-nao-e-fracasso",
    title: "Dia ruim não é fracasso",
    emoji: "🌧️",
    category: "produtividade",
    summary: "Por que tratar baixa como falha aumenta a carga sem mudar o ciclo.",
    body: `Para mentes que ciclam, dias de baixa capacidade não são exceção — são parte do padrão. Tratar cada um como falha pessoal aumenta a carga sem mudar o ciclo.

**O problema com a narrativa de "fui fraco"**
- Cria dívida emocional que torna o próximo dia ainda mais pesado
- Gera compensação excessiva nos dias bons, acelerando a queda
- Desconecta a pessoa do sinal real: o ciclo precisa de resposta, não de julgamento

**O que dia ruim comunica**
- Carga acumulada acima da capacidade do momento
- Necessidade de recuperação ativa
- Janela para tarefas mínimas — não para produtividade normal

**Reframing útil**
Em vez de "não consegui nada": "Meu sistema pediu pausa. Dei." Isso não é rendição — é gestão inteligente de um recurso limitado.`,
  },
  {
    id: "gerenciar-energia",
    title: "Gerenciar energia, não tempo",
    emoji: "🔋",
    category: "produtividade",
    summary: "A alternativa às agendas fixas para mentes com ciclos.",
    body: `O modelo tradicional de produtividade parte do pressuposto que todos têm a mesma capacidade ao longo do dia. Para mentes que ciclam, isso é uma armadilha.

**A alternativa: gestão por energia**
Em vez de "o que preciso fazer hoje", a pergunta é: "qual é minha capacidade agora e o que cabe nela?"

**Níveis de capacidade**
- Alta: tarefas pesadas, foco profundo, decisões importantes
- Média: tarefas moderadas, reuniões, revisões
- Baixa: manutenção, tarefas automáticas, descanso ativo
- Recolhimento: só o essencial; preservar para amanhã

**Como aplicar**
1. Verificar o estado antes de planejar
2. Ter listas separadas por nível de energia
3. Aceitar que dias de baixa são parte da semana, não falha

**Na Airia**
A Airia lê sua fase de ciclo e sugere o tipo de tarefa que combina com o estado atual.`,
  },
  {
    id: "sono-humor",
    title: "Sono e ciclagem de humor",
    emoji: "😴",
    category: "produtividade",
    summary: "A relação bidirecional entre sono e oscilações de humor.",
    body: `Sono e humor são bidirecionais — humor ruim piora o sono, sono ruim piora o humor. Para quem tem ciclos, essa relação é ainda mais intensa.

**Por que sono importa mais para mentes que ciclam**
- Privação de sono pode desencadear episódios hipomaníacos no bipolar II
- No TDAH, sono ruim amplifica impulsividade e disregulação emocional
- Na ciclotimia, padrão irregular de sono acelera oscilações

**O que realmente ajuda**
- Horário fixo de acordar — âncora circadiana mais eficiente que hora de dormir
- Exposição a luz natural nos primeiros 30 minutos
- Tela fora 40 min antes de dormir — não 10, 40

**Na Airia**
A Airia usa seu sono reportado no check-in para ajustar a leitura do ciclo e as sugestões do dia. Sono ruim reduz a carga operacional automaticamente.`,
  },
  {
    id: "ciclos-produtividade",
    title: "Ciclos de produtividade",
    emoji: "🌀",
    category: "produtividade",
    summary: "Produtividade em ondas — usando o ciclo completo, não só os picos.",
    body: `Produtividade não é linear. Para mentes que ciclam, funciona em ondas — picos de entrega seguidos de períodos de recuperação que são tão necessários quanto os picos.

**Usando o ciclo a favor**

Durante a alta: fazer tarefas de maior impacto, tomar decisões importantes, criar sistemas.

Durante a baixa: tarefas de manutenção e rotina, revisar o que foi produzido na alta.

Durante a recuperação: introduzir gradualmente tarefas moderadas, não forçar o ritmo da alta ainda.

**A armadilha da comparação**
Comparar sua produção de uma baixa com a de outra pessoa em alta é uma distorção. A unidade certa de comparação é o seu próprio ciclo completo.

**O erro mais comum**
Pular a recuperação para manter a entrega. O resultado é um pico menor na próxima onda e uma baixa mais longa.`,
  },
  {
    id: "quando-parar-e-avancar",
    title: "Quando parar é avançar",
    emoji: "🛑",
    category: "produtividade",
    summary: "Parar na hora certa é o que permite o próximo avanço.",
    body: `Parar não é o oposto de progredir. Para um sistema que trabalha em ciclos, parar na hora certa é o que permite o próximo avanço.

**O custo de não parar**
- Continuar além da janela de energia real gera erros que custam mais tempo depois
- Forçar em baixa cria resistência ao trabalho
- Recuperação forçada (colapso involuntário) é mais longa que pausa consciente

**Como reconhecer a hora certa**
- A mesma frase lida três vezes sem entender
- Erros simples que não são do seu nível
- Irritação crescente com o próprio processo
- Sensação de estar "empurrando contra"

**A diferença entre pausa e evitação**
Pausa: saiu com o trabalho em estado definido, com horário para voltar.
Evitação: saiu sem fechar onde está, sem intenção de voltar logo, com culpa.

A distinção não é o tempo — é a consciência da ação.`,
  },
];

const CATEGORY_LABELS: Record<ContentCard["category"], string> = {
  tdah: "TDAH",
  bipolar: "Bipolar II",
  ciclotimia: "Ciclotimia",
  produtividade: "Produtividade",
};

const CATEGORY_COLORS: Record<ContentCard["category"], string> = {
  tdah: "var(--lagune, #6398A9)",
  bipolar: "var(--menthe, #96C7B3)",
  ciclotimia: "var(--nectarine, #D7897F)",
  produtividade: "#9B8EBF",
};

function renderBody(body: string): string[] {
  return body.split("\n\n").filter(Boolean);
}

function CardDetail({ card, onClose }: { card: ContentCard; onClose: () => void }) {
  const paragraphs = renderBody(card.body);
  const accentColor = CATEGORY_COLORS[card.category];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--warm-bg, #FAFAF7)",
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxWidth: 480,
          maxHeight: "88vh",
          overflowY: "auto",
          padding: "24px 20px 48px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: accentColor,
              }}
            >
              {CATEGORY_LABELS[card.category]}
            </span>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--text-primary, #1a1a1a)", lineHeight: 1.3 }}>
              {card.emoji} {card.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              color: "var(--text-muted, #888)",
              flexShrink: 0,
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {paragraphs.map((paragraph, i) => {
            const isHeading = paragraph.startsWith("**") && paragraph.endsWith("**");
            if (isHeading) {
              return (
                <h3
                  key={i}
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--text-primary, #1a1a1a)",
                    borderLeft: `3px solid ${accentColor}`,
                    paddingLeft: 10,
                  }}
                >
                  {paragraph.slice(2, -2)}
                </h3>
              );
            }

            // Render list items
            if (paragraph.includes("\n-")) {
              const [intro, ...items] = paragraph.split("\n-");
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {intro && (
                    <p style={{ margin: 0, fontSize: 15, color: "var(--text-primary, #1a1a1a)", lineHeight: 1.6 }}>
                      {renderInline(intro)}
                    </p>
                  )}
                  <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
                    {items.map((item, j) => (
                      <li key={j} style={{ fontSize: 15, color: "var(--text-primary, #1a1a1a)", lineHeight: 1.6 }}>
                        {renderInline(item.trim())}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }

            return (
              <p key={i} style={{ margin: 0, fontSize: 15, color: "var(--text-primary, #1a1a1a)", lineHeight: 1.7 }}>
                {renderInline(paragraph)}
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

type FilterCategory = ContentCard["category"] | "all";

export function ConteudoPage() {
  const navigate = useNavigate();
  const [selectedCard, setSelectedCard] = useState<ContentCard | null>(null);
  const [filter, setFilter] = useState<FilterCategory>("all");

  const filtered = filter === "all" ? CARDS : CARDS.filter((c) => c.category === filter);

  const categories: FilterCategory[] = ["all", "tdah", "bipolar", "ciclotimia", "produtividade"];
  const categoryLabels: Record<FilterCategory, string> = {
    all: "Todos",
    ...CATEGORY_LABELS,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--warm-bg, #FAFAF7)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px 12px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: "1px solid var(--border-subtle, #E8E4DF)",
          background: "var(--warm-bg, #FAFAF7)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            color: "var(--text-muted, #888)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BookOpen size={18} style={{ color: "var(--nectarine, #D7897F)" }} />
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text-primary, #1a1a1a)" }}>
            Biblioteca
          </h1>
        </div>
      </div>

      {/* Filter chips */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "14px 20px",
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
      >
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: "1.5px solid",
              borderColor: filter === cat ? CATEGORY_COLORS[cat as ContentCard["category"]] ?? "var(--nectarine, #D7897F)" : "var(--border-subtle, #E8E4DF)",
              background: filter === cat ? (CATEGORY_COLORS[cat as ContentCard["category"]] ?? "var(--nectarine, #D7897F)") + "18" : "transparent",
              color: filter === cat ? (CATEGORY_COLORS[cat as ContentCard["category"]] ?? "var(--nectarine, #D7897F)") : "var(--text-muted, #888)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {categoryLabels[cat]}
          </button>
        ))}
      </div>

      {/* Cards grid */}
      <div
        style={{
          padding: "0 20px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {filtered.map((card) => (
          <button
            key={card.id}
            onClick={() => setSelectedCard(card)}
            style={{
              background: "#fff",
              border: "1px solid var(--border-subtle, #E8E4DF)",
              borderRadius: 14,
              padding: "16px",
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              transition: "box-shadow 0.15s",
            }}
          >
            <span style={{ fontSize: 28, flexShrink: 0, lineHeight: 1 }}>{card.emoji}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: CATEGORY_COLORS[card.category],
                  }}
                >
                  {CATEGORY_LABELS[card.category]}
                </span>
              </div>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--text-primary, #1a1a1a)",
                  lineHeight: 1.3,
                }}
              >
                {card.title}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: "var(--text-muted, #888)",
                  lineHeight: 1.5,
                }}
              >
                {card.summary}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Detail sheet */}
      {selectedCard && (
        <CardDetail card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  );
}
