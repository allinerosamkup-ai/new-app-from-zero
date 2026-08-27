import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useLocalizedCopy } from "../../i18n";
import { quietButtonStyle, type GoalTemplate } from "./goal-model";

function getGoalStarterTemplates(l: (portuguese: string, english: string) => string): GoalTemplate[] {
  return [
    {
      direction: l("Minha rotina", "My routine"),
      result: l("Ter uma manhã que caiba na minha energia", "Have a morning that fits my energy"),
      nextAction: l("Definir o horário possível de acordar amanhã", "Choose a realistic wake-up time for tomorrow"),
    },
    {
      direction: l("Casa", "Home"),
      result: l("Deixar a sala pronta para uso", "Make the living room ready to use"),
      nextAction: l("Separar por 15 minutos o que não pertence à sala", "Set aside what does not belong in the living room for 15 minutes"),
    },
    {
      direction: l("Projeto", "Project"),
      result: l("Publicar a primeira versão do meu projeto", "Publish the first version of my project"),
      nextAction: l("Listar as três entregas da primeira versão", "List the first version’s three deliverables"),
    },
    {
      direction: l("Saúde", "Health"),
      result: l("Retomar meu acompanhamento de saúde", "Resume my health follow-up"),
      nextAction: l("Localizar o contato do profissional ou serviço", "Find the professional or service contact"),
    },
    {
      direction: l("Dinheiro", "Money"),
      result: l("Organizar as contas deste mês", "Organize this month’s bills"),
      nextAction: l("Reunir as contas que vencem neste mês", "Gather the bills due this month"),
    },
    {
      direction: l("Trabalho ou estudo", "Work or study"),
      result: l("Concluir minha próxima apresentação", "Finish my next presentation"),
      nextAction: l("Escrever os títulos dos três primeiros slides", "Write the titles of the first three slides"),
    },
  ];
}

export function CreationSheet({
  open,
  saving,
  onClose,
  onCreate,
}: {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onCreate: (result: string, deadline: string | null) => Promise<void>;
}) {
  const l = useLocalizedCopy();
  const [result, setResult] = useState("");
  const [selectedDirection, setSelectedDirection] = useState("");
  const [deadline, setDeadline] = useState("");
  const starterTemplates = getGoalStarterTemplates(l);

  useEffect(() => {
    if (!open) {
      setResult("");
      setSelectedDirection("");
      setDeadline("");
    }
  }, [open]);

  if (!open) return null;

  const ready = result.trim().length >= 3;
  const chooseTemplate = (template: GoalTemplate) => {
    setSelectedDirection(template.direction);
    setResult(template.result);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={l("Criar objetivo", "Create goal")}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        background: "rgba(20,27,23,.30)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(100%, 560px)",
          maxHeight: "92vh",
          overflowY: "auto",
          borderRadius: "32px 32px 0 0",
          background: "var(--warm-bg)",
          padding: "18px 18px calc(24px + env(safe-area-inset-bottom))",
          boxShadow: "0 -18px 50px rgba(26,34,29,.16)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ width: 42, height: 4, borderRadius: 99, background: "rgba(20,27,23,.14)", margin: "0 auto 18px" }} />
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: "0 0 4px", color: "var(--lagune)", fontSize: 11, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase" }}>
              {l("Novo objetivo", "New goal")}
            </p>
            <h2 style={{ margin: 0, color: "var(--text-1)", fontSize: 22, lineHeight: 1.2 }}>
              {l("O que você quer fazer avançar?", "What would you like to move forward?")}
            </h2>
          </div>
          <button aria-label={l("Fechar", "Close")} onClick={onClose} style={{ ...quietButtonStyle, width: 40, padding: 0 }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ margin: "0 0 9px", color: "var(--text-2)", fontSize: 13, fontWeight: 700 }}>
          {l("Escolha uma área ou escreva do seu jeito", "Choose an area or write it in your own way")}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginBottom: 18 }}>
          {starterTemplates.map((template) => {
            const selected = selectedDirection === template.direction;
            return (
              <button
                key={template.direction}
                onClick={() => chooseTemplate(template)}
                style={{
                  minHeight: 48,
                  borderRadius: 14,
                  border: selected ? "1.5px solid var(--nectarine)" : "1px solid rgba(99,152,169,.20)",
                  background: selected ? "var(--nectarine-a3)" : "rgba(255,255,255,.78)",
                  color: selected ? "var(--nectarine-11)" : "var(--text-2)",
                  padding: "10px 12px",
                  textAlign: "left",
                  fontSize: 12,
                  fontWeight: 750,
                  cursor: "pointer",
                }}
              >
                {template.direction}
              </button>
            );
          })}
        </div>

        <label style={{ display: "block", marginBottom: 14 }}>
          <span style={{ display: "block", marginBottom: 6, color: "var(--text-2)", fontSize: 12, fontWeight: 800 }}>
            {l("Resultado desejado", "Desired result")}
          </span>
          <input
            value={result}
            onChange={(event) => setResult(event.target.value)}
            placeholder={l("Ex.: deixar a sala pronta para uso", "E.g. make the living room ready to use")}
            maxLength={180}
            style={{
              width: "100%",
              minHeight: 48,
              boxSizing: "border-box",
              border: "1.5px solid rgba(99,152,169,.24)",
              borderRadius: 14,
              background: "#fff",
              color: "var(--text-1)",
              padding: "12px 14px",
              fontSize: 15,
              outline: "none",
            }}
          />
        </label>

        <label style={{ display: "block", marginBottom: 16 }}>
          <span style={{ display: "block", marginBottom: 6, color: "var(--text-2)", fontSize: 12, fontWeight: 800 }}>
            {l("Prazo (opcional)", "Deadline (optional)")}
          </span>
          <input
            type="date"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            aria-label={l("Prazo do objetivo", "Goal deadline")}
            style={{
              width: "100%",
              minHeight: 46,
              boxSizing: "border-box",
              border: "1.5px solid rgba(99,152,169,.24)",
              borderRadius: 14,
              background: "#fff",
              color: "var(--text-1)",
              padding: "10px 14px",
              fontSize: 14,
            }}
          />
          <span style={{ display: "block", marginTop: 5, color: "var(--text-3)", fontSize: 11 }}>
            {l("Pode ficar sem prazo. A data ajuda a ordenar, mas não decide sozinha o que importa.", "It can stay open-ended. The date helps ordering, but does not decide importance alone.")}
          </span>
        </label>

        <p style={{ margin: "0 0 18px", color: "var(--text-3)", fontSize: 12, lineHeight: 1.45 }}>
          {l("A Airia pode ajudar a organizar os próximos passos. Você continua decidindo o que entra e o que espera.", "Airia can help organize the next steps. You still decide what belongs and what can wait.")}
        </p>

        <button
          disabled={!ready || saving}
          onClick={() => ready && onCreate(result.trim(), deadline || null)}
          style={{
            width: "100%",
            minHeight: 52,
            border: 0,
            borderRadius: 14,
            background: ready ? "var(--nectarine)" : "rgba(20,27,23,.10)",
            color: ready ? "#fff" : "var(--text-3)",
            fontSize: 14,
            fontWeight: 850,
            cursor: ready && !saving ? "pointer" : "default",
          }}
        >
          {saving ? l("Preparando seu primeiro passo…", "Preparing your first step…") : l("Criar objetivo", "Create goal")}
        </button>
      </div>
    </div>
  );
}
