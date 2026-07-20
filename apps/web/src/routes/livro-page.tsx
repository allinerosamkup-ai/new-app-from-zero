import { useState, useEffect } from "react";
import { trackMetaPixelEvent } from "../lib/meta-pixel";
import { useLocalizedCopy } from "../i18n";

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
const CHECKOUT_URL: string = "https://pay.hotmart.com/E106541869F";
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

const CHAPTERS_EN = [
  "Connecting with yourself", "Strengthening self-confidence and self-esteem", "Acceptance, authenticity, and well-being",
  "Assertive and effective communication", "Understanding relationship patterns", "Building supportive personal networks",
  "Authenticity in vulnerability", "Setting healthy boundaries", "Developing empathy in relationships",
  "Sustaining and building bridges", "Cultivating authentic relationships", "Celebrating individuality", "A new beginning",
];

const FAQ = [
  { q: "É um livro físico ou digital?", a: "Digital (PDF/ebook). Você recebe o acesso na hora, logo após a compra, e lê no celular, tablet ou computador." },
  { q: "Preciso ler tudo de uma vez?", a: "Não. O livro é feito pra ser praticado aos poucos — um capítulo por vez, no seu ritmo. E a Airia te ajuda a manter esse ritmo todo dia." },
  { q: "O que é a Airia que vem junto?", a: "É o app que continua o livro na prática. Cada capítulo vira uma ação diária adaptada ao seu humor e energia. O livro mostra o caminho; o app te sustenta nele." },
  { q: "E se não for pra mim?", a: "Você tem 7 dias de garantia. Se sentir que não é o seu momento, devolvemos cada centavo, sem perguntas." },
];

const FAQ_EN = [
  { q: "Is it a physical or digital book?", a: "Digital (PDF/ebook). You receive access immediately after purchase and can read it on your phone, tablet, or computer." },
  { q: "Do I need to read it all at once?", a: "No. The book is designed to be practiced gradually — one chapter at a time, at your pace. Airia helps you sustain that rhythm each day." },
  { q: "What is the Airia app included with it?", a: "It continues the book in practice. Each chapter becomes a daily action adapted to your mood and energy. The book shows the path; the app helps you stay on it." },
  { q: "What if it is not for me?", a: "You have a seven-day guarantee. If it is not the right time for you, every cent is refunded, no questions asked." },
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
  // Navegação explícita: garante que o checkout abre mesmo se algo
  // interceptar o comportamento padrão do link (PWA standalone, etc.).
  e.preventDefault();
  window.location.assign(CHECKOUT_URL);
}

