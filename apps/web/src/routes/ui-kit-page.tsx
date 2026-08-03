import { AuraButtonV2 } from "../components/editorial/AuraButtonV2";
export function UIKitPage() {
  return (
    <div className="editorial-container" style={{ padding: "80px 20px 100px", minHeight: "100vh" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--text-1)", marginBottom: "32px", textAlign: "center" }}>
        New UI Kit Showcase
      </h1>

      <section style={{ marginBottom: "48px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-2)", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "1px" }}>
          1. Gradient Buttons (Ref 2)
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Earthy Clay Gradient */}
          <AuraButtonV2 className="ui-btn-gradient" style={{ '--gradient-1': '#9BBFA8', '--gradient-2': '#6F9480' } as React.CSSProperties}>
            <span>Iniciar Sessão</span>
          </AuraButtonV2>
          
          {/* Neutral Storm Gradient */}
          <AuraButtonV2 className="ui-btn-gradient" style={{ '--gradient-1': '#828A94', '--gradient-2': '#68707A' } as React.CSSProperties}>
            <span>Ver Resultados</span>
          </AuraButtonV2>

          {/* Muted Sage Gradient */}
          <AuraButtonV2 className="ui-btn-gradient" style={{ '--gradient-1': '#B4B9A9', '--gradient-2': '#9DA391' } as React.CSSProperties}>
            <span>Sugestões da IA</span>
          </AuraButtonV2>
        </div>
      </section>

      <section style={{ marginBottom: "48px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-2)", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "1px" }}>
          2. Neumorphic Widgets (Ref 3)
        </h2>
        <div className="ui-neumorphic-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
             <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-1)", margin: 0 }}>Meu Radar</h3>
             <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--warm-surface)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.05)" }}>
               📊
             </div>
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-2)", lineHeight: 1.5 }}>
            Aqui teremos um widget com as bordas suaves e sombras internas/externas criando o efeito neumórfico.
          </p>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-2)", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "1px" }}>
          3. Infographic List (Ref 1)
        </h2>
        <div className="ui-info-list">
          {[
            { step: '1', title: 'Respiração Guiada', desc: 'Siga o ritmo.' },
            { step: '2', title: 'Foco no Momento', desc: 'Limpe a mente.' },
            { step: '3', title: 'Anotar os Sentimentos', desc: 'Registre tudo.' }
          ].map((item, i) => (
             <div key={i} className="ui-info-item">
               <div className="ui-info-number">{item.step}</div>
               <div className="ui-info-content">
                  <span className="ui-info-title">{item.title}</span>
                  <span className="ui-info-desc">{item.desc}</span>
               </div>
               <div className="ui-info-action">
                 <AuraButtonV2 style={{ border: "1px solid var(--warm-border-2)", background: "transparent", width: 28, height: 28, borderRadius: "50%", color: "var(--accent-peach)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                   +
                 </AuraButtonV2>
               </div>
             </div>
          ))}
        </div>
      </section>

    </div>
  );
}

