import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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

export function PrivacyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div 
      style={{ 
        minHeight: "100vh", 
        background: BRAND.bgLight, 
        color: BRAND.textWarm,
        fontFamily: "'Plus Jakarta Sans', sans-serif"
      }}
    >
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "60px 24px" }}>
        <button 
          onClick={() => navigate("/")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            border: "none",
            background: "none",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 700,
            color: BRAND.textSoft,
            marginBottom: 48,
            padding: 0
          }}
        >
          <ArrowLeft size={18} />
          {t("legal.backHome")}
        </button>

        <header style={{ marginBottom: 64 }}>
          <div style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: 8, 
            padding: "8px 12px", 
            borderRadius: 999, 
            background: BRAND.nectarineLight,
            color: "#A45D3D",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            marginBottom: 16
          }}>
            <ShieldCheck size={14} />
            {t("legal.privacy.eyebrow")}
          </div>
          <h1 style={{ 
            fontSize: "clamp(32px, 5vw, 48px)", 
            fontWeight: 800, 
            lineHeight: 1.1, 
            letterSpacing: "-0.04em",
            marginBottom: 24,
            fontFamily: "'Playfair Display', serif",
            fontStyle: "italic"
          }}>
            {t("legal.privacy.title")}
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: BRAND.textSoft, maxWidth: 600 }}>
            {t("legal.privacy.intro")}
          </p>
        </header>

        <article style={{ display: "flex", flexDirection: "column", gap: 48, paddingBottom: 80 }}>
          <section>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: BRAND.textWarm }}>{t("legal.privacy.s1Title")}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: BRAND.textSoft }}>
              {t("legal.privacy.s1")}
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: BRAND.textWarm }}>{t("legal.privacy.s2Title")}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: BRAND.textSoft, marginBottom: 16 }}>
              {t("legal.privacy.s2")}
            </p>
            <div style={{ 
              background: "white", 
              padding: 24, 
              borderRadius: 24, 
              border: "1px solid rgba(17,24,39,0.06)",
              boxShadow: "0 12px 24px rgba(0,0,0,0.02)"
            }}>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                <li style={{ fontSize: 14, color: BRAND.textSoft }}>{t("legal.privacy.access")}</li>
                <li style={{ fontSize: 14, color: BRAND.textSoft }}>{t("legal.privacy.create")}</li>
                <li style={{ fontSize: 14, color: BRAND.textSoft }}>{t("legal.privacy.policy")}</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: BRAND.textWarm }}>{t("legal.privacy.s3Title")}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: BRAND.textSoft }}>
              {t("legal.privacy.s3")}
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: BRAND.textWarm }}>{t("legal.privacy.s4Title")}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: BRAND.textSoft }}>
              {t("legal.privacy.s4")}
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: BRAND.textWarm }}>{t("legal.privacy.s5Title")}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: BRAND.textSoft }}>
              {t("legal.privacy.s5")}
            </p>
          </section>

          <footer style={{ 
            paddingTop: 48, 
            marginTop: 48, 
            borderTop: "1px solid rgba(107,91,87,0.1)",
            fontSize: 13,
            color: BRAND.textSoft,
            lineHeight: 1.6
          }}>
            {t("legal.updated")} <br />
            {t("legal.privacy.contact")}
          </footer>
        </article>
      </div>
    </div>
  );
}