function BuyButton({ children, big }: { children: React.ReactNode; big?: boolean }) {
  return (
    <a
      href={CHECKOUT_URL}
      onClick={goToCheckout}
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
  const l = useLocalizedCopy();
  const localizedChapters = CHAPTERS.map((chapter, index) => l(chapter, CHAPTERS_EN[index]));
  const localizedFaq = FAQ.map((item, index) => ({ q: l(item.q, FAQ_EN[index].q), a: l(item.a, FAQ_EN[index].a) }));
  const [showBar, setShowBar] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowBar(window.scrollY > 600);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.title = l("Antes de se Cobrar — e-book por R$9,90", "Before You Judge Yourself — ebook for R$9.90");
    trackMetaPixelEvent("ViewContent", {
      content_name: BOOK_NAME,
      content_category: "ebook",
      currency: "BRL",
      value: 9.9,
    });
  }, []);

  return (
    <div style={{ background: C.bg, color: C.ink, minHeight: "100dvh", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", overflowX: "hidden", paddingBottom: 80 }}>

      {/* HERO */}
      <Section style={{ paddingTop: 44, paddingBottom: 36, textAlign: "center" }}>
        <span style={{ display: "inline-block", fontSize: 11, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: C.peachInk, background: C.softPeach, borderRadius: 999, padding: "6px 14px", marginBottom: 22 }}>
          ✦ antes de se cobrar, se entenda
        </span>
        <h1 style={{ fontSize: 31, lineHeight: 1.18, fontWeight: 800, margin: "0 0 16px", letterSpacing: "-.02em" }}>
          {l("Você se cobra por tudo.", "You demand everything from yourself.")}<br />{l("Menos por", "Except for")} <span style={{ color: C.peachInk }}>{l("se entender.", "understanding yourself.")}</span>
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: C.ink2, margin: "0 0 28px" }}>
          {l("Não é preguiça. Não é falta de disciplina.", "It is not laziness. It is not a lack of discipline.")} <strong>{BOOK_NAME}</strong> {l("é autoconhecimento pra mentes intensas — que sentem tudo forte e se cobram por isso. Exercícios práticos, um passo por vez, sem culpa.", "is self-knowledge for intense minds — people who feel everything strongly and judge themselves for it. Practical exercises, one step at a time, without guilt.")}
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

        <BuyButton big>{l("Quero o meu por", "Get mine for")} {PRICE}</BuyButton>
        <p style={{ fontSize: 12, color: C.ink3, marginTop: 12 }}>{l("Acesso imediato, no seu e-mail · Garantia de 7 dias", "Immediate email access · 7-day guarantee")}</p>
      </Section>

      {/* PROBLEMA + AGITAÇÃO */}
      <div style={{ background: C.card, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "40px 0" }}>
        <Section>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 18px", lineHeight: 1.3 }}>
            {l('Você não é preguiçosa. Você não é "demais". Você só nunca teve um mapa de quem você é.', 'You are not lazy. You are not "too much." You simply never had a map of who you are.')}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              l("Você sente tudo intensamente — e depois se cobra por ter sentido.", "You feel everything intensely — then judge yourself for feeling it."),
              l("Se conecta com todo mundo, mas acha que ninguém te conhece de verdade.", "You connect with everyone, yet feel that nobody truly knows you."),
              l("Já tentou se abrir, e travou com medo de incomodar, de ser demais, de ser rejeitada.", "You tried to open up, then froze from fear of bothering people, being too much, or being rejected."),
              l("No fundo, você sabe: antes de cobrar tanto de si, faltou se entender.", "Deep down, you know: before demanding so much of yourself, you needed to understand yourself."),
            ].map((text) => (
              <div key={text} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ color: C.peach, fontWeight: 800, flexShrink: 0 }}>—</span>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: C.ink2 }}>{text}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 15.5, lineHeight: 1.6, color: C.ink, marginTop: 22, fontWeight: 600 }}>
            {l("A boa notícia: se entender é uma habilidade. E habilidade se aprende com prática — não com mais cobrança.", "The good news: understanding yourself is a skill. Skills are learned through practice — not more self-pressure.")}
          </p>
        </Section>
      </div>

      {/* SOLUÇÃO / PROMESSA */}
      <Section style={{ padding: "40px 22px" }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: C.sky }}>{l("A virada", "The turning point")}</span>
        <h2 style={{ fontSize: 23, fontWeight: 800, margin: "8px 0 16px", lineHeight: 1.28 }}>
          {l("Um caminho prático, não mais um livro bonito que você fecha e esquece.", "A practical path, not another beautiful book you close and forget.")}
        </h2>
        <p style={{ fontSize: 15.5, lineHeight: 1.62, color: C.ink2, margin: "0 0 16px" }}>
          {l("Este não é um livro pra ser só lido. É pra ser", "This book is not meant only to be read. It is meant to be")} <strong>{l("vivido", "lived")}</strong>, {l("um exercício por vez. Cada capítulo te tira da teoria e te coloca em movimento — porque autoconhecimento que fica na cabeça não muda nada. Muda quem pratica.", "one exercise at a time. Each chapter moves you from theory into action — because self-knowledge that stays in your head changes nothing. Practice does.")}
        </p>
        <p style={{ fontSize: 15.5, lineHeight: 1.62, color: C.ink2, margin: 0 }}>
          {l("Em 13 passos suaves, você transforma suas paixões e valores em alicerces e aprende a criar conexões que não dependem de máscara — com você mesma e com o outro.", "In 13 gentle steps, you turn your passions and values into foundations and learn to create connections that do not depend on masks — with yourself and others.")}
        </p>
      </Section>

      {/* O QUE TEM DENTRO */}
      <div style={{ background: C.softSage, padding: "40px 0" }}>
        <Section>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px", lineHeight: 1.3 }}>{l("Os 13 passos da sua jornada", "The 13 steps of your journey")}</h2>
          <p style={{ fontSize: 14, color: C.ink2, margin: "0 0 22px" }}>{l("Cada capítulo é um passo prático, com exercício pra fazer no mesmo dia.", "Each chapter is a practical step, with an exercise you can do that same day.")}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {localizedChapters.map((c, i) => (
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
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: C.peachInk }}>{l("Incluso · sem custo extra", "Included · no extra cost")}</span>
          <h2 style={{ fontSize: 21, fontWeight: 800, margin: "10px 0 12px", lineHeight: 1.3 }}>
            {l("A Airia: o app que continua o livro todo dia", "Airia: the app that continues the book every day")}
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: C.ink2, margin: "0 0 16px" }}>
            {l("Aqui mora a diferença. Você não leva só um livro — leva uma companheira diária. A", "This is the difference. You do not just get a book — you get a daily companion.")} <strong>Airia</strong> {l("transforma cada capítulo em ação, adaptada ao seu humor e energia. Num dia difícil, ela pede só um passo mínimo. Num dia bom, ela aprofunda. Ela não te deixa parar.", "turns each chapter into an action adapted to your mood and energy. On a difficult day, it asks for one minimal step. On a good day, it goes deeper. It keeps you moving.")}
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: C.ink2, margin: "0 0 16px" }}>
            {l("Já largou vários apps de rotina no meio do caminho? O problema nunca foi disciplina — eles eram lineares demais pra quem oscila. A", "Have you abandoned several routine apps halfway through? Discipline was never the problem — they were too linear for someone whose energy shifts.")} <strong>Airia</strong> {l("se adapta ao seu dia, não o contrário.", "adapts to your day, not the other way around.")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              l("Os 13 passos do livro viram uma jornada guiada no app", "The book's 13 steps become a guided journey in the app"),
              l("Check-in de humor e energia que adapta o seu dia", "Mood and energy check-ins that adapt your day"),
              l("Diário com uma IA que lê seus padrões e te move", "A journal with AI that reads your patterns and moves you forward"),
              l("Hábitos e lembretes do tamanho da sua fase", "Habits and reminders sized to your current phase"),
            ].map((text) => (
              <div key={text} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <span style={{ color: C.sage, fontWeight: 800, flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: 14, lineHeight: 1.5, color: C.ink }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* AUTORIDADE / HISTÓRIA */}
      <div style={{ background: C.card, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "40px 0" }}>
        <Section>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 14px" }}>{l("De quem viveu isso, pra você", "From someone who lived it, for you")}</h2>
          <p style={{ fontSize: 15, lineHeight: 1.62, color: C.ink2, margin: "0 0 14px" }}>
            {l("Sou a Alinê. Escrevi", "I'm Alinê. I wrote")} <strong>{BOOK_NAME}</strong> {l("porque conheço de perto o peso de sentir tudo intensamente, se cobrar por tudo — e mesmo assim se sentir sozinha no meio de todo mundo. Este livro é o mapa que eu queria ter tido: prático, gentil e firme na ação.", "because I know the weight of feeling everything intensely, demanding everything from yourself, and still feeling alone in a crowd. This is the map I wish I had: practical, gentle, and firm in action.")}
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.62, color: C.ink2, margin: 0 }}>
            {l("Ele foi o embrião de tudo. Hoje, virou também a Airia — pra que ninguém faça essa jornada sozinha.", "It was the seed of everything. Today it also became Airia — so no one has to take this journey alone.")}
          </p>
        </Section>
      </div>

      {/* OFERTA */}
      <Section style={{ padding: "44px 22px", textAlign: "center" }} >
        <div id="oferta" style={{ scrollMarginTop: 20 }} />
        <div style={{ borderRadius: 24, background: `linear-gradient(160deg, ${C.softPeach}, ${C.softSage})`, border: `1.5px solid ${C.border}`, padding: 30 }}>
          <h2 style={{ fontSize: 23, fontWeight: 800, margin: "0 0 8px" }}>{l("Comece a se entender hoje", "Start understanding yourself today")}</h2>
          <p style={{ fontSize: 14.5, color: C.ink2, margin: "0 0 20px", lineHeight: 1.5 }}>
            O livro completo (13 passos) <strong>+ a Airia inclusa</strong> pra praticar todo dia.
          </p>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 16, color: C.ink3, textDecoration: "line-through" }}>R$47</span>
            <span style={{ fontSize: 44, fontWeight: 800, color: C.peachInk, letterSpacing: "-.02em" }}>{PRICE}</span>
          </div>
          <p style={{ fontSize: 12.5, color: C.ink3, margin: "0 0 22px" }}>{l("pagamento único · acesso imediato", "one-time payment · immediate access")}</p>
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
          {localizedFaq.map((item) => (
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
          {l("Antes de se cobrar mais uma vez, se dá a chance de se entender. Dá o primeiro passo.", "Before judging yourself once again, give yourself the chance to understand. Take the first step.")}
        </p>
        <div style={{ display: "flex", justifyContent: "center" }}><BuyButton big>{l("Começar por", "Start for")} {PRICE}</BuyButton></div>
      </Section>

      <footer style={{ textAlign: "center", padding: "20px", fontSize: 11.5, color: C.ink3 }}>
        {l("© Alinê Roza ·", "© Alinê Roza ·")} {BOOK_NAME} · airia.pro
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
            style={{ flexShrink: 0, textDecoration: "none", background: C.peach, color: "#fff", fontWeight: 800, fontSize: 14, padding: "12px 22px", borderRadius: 999, boxShadow: "0 6px 16px rgba(215,137,127,.4)" }}
          >
            {l("Quero agora", "Get it now")}
          </a>
        </div>
      )}
    </div>
  );
}
