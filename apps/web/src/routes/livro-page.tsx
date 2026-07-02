import { useState, useEffect } from "react";
import { trackMetaPixelEvent } from "../lib/meta-pixel";

/**
 * Página de vendas do e-book "Antes de se Cobrar" — servida em airia.pro/livro.
 * Pública (sem auth). Mobile-first. Estrutura PAS + AIDA.
 * Identidade visual: Aura Editorial Clean (off-white + salmão/sálvia/azul).
 *
 * Message-match com os anúncios ativos da campanha "Livro | Tráfego":
 * mesmo título, mesma capa e mesma headline do criativo.
 *
 * CONFIG: troque CHECKOUT_URL pela URL real do checkout da Hotmart quando o
 * produto estiver criado. Enquanto for "#", o botão rola até a oferta.
 */
const CHECKOUT_URL = "https://pay.hotmart.com/E106541869F?checkoutMode=2";
const PRICE = "R$9,90";
const BOOK_NAME = "Antes de se Cobrar";

const C = {
  bg: "#FBF8F4",
  card: "#FFFFFF",
  ink: "#2B2622",
  ink2: "#6B6258",
  ink3: "#9A9085",
  peach: "#D7897F",
  peachInk: "#B5685E",
  sage: "#96C7B3",
  sky: "#6398A9",
  lilac: "#B5A4C8",
  border: "rgba(43,38,34,.10)",
  softPeach: "rgba(215,137,127,.10)",
  softSage: "rgba(150,199,179,.12)",
};

const CHAPTERS = [
  "Conexão consigo mesma",
  "Fortalecendo autoconfiança e autoestima",
  "Aceitação, autenticidade e bem-estar",
  "Comunicação assertiva e eficaz",
  "Entendendo padrões de relacionamento",
  "Construindo redes pessoais fortalecedoras",
  "Autenticidade na vulnerabilidade",
  "Estabelecendo limites saudáveis",
  "Desenvolvendo empatia nas relações",
  "Sustentando e construindo pontes",
  "Cultivando relacionamentos autênticos",
  "Celebrando a individualidade",
  "Um novo começo",
];

const FAQ = [
  { q: "É um livro físico ou digital?", a: "Digital (PDF/ebook). Você recebe o acesso na hora, logo após a compra, e lê no celular, tablet ou computador." },
  { q: "Preciso ler tudo de uma vez?", a: "Não. O livro é feito pra ser praticado aos poucos — um capítulo por vez, no seu ritmo. E a Airia te ajuda a manter esse ritmo todo dia." },
  { q: "O que é a Airia que vem junto?", a: "É o app que continua o livro na prática. Cada capítulo vira uma ação diária adaptada ao seu humor e energia. O livro mostra o caminho; o app te sustenta nele." },
  { q: "E se não for pra mim?", a: "Você tem 7 dias de garantia. Se sentir que não é o seu momento, devolvemos cada centavo, sem perguntas." },
];

function goToCheckout(e: React.MouseEvent) {
  if (CHECKOUT_URL === "#") {
    e.preventDefault();
    document.getElementById("oferta")?.scrollIntoView({ behavior: "smooth" });
    return;
  }
  trackMetaPixelEvent("InitiateCheckout", {
    content_name: BOOK_NAME,
    content_category: "ebook",
    currency: "BRL",
    value: 9.9,
  });
}

function BuyButton({ children, big }: { children: React.ReactNode; big?: boolean }) {
  return (
    <a
      href={CHECKOUT_URL}
      onClick={goToCheckout}
      className="hotmart-fb hotmart__button-checkout"
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        width: "100%", maxWidth: 420, textDecoration: "none",
        minHeight: big ? 60 : 52, padding: big ? "0 28px" : "0 22px",
        borderRadius: 999, background: C.peach, color: "#fff",
        fontSize: big ? 17 : 15, fontWeight: 800, letterSpacing: ".01em",
        boxShadow: "0 10px 26px rgba(215,137,127,.40)",
        transition: "transform .15s",
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(.98)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      {children}
    </a>
  );
}

function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section style={{ width: "100%", maxWidth: 560, margin: "0 auto", padding: "0 22px", ...style }}>
      {children}
    </section>
  );
}

