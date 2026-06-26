import { useState } from "react";
import { UserPlus, Copy, Check, Share2 } from "lucide-react";

interface ReferralCardProps {
  userId: string;
  invitedCount?: number;
}

function generateReferralCode(userId: string): string {
  // Gera código curto determinístico a partir do userId
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  const base36 = Math.abs(hash).toString(36).toUpperCase();
  return ("AIRIA" + base36).slice(0, 9);
}

export function ReferralCard({ userId, invitedCount = 0 }: ReferralCardProps) {
  const [copied, setCopied] = useState(false);
  const code = generateReferralCode(userId);
  const link = `https://airia.pro?ref=${code}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  }

  async function handleShare() {
    if (navigator.share) {
      await navigator.share({
        title: "Airia — assistente de humor e energia",
        text: "Descobri um app que entende meus ciclos de energia e me ajuda a agir no tempo certo. Tenta comigo?",
        url: link,
      }).catch(() => {/* user cancelled */});
    } else {
      await handleCopy();
    }
  }

  return (
    <div style={{
      padding: "16px 18px",
      borderRadius: 20,
      background: "rgba(255,253,249,.95)",
      border: "1px solid var(--warm-border)",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: "50%",
          background: "rgba(150,199,179,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <UserPlus size={17} color="var(--accent-sage)" />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "var(--text-1)" }}>
            Convida uma amiga
          </p>
          <p style={{ margin: "1px 0 0", fontSize: 11.5, color: "var(--text-3)" }}>
            {invitedCount > 0
              ? `${invitedCount} ${invitedCount === 1 ? "pessoa convidada" : "pessoas convidadas"}`
              : "Compartilha o link abaixo"}
          </p>
        </div>
      </div>

      <div style={{
        display: "flex",
        alignItems: "center",
        background: "rgba(215,137,127,0.07)",
        borderRadius: 12,
        padding: "10px 12px",
        gap: 8,
      }}>
        <span style={{
          flex: 1,
          fontSize: 11.5,
          color: "var(--text-2)",
          fontFamily: "monospace",
          wordBreak: "break-all",
        }}>
          {link}
        </span>
        <button
          onClick={handleCopy}
          style={{
            flexShrink: 0,
            background: "none", border: "none", cursor: "pointer",
            color: copied ? "var(--accent-sage)" : "var(--text-3)",
            padding: 4,
            transition: "color .2s",
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>

      <button
        onClick={handleShare}
        style={{
          width: "100%", height: 42, borderRadius: 999, border: "none",
          background: "var(--accent-sage)",
          color: "#fff",
          fontSize: 13, fontWeight: 800,
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        <Share2 size={14} />
        Compartilhar convite
      </button>
    </div>
  );
}
