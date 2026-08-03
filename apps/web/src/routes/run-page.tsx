import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
import { RewardBurst, type Reward } from "../components/RewardBurst";
import { useAuraStore } from "../features/aura/store";
import { api } from "../lib/api";
import { useLocalizedCopy } from "../i18n";
import { successHaptic, tapHaptic } from "../utils/haptics";
import "../styles/aura.css";
import "../styles/editorial.css";

/**
 * Execução passo a passo.
 *
 * A tela mostra UM passo. O próximo aparece como uma linha, nunca a lista
 * inteira — ver tudo de uma vez é o que trava. Pular não custa nada e não pede
 * justificativa. O tempo real de cada passo é registrado para o app parar de
 * propor 20 minutos para o que sempre leva 35.
 */

type Step = {
  id: string;
  title: string;
  plannedMinutes: number;
  starter?: string | null;
  done: boolean;
};

type RunState = {
  taskId: string | null;
  taskTitle: string;
  steps: Step[];
  index: number;
  status: "running" | "paused" | "done";
  stepStartedAt: number;
  carriedMs: number;
  records: Array<{ title: string; plannedMinutes: number; actualMinutes: number; skipped: boolean }>;
};

function minutesSince(startedAt: number, carriedMs: number): number {
  return Math.max(0, Math.round((Date.now() - startedAt + carriedMs) / 60000));
}

