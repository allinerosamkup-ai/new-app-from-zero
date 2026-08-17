import { useState } from "react";

import { useLocalizedCopy } from "../../i18n";
import { correctAiriaCapacity, type AiriaCapacity, type AiriaReadingEnvelope } from "../../lib/airia-reading";
import { tapHaptic } from "../../utils/haptics";

/**
 * A frase que diz quanto cabe hoje — e os dois toques que corrigem.
 *
 * Esta tela já perguntou isso. "Hoje você lida melhor com algo: Rápido /
 * Moderado / Mais trabalhoso" saiu do produto porque obrigava a pessoa a
 * classificar a própria capacidade justamente no dia em que classificar é
 * caro. O que entra no lugar não é o silêncio: é a Airia dizendo o que
 * concluiu, com o número na frente, e devolvendo a correção em um toque.
 *
 * Por que uma frase e não um número: "energia 3/10" é dado, "propus algo de 10
 * minutos porque você dormiu 5h" é uma decisão explicada. A segunda pode ser
 * contestada por quem lê; a primeira só pode ser aceita.
 *
 * Os dois chips não são uma pergunta disfarçada. A diferença está em quem
 * decide primeiro: aqui a Airia já decidiu e assumiu o custo de errar — quem
 * não quiser mexer, não mexe, e o dia segue com a proposta dela.
 */
export function CapacityNote({
  capacity,
  decisionId,
  surface,
  onCorrected,
}: {
  capacity?: AiriaCapacity | null;
  decisionId?: string | null;
  surface: "home" | "checkin_result" | "daily_summary";
  onCorrected?: (reading: AiriaReadingEnvelope) => void;
}) {
  const l = useLocalizedCopy();
  const [pending, setPending] = useState<"mais" | "menos" | null>(null);
  const [done, setDone] = useState<"mais" | "menos" | null>(null);
  const [failed, setFailed] = useState(false);

  // Sem leitura de capacidade não há frase honesta a mostrar. Texto genérico
  // aqui seria pior que silêncio: fingiria uma conclusão que não existe.
  if (!capacity) return null;

  // Quando não houve sinal nenhum, a Airia não concluiu nada — dizer "mantive
  // um tamanho moderado" sem base é enfeite, e enfeite gasta a confiança que a
  // frase existe para construir.
  if (capacity.assumed) return null;

  async function correct(direction: "mais" | "menos") {
    if (!decisionId || pending) return;
    tapHaptic();
    setPending(direction);
    setFailed(false);
    const next = await correctAiriaCapacity(decisionId, direction, surface);
    if (next) {
      setDone(direction);
      onCorrected?.(next);
    } else {
      setFailed(true);
    }
    setPending(null);
  }

  return (
    <section
      aria-live="polite"
      style={{
        padding: 14,
        borderRadius: 14,
        marginBottom: 12,
        background: "rgba(255,253,250,.9)",
        border: "1.5px solid rgba(143,192,164,.3)",
      }}
    >
      <p
        style={{
          margin: "0 0 6px",
          fontSize: 10,
          fontWeight: 800,
          color: "var(--accent-primary-ink)",
          textTransform: "uppercase",
          letterSpacing: ".12em",
        }}
      >
        {l("O que cabe hoje", "What fits today")}
      </p>

      <p style={{ margin: 0, fontSize: 13, color: "var(--text-1)", lineHeight: 1.5, fontWeight: 600 }}>
        {capacity.reason}
      </p>

      <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--text-3)", lineHeight: 1.45 }}>
        {l("Eu concluí isso — você não precisou escolher.", "I worked this out — you didn't have to choose.")}
      </p>

      {done ? (
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--accent-primary-ink)", fontWeight: 700 }}>
          {done === "mais"
            ? l("Ajustei para cima. Obrigada por me corrigir.", "Adjusted upward. Thanks for correcting me.")
            : l("Ajustei para baixo. Obrigada por me corrigir.", "Adjusted downward. Thanks for correcting me.")}
        </p>
      ) : decisionId ? (
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => void correct("menos")}
            style={chipStyle}
          >
            {pending === "menos" ? l("Ajustando…", "Adjusting…") : l("Coube menos que isso", "Less than that fit")}
          </button>
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => void correct("mais")}
            style={chipStyle}
          >
            {pending === "mais" ? l("Ajustando…", "Adjusting…") : l("Coube mais que isso", "More than that fit")}
          </button>
        </div>
      ) : null}

      {failed && (
        <p role="alert" style={{ margin: "8px 0 0", fontSize: 11, color: "#A24B43" }}>
          {l("Não consegui ajustar agora. A leitura continua a mesma.", "I couldn't adjust right now. The reading is unchanged.")}
        </p>
      )}
    </section>
  );
}

const chipStyle: React.CSSProperties = {
  flex: "1 1 auto",
  minHeight: 40,
  padding: "9px 12px",
  borderRadius: 12,
  border: "1.5px solid var(--warm-border-2)",
  background: "rgba(255,255,255,.7)",
  color: "var(--text-2)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};