export default function LivroPage() {
  const [showBar, setShowBar] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowBar(window.scrollY > 600);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.title = "Antes de se Cobrar — e-book por R$9,90";
    trackMetaPixelEvent("ViewContent", {
      content_name: BOOK_NAME,
      content_category: "ebook",
      currency: "BRL",
      value: 9.9,
    });
  }, []);

  // Widget de checkout da Hotmart (checkoutMode=2 → overlay sem sair da página).
  // Só carrega quando há link real configurado.
  useEffect(() => {
    if (CHECKOUT_URL === "#") return;
    if (document.getElementById("hotmart-widget-script")) return;

    const script = document.createElement("script");
    script.id = "hotmart-widget-script";
    script.src = "https://static.hotmart.com/checkout/widget.min.js";
    document.head.appendChild(script);

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = "https://static.hotmart.com/css/hotmart-fb.min.css";
    document.head.appendChild(link);
  }, []);

  return (
    <div style={{ background: C.bg, color: C.ink, minHeight: "100dvh", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", overflowX: "hidden", paddingBottom: 80 }}>

      {/* HERO */}
      <Section style={{ paddingTop: 44, paddingBottom: 36, textAlign: "center" }}>
        <span style={{ display: "inline-block", fontSize: 11, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: C.peachInk, background: C.softPeach, borderRadius: 999, padding: "6px 14px", marginBottom: 22 }}>
          ✦ antes de se cobrar, se entenda
        </span>
        <h1 style={{ fontSize: 31, lineHeight: 1.18, fontWeight: 800, margin: "0 0 16px", letterSpacing: "-.02em" }}>
          Você se cobra por tudo.<br />Menos por <span style={{ color: C.peachInk }}>se entender.</span>
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: C.ink2, margin: "0 0 28px" }}>
          <strong>{BOOK_NAME}</strong> é autoconhecimento pra mentes intensas que querem se conectar de verdade — consigo e com os outros. Exercícios práticos, um passo por vez, sem cobrança.
        </p>

        {/* capa real do livro */}
        <img
          src="/livro/capa-antes-de-se-cobrar.png"
          alt={`Capa do e-book ${BOOK_NAME} — Autoconhecimento para mentes intensas, que desejam se conectar, por Alinê Roza`}
          style={{
            width: 210, height: "auto", margin: "0 auto 28px", display: "block",
            borderRadius: 14, boxShadow: "0 24px 50px rgba(43,38,34,.22)",
          }}
        />

        <BuyButton big>Quero o meu por {PRICE}</BuyButton>
        <p style={{ fontSize: 12, color: C.ink3, marginTop: 12 }}>Acesso imediato, no seu e-mail · Garantia de 7 dias</p>
      </Section>

      {/* PROBLEMA + AGITAÇÃO */}
      <div style={{ background: C.card, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "40px 0" }}>
        <Section>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 18px", lineHeight: 1.3 }}>
            Você não é preguiçosa. Você não é "demais". Você só nunca teve um mapa de quem você é.
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              "Você sente tudo intensamente — e depois se cobra por ter sentido.",
              "Se conecta com todo mundo, mas acha que ninguém te conhece de verdade.",
              "Já tentou se abrir, e travou com medo de incomodar, de ser demais, de ser rejeitada.",
              "No fundo, você sabe: antes de cobrar tanto de si, faltou se entender.",
            ].map((t) => (
              <div key={t} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: C.peach, fontWeight: 800, flexShrink: 0 }}>—</span>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: C.ink2 }}>{t}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 15.5, lineHeight: 1.6, color: C.ink, marginTop: 22, fontWeight: 600 }}>
            A boa notícia: se entender é uma habilidade. E habilidade se aprende com prática — não com mais cobrança.
          </p>
        </Section>
      </div>

      {/* SOLUÇÃO / PROMESSA */}
      <Section style={{ padding: "40px 22px" }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: C.sky }}>A virada</span>
        <h2 style={{ fontSize: 23, fontWeight: 800, margin: "8px 0 16px", lineHeight: 1.28 }}>
          Um caminho prático, não mais um livro bonito que você fecha e esquece.
        </h2>
        <p style={{ fontSize: 15.5, lineHeight: 1.62, color: C.ink2, margin: "0 0 16px" }}>
          Este não é um livro pra ser só lido. É pra ser <strong>vivido</strong>, um exercício por vez. Cada capítulo te tira da teoria e te coloca em movimento — porque autoconhecimento que fica na cabeça não muda nada. Muda quem pratica.
        </p>
        <p style={{ fontSize: 15.5, lineHeight: 1.62, color: C.ink2, margin: 0 }}>
          Em 13 passos suaves, você transforma suas paixões e valores em alicerces e aprende a criar conexões que não dependem de máscara — com você mesma e com o outro.
        </p>
      </Section>

      {/* O QUE TEM DENTRO */}
      <div style={{ background: C.softSage, padding: "40px 0" }}>
        <Section>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px", lineHeight: 1.3 }}>Os 13 passos da sua jornada</h2>
          <p style={{ fontSize: 14, color: C.ink2, margin: "0 0 22px" }}>Cada capítulo é um passo prático, com exercício pra fazer no mesmo dia.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {CHAPTERS.map((c, i) => (
              <div key={c} style={{ display: "flex", gap: 12, alignItems: "center", background: C.card, borderRadius: 13, padding: "12px 14px", border: `1px solid ${C.border}` }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", background: C.softPeach, color: C.peachInk, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: C.ink }}>{c}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* BÔNUS — O APP */}
      <Section style={{ padding: "40px 22px" }}>
        <div style={{ borderRadius: 22, border: `1.5px solid ${C.peach}44`, background: C.card, padding: 24, boxShadow: "0 14px 30px rgba(43,38,34,.06)" }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: C.peachInk }}>Incluso · sem custo extra</span>
          <h2 style={{ fontSize: 21, fontWeight: 800, margin: "10px 0 12px", lineHeight: 1.3 }}>
            A Airia: o app que continua o livro todo dia
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: C.ink2, margin: "0 0 16px" }}>
            Aqui mora a diferença. Você não leva só um livro — leva uma companheira diária. A <strong>Airia</strong> transforma cada capítulo em ação, adaptada ao seu humor e energia. Num dia difícil, ela pede só um passo mínimo. Num dia bom, ela aprofunda. Ela não te deixa parar.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              "Os 13 passos do livro viram uma jornada guiada no app",
              "Check-in de humor e energia que adapta o seu dia",
              "Diário com uma IA que lê seus padrões e te move",
              "Hábitos e lembretes do tamanho da sua fase",
            ].map((t) => (
              <div key={t} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <span style={{ color: C.sage, fontWeight: 800, flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: 14, lineHeight: 1.5, color: C.ink }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* AUTORIDADE / HISTÓRIA */}
      <div style={{ background: C.card, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "40px 0" }}>
        <Section>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 14px" }}>De quem viveu isso, pra você</h2>
          <p style={{ fontSize: 15, lineHeight: 1.62, color: C.ink2, margin: "0 0 14px" }}>
            Sou a Alinê. Escrevi <strong>{BOOK_NAME}</strong> porque conheço de perto o peso de sentir tudo intensamente, se cobrar por tudo — e mesmo assim se sentir sozinha no meio de todo mundo. Este livro é o mapa que eu queria ter tido: prático, gentil e firme na ação.
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.62, color: C.ink2, margin: 0 }}>
            Ele foi o embrião de tudo. Hoje, virou também a Airia — pra que ninguém faça essa jornada sozinha.
          </p>
        </Section>
      </div>

      {/* OFERTA */}
      <Section style={{ padding: "44px 22px", textAlign: "center" }} >
        <div id="oferta" style={{ scrollMarginTop: 20 }} />
        <div style={{ borderRadius: 24, background: `linear-gradient(160deg, ${C.softPeach}, ${C.softSage})`, border: `1.5px solid ${C.border}`, padding: 30 }}>
          <h2 style={{ fontSize: 23, fontWeight: 800, margin: "0 0 8px" }}>Comece a se entender hoje</h2>
          <p style={{ fontSize: 14.5, color: C.ink2, margin: "0 0 20px", lineHeight: 1.5 }}>
            O livro completo (13 passos) <strong>+ a Airia inclusa</strong> pra praticar todo dia.
          </p>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 16, color: C.ink3, textDecoration: "line-through" }}>R$47</span>
            <span style={{ fontSize: 44, fontWeight: 800, color: C.peachInk, letterSpacing: "-.02em" }}>{PRICE}</span>
          </div>
          <p style={{ fontSize: 12.5, color: C.ink3, margin: "0 0 22px" }}>pagamento único · acesso imediato</p>
          <div style={{ display: "flex", justifyContent: "center" }}><BuyButton big>Quero o livro + a Airia</BuyButton></div>
          <p style={{ fontSize: 12.5, color: C.ink2, marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <span style={{ color: C.sage, fontWeight: 800 }}>✓</span> Garantia incondicional de 7 dias
          </p>
        </div>
      </Section>

      {/* FAQ */}
      <Section style={{ padding: "8px 22px 40px" }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 16px", textAlign: "center" }}>Perguntas frequentes</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {FAQ.map((item) => (
            <div key={item.q} style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: "16px 18px" }}>
              <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: C.ink }}>{item.q}</p>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: C.ink2 }}>{item.a}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* CTA FINAL */}
      <Section style={{ textAlign: "center", paddingBottom: 50 }}>
        <p style={{ fontSize: 17, lineHeight: 1.5, fontWeight: 700, color: C.ink, margin: "0 0 20px" }}>
          Antes de se cobrar mais uma vez, se dá a chance de se entender. Dá o primeiro passo.
        </p>
        <div style={{ display: "flex", justifyContent: "center" }}><BuyButton big>Começar por {PRICE}</BuyButton></div>
      </Section>

      <footer style={{ textAlign: "center", padding: "20px", fontSize: 11.5, color: C.ink3 }}>
        © Alinê Roza · {BOOK_NAME} · airia.pro
      </footer>

      {/* Barra fixa de compra (aparece ao rolar) */}
      {showBar && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
          background: "rgba(251,248,244,.94)", backdropFilter: "blur(10px)",
          borderTop: `1px solid ${C.border}`, padding: "10px 16px",
          display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between",
        }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12, color: C.ink2, fontWeight: 600 }}>Livro + Airia</p>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: C.peachInk }}>{PRICE}</p>
          </div>
          <a
            href={CHECKOUT_URL}
            onClick={goToCheckout}
            className="hotmart-fb hotmart__button-checkout"
            style={{ flexShrink: 0, textDecoration: "none", background: C.peach, color: "#fff", fontWeight: 800, fontSize: 14, padding: "12px 22px", borderRadius: 999, boxShadow: "0 6px 16px rgba(215,137,127,.4)" }}
          >
            Quero agora
          </a>
        </div>
      )}
    </div>
  );
}