export function RunPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const l = useLocalizedCopy();
  const { refreshData } = useAuraStore();
  const [reward, setReward] = useState<Reward | null>(null);
  const [tick, setTick] = useState(0);
  const startedRef = useRef(false);

  const incoming = (location.state ?? {}) as {
    taskId?: string;
    title?: string;
    checklist?: Array<{ text?: string; title?: string; done?: boolean }>;
    steps?: Array<{ title: string; durationMinutes?: number; starter?: string }>;
    durationMinutes?: number;
  };

  const [run, setRun] = useState<RunState>(() => {
    const fromSteps: Step[] = (incoming.steps ?? []).map((step, index) => ({
      id: `s${index}`,
      title: step.title,
      plannedMinutes: step.durationMinutes ?? 10,
      starter: step.starter ?? null,
      done: false,
    }));
    const fromChecklist: Step[] = (incoming.checklist ?? [])
      .map((item, index) => ({
        id: `c${index}`,
        title: (item.text ?? item.title ?? "").trim(),
        plannedMinutes: 10,
        starter: null,
        done: Boolean(item.done),
      }))
      .filter((step) => step.title.length > 0);

    const steps = fromSteps.length > 0 ? fromSteps : fromChecklist;
    return {
      taskId: incoming.taskId ?? null,
      taskTitle: incoming.title ?? l("Execução", "Run"),
      // Sem passos, a própria tarefa é o passo. Ninguém fica sem por onde começar.
      steps: steps.length > 0
        ? steps
        : [{ id: "only", title: incoming.title ?? l("Começar", "Start"), plannedMinutes: incoming.durationMinutes ?? 25, starter: null, done: false }],
      index: 0,
      status: "running",
      stepStartedAt: Date.now(),
      carriedMs: 0,
      records: [],
    };
  });

  // Avisa o backend que começou — é o que alimenta a leitura de padrão.
  useEffect(() => {
    if (startedRef.current || !run.taskId) return;
    startedRef.current = true;
    void api.post(`/timeline/${run.taskId}/started`, {}).catch(() => undefined);
  }, [run.taskId]);

  // Relógio da tela. Um segundo é suficiente e não precisa ser preciso.
  useEffect(() => {
    if (run.status !== "running") return;
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [run.status]);

  const step = run.steps[run.index];
  const nextStep = run.steps[run.index + 1];
  const elapsed = useMemo(
    () => (run.status === "running" ? minutesSince(run.stepStartedAt, run.carriedMs) : Math.round(run.carriedMs / 60000)),
    [run.status, run.stepStartedAt, run.carriedMs, tick],
  );

  function closeStep(skipped: boolean) {
    if (!step) return;
    if (skipped) tapHaptic(); else successHaptic();

    const actualMinutes = skipped ? 0 : minutesSince(run.stepStartedAt, run.carriedMs);
    const records = [...run.records, {
      title: step.title,
      plannedMinutes: step.plannedMinutes,
      actualMinutes,
      skipped,
    }];
    const isLast = run.index + 1 >= run.steps.length;

    if (!skipped) {
      setReward({
        headline: isLast ? l("Rotina fechada.", "Routine done.") : l("Feito.", "Done."),
        detail: isLast ? null : nextStep ? l(`Depois: ${nextStep.title}`, `Next: ${nextStep.title}`) : null,
        animation: isLast ? "confetti" : "spark",
        intensity: isLast ? "big" : "small",
      });
    }

    setRun((current) => ({
      ...current,
      records,
      index: isLast ? current.index : current.index + 1,
      status: isLast ? "done" : "running",
      stepStartedAt: Date.now(),
      carriedMs: 0,
    }));

    if (isLast) void finish(records);
  }

  async function finish(records: RunState["records"]) {
    if (!run.taskId) return;
    try {
      // Fecha o par início→fim: sem a duração real, o app continua estimando no escuro.
      await api.post("/events", {
        eventName: "routine.run_finished",
        properties: {
          taskId: run.taskId,
          plannedMinutes: records.reduce((total, record) => total + record.plannedMinutes, 0),
          actualMinutes: records.reduce((total, record) => total + record.actualMinutes, 0),
          completedSteps: records.filter((record) => !record.skipped).length,
          skippedSteps: records.filter((record) => record.skipped).length,
        },
      });
      await refreshData();
    } catch {
      /* registrar o tempo é bônus; não pode travar o fim da rotina */
    }
  }

  if (run.status === "done") {
    const completed = run.records.filter((record) => !record.skipped).length;
    return (
      <div className="aura-page-shell">
        <div className="screen-content" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18, minHeight: "70vh", justifyContent: "center", textAlign: "center" }}>
          <span aria-hidden="true" style={{ fontSize: 42 }}>🎉</span>
          <h1 className="aura-page-title" style={{ margin: 0 }}>
            {completed >= run.steps.length ? l("Rotina fechada.", "Routine done.") : l("Você atravessou.", "You made it through.")}
          </h1>
          {/* Fala do que aconteceu. Nunca do que faltou. */}
          <p className="aura-page-subtitle" style={{ margin: 0 }}>
            {completed === 1
              ? l("Um passo feito. Começar é a parte cara.", "One step done. Starting is the expensive part.")
              : l(`${completed} passos atravessados.`, `${completed} steps done.`)}
          </p>
          <AuraButtonV2 onClick={() => navigate("/planner")} style={{ marginTop: 8 }}>
            {l("Voltar ao Planner", "Back to Planner")}
          </AuraButtonV2>
        </div>
        <RewardBurst reward={reward} onDone={() => setReward(null)} />
      </div>
    );
  }

  const progressPercent = Math.round((run.index / run.steps.length) * 100);

  return (
    <div className="aura-page-shell">
      <div className="screen-content" style={{ padding: "18px 20px 120px", display: "flex", flexDirection: "column", gap: 16 }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--text-3)", fontSize: 13, cursor: "pointer", padding: 0 }}
        >
          ← {run.taskTitle}
        </button>

        <div
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={l("Progresso da rotina", "Routine progress")}
          style={{ height: 6, borderRadius: 999, background: "rgba(169,210,187,.16)", overflow: "hidden" }}
        >
          <div style={{ width: `${progressPercent}%`, height: "100%", background: "var(--accent-peach, #A9D2BB)", transition: "width 320ms ease" }} />
        </div>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-3)" }}>
          {l(`Passo ${run.index + 1} de ${run.steps.length}`, `Step ${run.index + 1} of ${run.steps.length}`)}
        </p>

        {/* O passo atual ocupa a tela. É a única coisa que precisa existir agora. */}
        <div style={{ background: "rgba(255,255,255,.72)", border: "1px solid rgba(255,255,255,.86)", borderRadius: 22, padding: "22px 20px", boxShadow: "0 14px 30px rgba(169,210,187,.08)" }}>
          <h1 style={{ margin: "0 0 10px", fontSize: 24, fontWeight: 800, lineHeight: 1.2, color: "var(--text-1)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {step?.title}
          </h1>
          {step?.starter && (
            <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--text-2)" }}>
              {step.starter}
            </p>
          )}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: "var(--accent-peach-ink, var(--text-1))", fontVariantNumeric: "tabular-nums" }}>
              {elapsed}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>
              {/* Previsto, não meta: passar do tempo não é falha. */}
              {l(`min · previsto ${step?.plannedMinutes ?? 0}`, `min · planned ${step?.plannedMinutes ?? 0}`)}
            </span>
          </div>
        </div>

        {nextStep && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-3)" }}>
            {l(`Depois: ${nextStep.title}`, `Next: ${nextStep.title}`)}
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
          <AuraButtonV2 onClick={() => closeStep(false)} style={{ width: "100%" }}>
            {l("Concluir passo", "Complete step")}
          </AuraButtonV2>
          <div style={{ display: "flex", gap: 10 }}>
            {/* Pular é saída legítima e não pede justificativa. */}
            <AuraButtonV2 variant="outline" size="sm" style={{ flex: 1 }} onClick={() => closeStep(true)}>
              {l("Pular", "Skip")}
            </AuraButtonV2>
            <AuraButtonV2
              variant="ghost"
              size="sm"
              style={{ flex: 1 }}
              onClick={() => setRun((current) => current.status === "running"
                ? { ...current, status: "paused", carriedMs: current.carriedMs + (Date.now() - current.stepStartedAt) }
                : { ...current, status: "running", stepStartedAt: Date.now() })}
            >
              {run.status === "running" ? l("Pausar", "Pause") : l("Retomar", "Resume")}
            </AuraButtonV2>
          </div>
        </div>
      </div>

      <RewardBurst reward={reward} onDone={() => setReward(null)} />
    </div>
  );
}
