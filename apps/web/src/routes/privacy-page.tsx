import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

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
          Voltar para o Início
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
            Transparência & Privacidade
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
            Política de Privacidade
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: BRAND.textSoft, maxWidth: 600 }}>
            Sua privacidade é a base da Airia. Como você confia a nós sua jornada biológica e emocional, 
            estamos comprometidos em proteger cada dado com o mais alto rigor técnico e ético.
          </p>
        </header>

        <article style={{ display: "flex", flexDirection: "column", gap: 48, paddingBottom: 80 }}>
          <section>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: BRAND.textWarm }}>1. Coleta e Uso de Dados</h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: BRAND.textSoft }}>
              A Airia coleta informações que você fornece voluntariamente durante seu uso, como registros de humor, 
              níveis de energia, padrões de sono e metas pessoais. Esses dados são processados exclusivamente para 
              fornecer insights personalizados e ajudar você a harmonizar sua rotina.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: BRAND.textWarm }}>2. Integração com Google Calendar</h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: BRAND.textSoft, marginBottom: 16 }}>
              Caso você opte por ativar a sincronização com o Google Calendar, a Airia solicitará acesso para visualizar 
              seus eventos e criar novos compromissos no seu calendário. 
            </p>
            <div style={{ 
              background: "white", 
              padding: 24, 
              borderRadius: 24, 
              border: "1px solid rgba(17,24,39,0.06)",
              boxShadow: "0 12px 24px rgba(0,0,0,0.02)"
            }}>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                <li style={{ fontSize: 14, color: BRAND.textSoft }}><strong>O que acessamos:</strong> Títulos, horários e durações de eventos existentes para evitar conflitos no seu planejamento.</li>
                <li style={{ fontSize: 14, color: BRAND.textSoft }}><strong>O que criamos:</strong> Apenas os blocos de tempo que você explicitamente confirmar no Planner da Airia.</li>
                <li style={{ fontSize: 14, color: BRAND.textSoft }}><strong>Nossa política:</strong> Não compartilhamos seus dados de calendário com terceiros nem os utilizamos para fins publicitários.</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: BRAND.textWarm }}>3. Segurança da Informação</h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: BRAND.textSoft }}>
              Utilizamos infraestrutura de ponta, incluindo Supabase para autenticação e PostgreSQL para armazenamento, 
              com políticas de segurança baseadas em Row-Level Security (RLS). Isso significa que seus dados são 
              isolados e inacessíveis para qualquer outra pessoa, incluindo nossa equipe, a menos que seja estritamente 
              necessário para suporte técnico solicitado por você.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: BRAND.textWarm }}>4. Inteligência Artificial</h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: BRAND.textSoft }}>
              Suas reflexões de diário e interações com a Airia IA são processadas para gerar resumos e insights de vida. 
              Utilizamos modelos de IA (como GPT-4o-mini) via APIs seguras onde seus dados não são utilizados para 
              treinamento público de modelos de terceiros.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: BRAND.textWarm }}>5. Seus Direitos</h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: BRAND.textSoft }}>
              Você detém a propriedade total de seus dados. A qualquer momento, você pode solicitar a exclusão integral 
              de sua conta e de todo o histórico associado através das configurações do aplicativo.
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
            Última atualização: Abril de 2026. <br />
            Para dúvidas ou solicitações, entre em contato em support@airia.pro
          </footer>
        </article>
      </div>
    </div>
  );
}
