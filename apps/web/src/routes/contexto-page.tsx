import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Trash2, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useToast } from "../components/Toast";
import { api } from "../lib/api";
import { useLocalizedCopy } from "../i18n";
import { SafetyProtocolCard } from "../components/aura/SafetyProtocolCard";
import { useAiriaReading } from "../lib/airia-reading";
import "../styles/aura.css";
import "../styles/editorial.css";

type UserEntity = {
  id: string;
  canonicalName: string;
  aliases: string[];
  type: string;
  status: string | null;
  firstMentionAt: string;
  lastMentionAt: string;
};

type UserFact = {
  id: string;
  statement: string;
  source: string;
  occurredAt: string;
  confidence: number;
  entity?: { canonicalName: string } | null;
};

type UserPattern = {
  id: string;
  pattern: string;
  strength: number;
  lastConfirmedAt: string;
};

type UserOpenDecision = {
  id: string;
  question: string;
  context: string | null;
  raisedAt: string;
  resolvedAt: string | null;
  resolution: string | null;
};

type KGStatus = {
  journalMessagesTotal: number;
  journalSessionsTotal: number;
  checkinsWithNoteTotal: number;
  entitiesInGraph: number;
  factsInGraph: number;
  patternsInGraph: number;
  openDecisionsInGraph: number;
  lastBackfillAt: string | null;
};

type Tab = "entidades" | "fatos" | "padroes" | "decisoes";

function relativeDays(dateString: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 86400000));
  if (days === 0) return "hoje";
  if (days === 1) return "1 dia atrás";
  return `${days} dias atrás`;
}

