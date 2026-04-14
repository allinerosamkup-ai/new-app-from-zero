import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

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
            background: BRAND.pecheSoft,
            color: "#B86D4C",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            marginBottom: 16
          }}>
            <FileText size={14} />
            Acordo de Utilização
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
            Termos de Uso
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: BRAND.textSoft, maxWidth: 600 }}>
            Bem-vindo à Airia. Ao utilizar nossa plataforma, você concorda com as diretrizes e responsabilidades 
            descritas abaixo, focadas em garantir uma experiência segura e evolutiva.
          </p>
        </header>

        <article style={{ display: "flex", flexDirection: "column", gap: 48, paddingBottom: 80 }}>
          <section>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: BRAND.textWarm }}>1. Natureza do Serviço</h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: BRAND.textSoft }}>
              A Airia é um assistente pessoal focado em bem-estar e organização biológica. 
              <strong> Importante:</strong> A Airia não substitui aconselhamento médico profissional, psiquiátrico ou psicológico. 
              As sugestões de IA baseiam-se em algoritmos de probabilidade e não devem ser usadas como diagnósticos ou tratamentos.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: BRAND.textWarm }}>2. Uso Responsável</h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: BRAND.textSoft }}>
              Você se compromete a usar a Airia de forma ética, não tentando burlar sistemas de segurança, 
              realizar engenharia reversa ou utilizar a plataforma para fins ilícitos. A conta é pessoal e intransferível.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: BRAND.textWarm }}>3. Integrações de Terceiros</h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: BRAND.textSoft }}>
              Ao utilizar a integração com o Google Calendar, você reconhece que a Airia atuará como um cliente 
              que interage com sua conta Google conforme as permissões concedidas por você. Não nos responsabilizamos 
              por exclusões acidentais de eventos feitas pelo provedor original ou por configurações de conta externas.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: BRAND.textWarm }}>4. Assinaturas e Planos</h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: BRAND.textSoft }}>
              Caso utilize funcionalidades pagas, as renovações seguem o ciclo escolhido (mensal/anual). 
              Cancelamentos podem ser feitos a qualquer momento, garantindo acesso até o fim do período já pago.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: BRAND.textWarm }}>5. Modificações</h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: BRAND.textSoft }}>
              Podemos atualizar estes termos conforme evoluímos. Notificaremos você sobre mudanças significativas. 
              O uso continuado após as alterações implica na aceitação dos novos termos.
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
            Para suporte jurídico ou dúvidas: legal@airia.pro
          </footer>
        </article>
      </div>
    </div>
  );
}
