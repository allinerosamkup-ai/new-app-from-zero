import { useState } from "react";
import { Check, Copy, Share2, UserPlus } from "lucide-react";

import { useLocalizedCopy } from "../i18n";

const PUBLIC_AIRIA_LINK = "https://airia.pro";

/** Customer sharing stays separate from the verified professional program. */
export function ReferralCard() {
  const l = useLocalizedCopy();
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(PUBLIC_AIRIA_LINK);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function share() {
    if (navigator.share) {
      await navigator.share({
        title: "Airia",
        text: l(
          "Estou usando a Airia para organizar humor, energia e rotina. Se fizer sentido para você, dá uma olhada.",
          "I use Airia to organize mood, energy, and routine. Take a look if it sounds useful.",
        ),
        url: PUBLIC_AIRIA_LINK,
      }).catch(() => undefined);
      return;
    }
    await copyLink();
  }

  return (
    <section style={{ padding: "16px 18px", borderRadius: 20, background: "rgba(255,253,249,.95)", border: "1px solid var(--warm-border)", display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(150,199,179,.12)", display: "grid", placeItems: "center" }}>
          <UserPlus size={17} />
        </span>
        <div>
          <strong>{l("Compartilhar a Airia", "Share Airia")}</strong>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-3)" }}>
            {l("Um convite comum, sem código ou benefício comercial.", "A regular invitation, without a code or commercial benefit.")}
          </p>
        </div>
      </div>
      <button type="button" onClick={share} style={{ minHeight: 42, borderRadius: 999, border: 0, background: "var(--accent-sage)", color: "#fff", fontWeight: 800, cursor: "pointer" }}>
        <Share2 size={14} /> {copied ? <><Check size={14} /> {l("Link copiado", "Link copied")}</> : l("Compartilhar", "Share")}
      </button>
      <small style={{ color: "var(--text-3)" }}>
        {l("Programa para psicólogas fica na seção abaixo.", "The program for psychologists is in the section below.")}
      </small>
      {!navigator.share && (
        <button type="button" aria-label={l("Copiar link", "Copy link")} onClick={copyLink} style={{ display: "none" }}>
          <Copy size={14} />
        </button>
      )}
    </section>
  );
}