export function ContextoPage() {
  const l = useLocalizedCopy();
  const navigate = useNavigate();
  const { showError, showSuccess } = useToast();
  const { reading } = useAiriaReading();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<KGStatus | null>(null);
  const [entities, setEntities] = useState<UserEntity[]>([]);
  const [facts, setFacts] = useState<UserFact[]>([]);
  const [patterns, setPatterns] = useState<UserPattern[]>([]);
  const [decisions, setDecisions] = useState<UserOpenDecision[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("entidades");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, graphRes] = await Promise.all([
        api.get("/me/knowledge-graph/status").catch(() => null),
        api.get("/me/knowledge-graph").catch(() => null),
      ]);
      if (statusRes) setStatus(statusRes as KGStatus);
      if (graphRes && typeof graphRes === "object") {
        const g = graphRes as { entities?: UserEntity[]; facts?: UserFact[]; patterns?: UserPattern[]; decisions?: UserOpenDecision[] };
        setEntities(g.entities ?? []);
        setFacts(g.facts ?? []);
        setPatterns(g.patterns ?? []);
        setDecisions(g.decisions ?? []);
      }
    } catch (error) {
      console.error("[contexto] failed to load", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function deleteEntity(id: string) {
    if (!confirm("Apagar essa entidade do contexto da Airia?")) return;
    try {
      await api.delete(`/me/knowledge-graph/entity/${id}`);
      setEntities((prev) => prev.filter((e) => e.id !== id));
    } catch {
      showError("Falha ao apagar entidade.");
    }
  }

  async function deleteFact(id: string) {
    if (!confirm("Apagar esse fato?")) return;
    try {
      await api.delete(`/me/knowledge-graph/fact/${id}`);
      setFacts((prev) => prev.filter((f) => f.id !== id));
    } catch {
      showError("Falha ao apagar fato.");
    }
  }

  async function deletePattern(id: string) {
    if (!confirm(l("Apagar esse padrão observado?", "Delete this observed pattern?"))) return;
    try {
      await api.delete(`/me/knowledge-graph/pattern/${id}`);
      setPatterns((prev) => prev.filter((p) => p.id !== id));
    } catch {
      showError(l("Falha ao apagar padrão.", "Failed to delete pattern."));
    }
  }

  async function resolveDecision(id: string) {
    const resolution = prompt(l("Como você resolveu essa decisão? (opcional)", "How did you resolve this decision? (optional)")) ?? undefined;
    try {
      await api.post(`/me/knowledge-graph/decision/${id}/resolve`, { resolution });
      setDecisions((prev) => prev.map((d) => (d.id === id ? { ...d, resolvedAt: new Date().toISOString(), resolution: resolution ?? null } : d)));
      showSuccess(l("Decisão marcada como resolvida.", "Decision marked as resolved."));
    } catch {
      showError(l("Falha ao marcar decisão.", "Failed to resolve decision."));
    }
  }

  return (
    <div style={{ padding: "13px 13px 100px", maxWidth: 720, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <button onClick={() => navigate(-1)} style={{ border: "none", background: "transparent", display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: "var(--text-2)" }}>
          <ArrowLeft size={18} />
          <span style={{ fontSize: 13 }}>Voltar</span>
        </button>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px", color: "var(--text-1)" }}>{l("O que a Airia entende de você", "What Airia understands about you")}</h1>
      <p style={{ fontSize: 13, color: "var(--text-3)", margin: "0 0 16px", lineHeight: 1.5 }}>
        {l("A Airia aprende automaticamente do seu diário e check-ins. Você pode corrigir, apagar e marcar decisões como resolvidas.", "Airia learns automatically from your journal and check-ins. You can correct or delete patterns and mark decisions as resolved.")}
      </p>
      <SafetyProtocolCard riskSafety={reading?.riskSafety} surface="daily_summary" />

      {/* Status compacto, sem botão */}
      {status && (
        <div
          style={{
            background: "rgba(255,253,249,.97)",
            border: "1.5px solid var(--warm-border)",
            borderRadius: 14,
            padding: 14,
            marginBottom: 16,
          }}
        >
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
            <strong>{status.entitiesInGraph}</strong> {l("entidades", "entities")} · <strong>{status.factsInGraph}</strong> {l("fatos", "facts")} · <strong>{status.patternsInGraph}</strong> {l("padrões", "patterns")} · <strong>{status.openDecisionsInGraph}</strong> {l("decisões abertas", "open decisions")}
            {status.lastBackfillAt && ` · atualizado ${relativeDays(status.lastBackfillAt)}`}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12, borderBottom: "1px solid var(--warm-border)" }}>
        {([
          { key: "entidades", label: l("Entidades", "Entities"), count: entities.length },
          { key: "fatos", label: l("Fatos", "Facts"), count: facts.length },
          { key: "padroes", label: l("Padrões", "Patterns"), count: patterns.length },
          { key: "decisoes", label: l("Decisões", "Decisions"), count: decisions.filter((d) => !d.resolvedAt).length },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              padding: "10px 4px",
              fontSize: 12,
              fontWeight: 700,
              color: activeTab === tab.key ? "var(--text-1)" : "var(--text-3)",
              borderBottom: activeTab === tab.key ? "2px solid var(--accent-peach)" : "2px solid transparent",
              cursor: "pointer",
            }}
          >
            {tab.label} <span style={{ color: "var(--text-3)", fontWeight: 600 }}>({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && <p style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>Carregando…</p>}

      {/* Empty state */}
      {!loading && activeTab === "entidades" && entities.length === 0 && (
        <p style={{ color: "var(--text-3)", padding: 24, textAlign: "center", fontSize: 13 }}>
          {l("Nada extraído ainda. Use o diário ou rode o processamento de histórico.", "Nothing extracted yet. Use the journal or process your history.")}
        </p>
      )}

      {/* Entidades */}
      {!loading && activeTab === "entidades" && entities.map((e) => (
        <div key={e.id} className="glass-card" style={{ padding: 12, marginBottom: 8, borderRadius: 12, border: "1px solid var(--warm-border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--text-1)" }}>{e.canonicalName}</p>
              <p style={{ fontSize: 11, color: "var(--text-3)", margin: "3px 0 0" }}>
                {e.type}{e.status ? ` · ${e.status}` : ""} · mencionado {relativeDays(e.lastMentionAt)}
              </p>
              {e.aliases.length > 0 && (
                <p style={{ fontSize: 11, color: "var(--text-3)", margin: "3px 0 0", fontStyle: "italic" }}>
                  {l("Também chamado de:", "Also known as:")} {e.aliases.join(", ")}
                </p>
              )}
            </div>
            <button onClick={() => void deleteEntity(e.id)} aria-label="Apagar" style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4 }}>
              <Trash2 size={14} color="var(--text-3)" />
            </button>
          </div>
        </div>
      ))}

      {/* Fatos */}
      {!loading && activeTab === "fatos" && facts.length === 0 && (
        <p style={{ color: "var(--text-3)", padding: 24, textAlign: "center", fontSize: 13 }}>{l("Nenhum fato ainda.", "No facts yet.")}</p>
      )}
      {!loading && activeTab === "fatos" && facts.map((f) => (
        <div key={f.id} className="glass-card" style={{ padding: 12, marginBottom: 8, borderRadius: 12, border: "1px solid var(--warm-border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, color: "var(--text-1)", margin: 0, lineHeight: 1.5 }}>{f.statement}</p>
              <p style={{ fontSize: 10.5, color: "var(--text-3)", margin: "4px 0 0" }}>
                {f.entity?.canonicalName ? `[${f.entity.canonicalName}] · ` : ""}
                {new Date(f.occurredAt).toLocaleDateString()} · {f.source} · {l("confiança", "confidence")} {Math.round(f.confidence * 100)}%
              </p>
            </div>
            <button onClick={() => void deleteFact(f.id)} aria-label="Apagar" style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4 }}>
              <Trash2 size={14} color="var(--text-3)" />
            </button>
          </div>
        </div>
      ))}

      {/* Padrões */}
      {!loading && activeTab === "padroes" && patterns.length === 0 && (
        <p style={{ color: "var(--text-3)", padding: 24, textAlign: "center", fontSize: 13 }}>{l("Nenhum padrão observado ainda.", "No observed patterns yet.")}</p>
      )}
      {!loading && activeTab === "padroes" && patterns.map((p) => (
        <div key={p.id} className="glass-card" style={{ padding: 12, marginBottom: 8, borderRadius: 12, border: "1px solid var(--warm-border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, color: "var(--text-1)", margin: 0, lineHeight: 1.5 }}>{p.pattern}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(0,0,0,.06)", overflow: "hidden" }}>
                  <div style={{ width: `${Math.round(p.strength * 100)}%`, height: "100%", background: "var(--accent-sage, #96C7B3)" }} />
                </div>
                <span style={{ fontSize: 10.5, color: "var(--text-3)", minWidth: 40, textAlign: "right" }}>{Math.round(p.strength * 100)}%</span>
              </div>
            </div>
            <button onClick={() => void deletePattern(p.id)} aria-label="Apagar" style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4 }}>
              <Trash2 size={14} color="var(--text-3)" />
            </button>
          </div>
        </div>
      ))}

      {/* Decisões */}
      {!loading && activeTab === "decisoes" && decisions.length === 0 && (
        <p style={{ color: "var(--text-3)", padding: 24, textAlign: "center", fontSize: 13 }}>{l("Nenhuma decisão em aberto.", "No open decisions.")}</p>
      )}
      {!loading && activeTab === "decisoes" && decisions.map((d) => (
        <div key={d.id} className="glass-card" style={{ padding: 12, marginBottom: 8, borderRadius: 12, border: "1px solid var(--warm-border)", opacity: d.resolvedAt ? 0.55 : 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", margin: 0, lineHeight: 1.5 }}>{d.question}</p>
              {d.context && (
                <p style={{ fontSize: 11.5, color: "var(--text-3)", margin: "4px 0 0", lineHeight: 1.45 }}>{d.context}</p>
              )}
              <p style={{ fontSize: 10.5, color: "var(--text-3)", margin: "4px 0 0" }}>
                {d.resolvedAt ? `Resolvida ${relativeDays(d.resolvedAt)}` : `Aberta ${relativeDays(d.raisedAt)}`}
                {d.resolution ? ` · ${d.resolution}` : ""}
              </p>
            </div>
            {!d.resolvedAt && (
              <button
                onClick={() => void resolveDecision(d.id)}
                aria-label="Marcar como resolvida"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  border: "1.5px solid var(--accent-peach)",
                  background: "transparent",
                  color: "var(--accent-peach-ink)",
                  borderRadius: 999,
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <CheckCircle2 size={12} />
                Resolver
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
