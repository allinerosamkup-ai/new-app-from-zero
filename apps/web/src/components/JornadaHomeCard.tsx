import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Compass, ArrowRight } from "lucide-react";
import { api } from "../lib/api";
import { useLocalizedCopy } from "../i18n";

type JornadaData = {
  steps: { n: number; titulo: string }[];
  currentStep: number;
  completed: number[];
};

/**
 * Cartão compacto da Jornada Interior na Home.
 * Auto-busca o progresso; some silenciosamente se a chamada falhar.
 */
export function JornadaHomeCard() {
  const l = useLocalizedCopy();
  const navigate = useNavigate();
  const [data, setData] = useState<JornadaData | null>(null);

  useEffect(() => {
    let alive = true;
    // `api` já prefixa `/api` (lib/api.ts). Com o prefixo escrito de novo aqui
    // a chamada virava `/api/api/jornada` e voltava 404 — e o `.catch` mudo
    // abaixo transformava isso em "o cartão simplesmente não existe na Home".
    (api.get("/jornada") as Promise<JornadaData>)
      .then((d) => { if (alive) setData(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!data || !data.steps?.length) return null;

  const current = data.steps.find((s) => s.n === data.currentStep) ?? data.steps[0];
  const doneCount = data.completed?.length ?? 0;

  return (
    <button
      onClick={() => navigate("/jornada")}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%",
        padding: "14px 16px", marginBottom: "calc(var(--a) * 1.1)",
        borderRadius: 18, border: "1.5px solid rgba(150,199,179,0.28)",
        background: "rgba(150,199,179,0.07)", cursor: "pointer", textAlign: "left",
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(150,199,179,0.16)",
      }}>
        <Compass size={18} color="var(--accent-sage)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--accent-sage)" }}>
          {l("Sua Jornada", "Your Journey")} · {doneCount}/13
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 13.5, fontWeight: 800, color: "var(--text-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {l("Passo", "Step")} {current.n}: {current.titulo}
        </p>
      </div>
      <ArrowRight size={18} color="var(--accent-sage)" style={{ flexShrink: 0 }} />
    </button>
  );
}
