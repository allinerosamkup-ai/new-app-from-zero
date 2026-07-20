import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
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

export function TermsPage() {
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
            background: BRAND.pecheSoft,
            color: "#B86D4C",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            marginBottom: 16
          }}>
            <FileText size={14} />
            {t("legal.terms.eyebrow")}
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
            {t("legal.terms.title")}
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: BRAND.textSoft, maxWidth: 600 }}>
            {t("legal.terms.intro")}
          </p>
        </header>

        <article style={{ display: "flex", flexDirection: "column", gap: 48, paddingBottom: 80 }}>
          <section>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: BRAND.textWarm }}>{t("legal.terms.s1Title")}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: BRAND.textSoft }}>
              {t("legal.terms.s1")}
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: BRAND.textWarm }}>{t("legal.terms.s2Title")}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: BRAND.textSoft }}>
              {t("legal.terms.s2")}
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: BRAND.textWarm }}>{t("legal.terms.s3Title")}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: BRAND.textSoft }}>
              {t("legal.terms.s3")}
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: BRAND.textWarm }}>{t("legal.terms.s4Title")}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: BRAND.textSoft }}>
              {t("legal.terms.s4")}
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: BRAND.textWarm }}>{t("legal.terms.s5Title")}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: BRAND.textSoft }}>
              {t("legal.terms.s5")}
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
            {t("legal.terms.contact")}
          </footer>
        </article>
      </div>
    </div>
  );
}
