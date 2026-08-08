import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../lib/api";
import { trackEvent } from "../lib/track";
import { successHaptic, tapHaptic } from "../utils/haptics";
import { useAuraStore } from "../features/aura/store";
import { useLocalizedCopy } from "../i18n";
import {
  buildMirror,
  buildOutlook,
  buildReckoning,
  type BlockerId,
  type StoryAnswers,
} from "../features/story-onboarding/reading";
import {
  BLOCKERS,
  CAPACITY,
  COMMITMENT,
  COMMITMENT_REPLY,
  DRAINS,
  FEELINGS,
  GOAL_SHORTCUTS,
  LIST_PREFERENCE,
  OPEN_FRONTS,
  READ_ONLY_STEPS,
  RESTORERS,
  STORY_STEPS,
} from "../features/story-onboarding/steps";
import { buildFirstCheckin } from "../features/story-onboarding/first-checkin";
import "../features/story-onboarding/story.css";

/**
 * O onboarding como história: introdução, clímax e conclusão.
 *
 * A diferença para o fluxo antigo não é o número de telas — é que aqui cada
 * pergunta prepara a interpretação seguinte, e no meio do caminho a pessoa USA
 * a Airia de verdade. Ela escreve um objetivo, o motor interpreta, devolve o
 * que entendeu, e a próxima ação sai ajustada ao check-in que ela acabou de
 * fazer. Nada é simulado: é a mesma chamada que a Home faz depois.
 *
 * Entrada por toque em quase tudo. Só o nome e o objetivo aceitam texto, e o do
 * objetivo tem atalhos — dá para atravessar o fluxo inteiro sem teclado.
 */

const EMPTY: StoryAnswers = {
  name: "",
  feeling: null,
  blockers: [],
  openFronts: null,
  drains: [],
  restorers: [],
  listPreference: null,
};

/** Teto de objetivos. Ver o comentário em `goalTitles`. */
const MAX_GOALS = 3;

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function StoryOnboardingPage() {
  const l = useLocalizedCopy();
  const navigate = useNavigate();
  const { refreshData } = useAuraStore();

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<StoryAnswers>(EMPTY);
  /**
   * Até três objetivos.
   *
   * O teto não é estético: cada objetivo custa duas chamadas de modelo
   * (interpretação + validação) na tela mais crítica do funil. Três é o ponto em
   * que ainda dá para gerar tudo em paralelo sem transformar a conclusão do
   * onboarding em sala de espera.
   */
  const [goalTitles, setGoalTitles] = useState<string[]>([]);
  const [freeGoal, setFreeGoal] = useState("");
  const [capacity, setCapacity] = useState<string | null>(null);
  const [commitment, setCommitment] = useState<string | null>(null);

  // Resultado real do motor de interpretação.
  type GoalPlan = { title: string; steps: string[]; question: string | null; resultDefinition: string | null };
  const [plans, setPlans] = useState<GoalPlan[]>([]);
  const [resultDefinition, setResultDefinition] = useState<string | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [question, setQuestion] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);

  const [workDone, setWorkDone] = useState(0);
  const startedRef = useRef(false);

  const step = STORY_STEPS[index];
  const progress = ((index + 1) / STORY_STEPS.length) * 100;

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    trackEvent("story_onboarding_started", {});
  }, []);

  const reckoning = useMemo(() => buildReckoning(answers), [answers]);
  const mirror = useMemo(() => buildMirror(answers), [answers]);
  const outlook = useMemo(() => buildOutlook(answers, goalTitles[0] ?? null), [answers, goalTitles]);

  const toggleGoal = useCallback((titulo: string) => {
    setGoalTitles((atuais) => {
      if (atuais.includes(titulo)) return atuais.filter((item) => item !== titulo);
      return atuais.length >= MAX_GOALS ? atuais : [...atuais, titulo];
    });
  }, []);

  const addFreeGoal = useCallback(() => {
    const limpo = freeGoal.trim();
    if (limpo.length < 3) return;
    setGoalTitles((atuais) => (
      atuais.includes(limpo) || atuais.length >= MAX_GOALS ? atuais : [...atuais, limpo]
    ));
    setFreeGoal("");
  }, [freeGoal]);

  const go = useCallback((delta: number) => {
    setIndex((current) => Math.min(STORY_STEPS.length - 1, Math.max(0, current + delta)));
  }, []);

  /**
   * O clímax. Chama o mesmo motor que a Home usa — inclusive a possibilidade de
   * a Airia devolver uma PERGUNTA em vez de passos, que é o comportamento certo
   * quando o objetivo é amplo demais.
   */
  const interpretGoals = useCallback(async (titles: string[]) => {
    setThinking(true);

    const statements = [answers.feeling ? `Cheguei aqui ${answers.feeling.toLowerCase()}.` : ""].filter(Boolean);

    // Em paralelo, não em série: três objetivos × (geração + validação) em fila
    // colocariam ~20s na tela onde ela mais desiste.
    const resultados = await Promise.all(titles.map(async (title) => {
      try {
        const response = await api.post("/ai/suggest", {
          type: "goal-subtasks",
          context: { goalTitle: title, existingSubtasks: [], capacity, userStatements: statements },
        }) as { suggestion?: { items?: string[]; question?: string | null; resultDefinition?: string | null } };

        const suggestion = response.suggestion ?? {};
        return {
          title,
          steps: (suggestion.items ?? []).map((item) => String(item).trim()).filter(Boolean).slice(0, 5),
          question: suggestion.question?.trim() || null,
          resultDefinition: suggestion.resultDefinition?.trim() || null,
        };
      } catch {
        // Falha de rede não pode prender ninguém aqui: o objetivo é criado do
        // mesmo jeito no fim, e as ações podem ser montadas depois em Objetivos.
        return { title, steps: [] as string[], question: null, resultDefinition: null };
      }
    }));

    setPlans(resultados);
    // O clímax mostra o primeiro; os demais aparecem prontos em Objetivos.
    const principal = resultados[0];
    setResultDefinition(principal?.resultDefinition ?? null);
    setSteps(principal?.steps ?? []);
    setQuestion(principal?.question ?? null);
    setThinking(false);
  }, [answers.feeling, capacity]);

  /**
   * Grava tudo de verdade. É o que a barra da tela "montando" está esperando.
   *
   * Cada etapa tem prazo. Sem isso, uma chamada pendurada (rede ruim, token
   * expirado renovando) deixa a barra parada e o botão desabilitado — a pessoa
   * fica presa na última tela do onboarding sem nenhuma saída. O trabalho aqui é
   * importante, mas não é mais importante que ela conseguir entrar no app: o que
   * falhar pode ser refeito depois em Objetivos, o que não dá para desfazer é a
   * desistência.
   */
  const persist = useCallback(async () => {
    setWorkDone(0);
    const marcar = (n: number) => setWorkDone((current) => Math.max(current, n));
    const comPrazo = <T,>(promessa: Promise<T>, ms = 7000) => Promise.race([
      promessa,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ]);

    try {
      await comPrazo(api.post("/onboarding/operational-profile", {
        blockers: answers.blockers,
        openFronts: answers.openFronts,
        listPreference: answers.listPreference,
      }));
    } catch { /* perfil é personalização; sem ele o app funciona sem calibragem */ }
    marcar(1);

    // Todos os objetivos escolhidos, cada um já com as ações interpretadas: ela
    // sai do onboarding com Objetivos preenchido, não com uma tela vazia.
    const paraCriar = goalTitles.length > 0
      ? goalTitles.map((title) => plans.find((plan) => plan.title === title) ?? { title, steps: [], resultDefinition: null })
      : [];

    await Promise.all(paraCriar.map(async (plan, indice) => {
      try {
        await comPrazo(api.post("/objectives", {
          title: plan.title,
          category: "geral",
          ...(plan.resultDefinition ? { description: plan.resultDefinition } : {}),
          subgoals: plan.steps.map((title, order) => ({
            id: `story-${Date.now()}-${indice}-${order}`,
            title,
            done: false,
            order,
            aiGenerated: true,
          })),
        }), 10000);
      } catch { /* segue: o objetivo pode ser recriado na tela de Objetivos */ }
    }));
    marcar(2);

    // Check-in com o que ela respondeu, não com um número de enfeite. O humor
    // fixo em 5 que ficava aqui era dado inventado entrando no motor de ciclo —
    // exatamente o que o app promete não fazer.
    try {
      await comPrazo(api.post("/checkins", buildFirstCheckin(answers, capacity)));
    } catch { /* check-in inicial é bônus de calibragem, não requisito */ }
    marcar(3);

    try { await comPrazo(refreshData(), 5000); } catch { /* a Home recarrega sozinha */ }
    marcar(4);
  }, [answers, capacity, goalTitles, plans, refreshData]);

  // Efeitos de passo: interpretar no 'understanding', gravar no 'building'.
  useEffect(() => {
    if (step === "understanding" && goalTitles.length > 0 && plans.length === 0 && !thinking) {
      void interpretGoals(goalTitles);
    }
    if (step === "building") {
      void persist();
      // Rede de segurança independente do que a rede fizer: passados 12s, o
      // botão libera de qualquer jeito. Prender alguém na última tela do
      // onboarding é o pior desfecho possível deste fluxo.
      const escape = window.setTimeout(() => setWorkDone(4), 12000);
      return () => window.clearTimeout(escape);
    }
    if (step === "done") {
      successHaptic();
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  async function finish() {
    trackEvent("story_onboarding_completed", {
      blockers_count: answers.blockers.length,
      goals_count: goalTitles.length,
      commitment: commitment ?? "none",
      steps_generated: steps.length,
      asked_question: Boolean(question),
    });
    navigate("/home", { replace: true });
  }

  const canAdvance = (() => {
    if (READ_ONLY_STEPS.has(step)) return true;
    switch (step) {
      case "name": return answers.name.trim().length > 0;
      case "feeling": return answers.feeling !== null;
      case "blockers": return answers.blockers.length > 0;
      case "fronts": return answers.openFronts !== null;
      case "drains": return true;
      case "restorers": return true;
      case "preference": return answers.listPreference !== null;
      case "goal": return goalTitles.length > 0;
      case "checkin": return capacity !== null;
      case "commitment": return commitment !== null;
      default: return true;
    }
  })();

  const primeiroNome = answers.name.trim().split(/\s+/)[0] || "";

  return (
    <div className="story-shell">
      <div className="story-progress" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
        <div className="story-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="story-stage story-enter" key={step}>
        {step === "welcome" && (<>
          <p className="story-eyebrow">Airia</p>
          <h1 className="story-title">{l("Oi. Antes de qualquer coisa, quero entender como sua vida está funcionando hoje.", "Hi. Before anything else, I want to understand how your life is working today.")}</h1>
          <p className="story-body">{l("São cinco minutos, quase tudo em toque. No fim você sai daqui com uma coisa já encaminhada.", "Five minutes, almost all of it tapping. You leave here with one thing already under way.")}</p>
        </>)}

        {step === "problem" && (<>
          <h1 className="story-title">{l("Você já percebeu que entrou em queda quando já estava no fundo?", "Have you ever noticed you were sliding only once you had already hit bottom?")}</h1>
          <p className="story-body">{l("Energia e humor mudam devagar. Quando dá para sentir, o estrago já aconteceu — e aí o que sobra é correr atrás.", "Energy and mood shift slowly. By the time you feel it, the damage is done — and all that is left is catching up.")}</p>
        </>)}

        {step === "solution" && (<>
          <h1 className="story-title">{l("É isso que eu faço.", "That is what I do.")}</h1>
          <p className="story-body">{l("Eu leio seu humor e sua energia ao longo do tempo, percebo a virada antes de você sentir, e ajusto o tamanho do dia ao que você tem hoje. Não ao que você deveria ter.", "I read your mood and energy over time, catch the turn before you feel it, and size the day to what you have today. Not to what you should have.")}</p>
        </>)}

        {step === "name" && (<>
          <p className="story-eyebrow">{l("Pra começar", "To start")}</p>
          <h1 className="story-title">{l("Como você quer ser chamada?", "What should I call you?")}</h1>
          <input
            className="story-input"
            value={answers.name}
            onChange={(event) => setAnswers((c) => ({ ...c, name: event.target.value }))}
            placeholder={l("Seu nome ou apelido", "Your name or nickname")}
            autoFocus
            maxLength={40}
            aria-label={l("Seu nome", "Your name")}
          />
        </>)}

        {step === "feeling" && (<>
          <p className="story-eyebrow">{primeiroNome ? l(`Oi, ${primeiroNome}`, `Hi, ${primeiroNome}`) : l("Agora", "Right now")}</p>
          <h1 className="story-title">{l("Como você chegou aqui hoje?", "How did you arrive today?")}</h1>
          <div className="story-choices cols-2">
            {FEELINGS.map((option) => (
              <button
                key={option.id}
                type="button"
                className="story-choice"
                aria-pressed={answers.feeling === option.id}
                onClick={() => setAnswers((c) => ({ ...c, feeling: c.feeling === option.id ? null : option.id }))}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>)}

        {step === "blockers" && (<>
          <p className="story-eyebrow">{l("O que pega", "What gets in the way")}</p>
          <h1 className="story-title">{l("O que costuma travar primeiro?", "What usually jams first?")}</h1>
          <p className="story-body">{l("Pode marcar mais de um.", "You can pick more than one.")}</p>
          <div className="story-choices">
            {BLOCKERS.map((option) => (
              <button
                key={option.id}
                type="button"
                className="story-choice"
                aria-pressed={answers.blockers.includes(option.id)}
                onClick={() => setAnswers((c) => ({ ...c, blockers: toggle<BlockerId>(c.blockers, option.id) }))}
              >
                <span>{option.label}</span>
                {option.hint && <span className="hint">{option.hint}</span>}
              </button>
            ))}
          </div>
        </>)}

        {step === "fronts" && (<>
          <p className="story-eyebrow">{l("O que pega", "What gets in the way")}</p>
          <h1 className="story-title">{l("Quantas coisas estão em aberto na sua cabeça agora?", "How many things are open in your head right now?")}</h1>
          <div className="story-choices cols-2">
            {OPEN_FRONTS.map((option) => (
              <button
                key={option.id}
                type="button"
                className="story-choice"
                aria-pressed={answers.openFronts === option.value}
                onClick={() => setAnswers((c) => ({ ...c, openFronts: option.value }))}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>)}

        {step === "reckoning" && reckoning && (<>
          <p className="story-eyebrow">{l("O que eu li aqui", "What I read here")}</p>
          <h1 className="story-title story-line" style={{ animationDelay: "120ms" }}>{reckoning.headline}</h1>
          <div className="story-reckon story-line" style={{ animationDelay: "900ms" }}>
            <p className="story-reckon-turn">{reckoning.turn}</p>
            <p className="story-evidence">{reckoning.evidence}</p>
          </div>
        </>)}

        {step === "bridge" && (<>
          <h1 className="story-title">{l("Não precisa continuar assim.", "It does not have to stay like this.")}</h1>
          <p className="story-body">{l("Me dá mais três minutos e eu monto um caminho com o que você me contou.", "Give me three more minutes and I will build a path from what you told me.")}</p>
        </>)}

        {step === "drains" && (<>
          <p className="story-eyebrow">{l("Sua energia", "Your energy")}</p>
          <h1 className="story-title">{l("O que costuma te esvaziar?", "What usually drains you?")}</h1>
          <div className="story-choices cols-2">
            {DRAINS.map((option) => (
              <button
                key={option.id}
                type="button"
                className="story-choice"
                aria-pressed={answers.drains.includes(option.id)}
                onClick={() => setAnswers((c) => ({ ...c, drains: toggle(c.drains, option.id) }))}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>)}

        {step === "restorers" && (<>
          <p className="story-eyebrow">{l("Sua energia", "Your energy")}</p>
          <h1 className="story-title">{l("E o que te devolve energia?", "And what gives it back?")}</h1>
          <div className="story-choices cols-2">
            {RESTORERS.map((option) => (
              <button
                key={option.id}
                type="button"
                className="story-choice"
                aria-pressed={answers.restorers.includes(option.id)}
                onClick={() => setAnswers((c) => ({ ...c, restorers: toggle(c.restorers, option.id) }))}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>)}

        {step === "preference" && (<>
          <p className="story-eyebrow">{l("Como te ajudar", "How to help you")}</p>
          <h1 className="story-title">{l("Quando a lista é grande, o que funciona melhor?", "When the list is long, what works better?")}</h1>
          <div className="story-choices">
            {LIST_PREFERENCE.map((option) => (
              <button
                key={option.id}
                type="button"
                className="story-choice"
                aria-pressed={answers.listPreference === option.id}
                onClick={() => setAnswers((c) => ({ ...c, listPreference: option.id as StoryAnswers["listPreference"] }))}
              >
                <span>{option.label}</span>
                {option.hint && <span className="hint">{option.hint}</span>}
              </button>
            ))}
          </div>
        </>)}

        {step === "mirror" && (<>
          <p className="story-eyebrow">{l("Até aqui", "So far")}</p>
          <h1 className="story-title">{l("É mais ou menos assim que você funciona.", "This is roughly how you work.")}</h1>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {mirror.map((linha, i) => (
              <p
                key={linha}
                className="story-body story-line"
                style={{ animationDelay: `${240 + i * 620}ms`, fontWeight: 650, color: "var(--text-1)" }}
              >
                {linha}
              </p>
            ))}
          </div>
        </>)}

        {step === "goal" && (<>
          <p className="story-eyebrow">{l("Agora a parte que importa", "Now the part that matters")}</p>
          <h1 className="story-title">{l("O que você quer resolver?", "What do you want to sort out?")}</h1>
          <p className="story-body">
            {l(`Escolhe até ${MAX_GOALS} ou escreve do seu jeito.`, `Pick up to ${MAX_GOALS} or write your own.`)}
          </p>
          <div className="story-choices">
            {GOAL_SHORTCUTS.map((option) => {
              const marcado = goalTitles.includes(option.id);
              const noTeto = goalTitles.length >= MAX_GOALS && !marcado;
              return (
                <button
                  key={option.id}
                  type="button"
                  className="story-choice"
                  aria-pressed={marcado}
                  disabled={noTeto}
                  style={noTeto ? { opacity: .45, cursor: "default" } : undefined}
                  onClick={() => { tapHaptic(); toggleGoal(option.id); }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="story-input"
              value={freeGoal}
              onChange={(event) => setFreeGoal(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addFreeGoal(); } }}
              disabled={goalTitles.length >= MAX_GOALS}
              placeholder={l("Ou escreve aqui, do jeito que vier", "Or write it here, however it comes out")}
              maxLength={120}
              aria-label={l("Seu objetivo", "Your goal")}
            />
            {freeGoal.trim().length >= 3 && goalTitles.length < MAX_GOALS && (
              <button
                type="button"
                className="story-choice"
                style={{ flexShrink: 0, minWidth: 92, alignItems: "center" }}
                onClick={() => { tapHaptic(); addFreeGoal(); }}
              >
                {l("Somar", "Add")}
              </button>
            )}
          </div>

          {/* Bloquear o toque sem dizer por quê parece bug. */}
          {goalTitles.length >= MAX_GOALS && (
            <p className="story-evidence">
              {l(
                `${MAX_GOALS} já é bastante para começar. Dá para somar mais depois, em Objetivos.`,
                `${MAX_GOALS} is plenty to start. You can add more later, in Goals.`,
              )}
            </p>
          )}

          {goalTitles.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {goalTitles.map((titulo) => (
                <button
                  key={titulo}
                  type="button"
                  onClick={() => { tapHaptic(); toggleGoal(titulo); }}
                  aria-label={l(`Tirar: ${titulo}`, `Remove: ${titulo}`)}
                  style={{
                    border: "1.5px solid var(--accent-primary, #BFDCCB)",
                    background: "var(--accent-primary-a3, rgba(191,220,203,.16))",
                    color: "var(--accent-primary-ink, #4F7359)",
                    borderRadius: 999,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {GOAL_SHORTCUTS.find((option) => option.id === titulo)?.label ?? titulo} ×
                </button>
              ))}
            </div>
          )}
        </>)}

        {step === "understanding" && (<>
          <p className="story-eyebrow">{l("O que eu entendi", "What I understood")}</p>
          {thinking && <h1 className="story-title">{l("Lendo o que você me disse...", "Reading what you told me...")}</h1>}
          {!thinking && resultDefinition && (<>
            <h1 className="story-title">{l("Concluir isso significa:", "Finishing this means:")}</h1>
            <p className="story-body" style={{ fontSize: 17, fontWeight: 700, color: "var(--text-1)" }}>{resultDefinition}</p>
            <p className="story-body">{l("Se eu entendi errado, dá pra ajustar depois — em Objetivos.", "If I got it wrong, you can adjust it later in Goals.")}</p>
          </>)}
          {!thinking && !resultDefinition && (<>
            <h1 className="story-title">{l(`Anotado: ${goalTitles[0] ?? ""}`, `Noted: ${goalTitles[0] ?? ""}`)}</h1>
            <p className="story-body">{l("Vou montar o caminho a partir daqui.", "I will build the path from here.")}</p>
          </>)}
        </>)}

        {step === "path" && (<>
          <p className="story-eyebrow">{l("O caminho", "The path")}</p>
          {steps.length > 0 && (<>
            <h1 className="story-title">{l("Fica assim:", "Here it is:")}</h1>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {steps.map((titulo, i) => (
                <p
                  key={titulo}
                  className="story-body story-line"
                  style={{
                    animationDelay: `${180 + i * 420}ms`,
                    fontWeight: 650,
                    color: "var(--text-1)",
                    borderLeft: "2px solid var(--accent-primary, #BFDCCB)",
                    paddingLeft: 12,
                  }}
                >
                  {titulo}
                </p>
              ))}
            </div>
          </>)}
          {steps.length === 0 && question && (<>
            <h1 className="story-title">{l("Pra te ajudar direito, preciso saber uma coisa:", "To help you properly, I need one thing:")}</h1>
            <p className="story-body" style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)" }}>{question}</p>
            <p className="story-body">{l("Prefiro perguntar a inventar um passo que não tem nada a ver. Você responde isso em Objetivos, quando quiser.", "I would rather ask than invent a step that makes no sense. Answer it in Goals whenever you want.")}</p>
          </>)}
          {steps.length === 0 && !question && (
            <h1 className="story-title">{l("Vou montar o caminho com você em Objetivos.", "We will build the path together in Goals.")}</h1>
          )}
        </>)}

        {step === "checkin" && (<>
          <p className="story-eyebrow">{l("Todo dia vai ser assim", "Every day looks like this")}</p>
          <h1 className="story-title">{l("O que cabe hoje?", "What fits today?")}</h1>
          <p className="story-body">{l("Essa pergunta define o tamanho do que eu vou te propor. Nos dias ruins eu diminuo.", "This sets the size of what I propose. On bad days I shrink it.")}</p>
          <div className="story-choices">
            {CAPACITY.map((option) => (
              <button
                key={option.id}
                type="button"
                className="story-choice"
                aria-pressed={capacity === option.id}
                onClick={() => setCapacity(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>)}

        {step === "nextAction" && (<>
          <p className="story-eyebrow">{l("Então hoje", "So today")}</p>
          <h1 className="story-title">{steps[0] ?? l("Vamos começar pelo primeiro passo.", "Let us start with the first step.")}</h1>
          <p className="story-body">
            {capacity === "quick"
              ? l("Você disse que hoje cabe pouco. Então é só isso — e isso já conta.", "You said today is light. So that is all — and it already counts.")
              : capacity === "heavy"
                ? l("Você disse que hoje aguenta mais. Se sobrar gás, o próximo passo já está esperando.", "You said today can take more. If there is fuel left, the next step is waiting.")
                : l("Um passo. Se render, tem mais. Se não render, tudo bem.", "One step. If it flows, there is more. If not, that is fine.")}
          </p>
        </>)}

        {step === "done" && (<>
          <div className="story-seal" aria-hidden="true">✓</div>
          <h1 className="story-title" style={{ textAlign: "center" }}>{l(`Pronto${primeiroNome ? `, ${primeiroNome}` : ""}.`, `Done${primeiroNome ? `, ${primeiroNome}` : ""}.`)}</h1>
          <p className="story-body" style={{ textAlign: "center" }}>{l("Você não só respondeu perguntas: já tem uma coisa encaminhada.", "You did not just answer questions: you already have something under way.")}</p>
        </>)}

        {step === "building" && (<>
          <p className="story-eyebrow">{l("Guardando", "Saving")}</p>
          <h1 className="story-title">{l("Montando o seu começo.", "Building your start.")}</h1>
          <div className="story-work">
            {[
              l("Perfil de como você funciona", "Profile of how you work"),
              goalTitles.length > 1
                ? l(`Seus ${goalTitles.length} objetivos e os passos`, `Your ${goalTitles.length} goals and their steps`)
                : l("Seu objetivo e os passos", "Your goal and its steps"),
              l("Primeiro registro do seu ritmo", "First record of your rhythm"),
              l("Tudo pronto", "All set"),
            ].map((rotulo, i) => (
              <div key={rotulo} className={`story-work-item${workDone > i ? " done" : ""}`}>
                <span className="story-work-dot">{workDone > i ? "✓" : ""}</span>
                {rotulo}
              </div>
            ))}
          </div>
        </>)}

        {step === "outlook" && (<>
          <p className="story-eyebrow">{l("Onde você está", "Where you are")}</p>
          <h1 className="story-title">{l(`Hoje: ${outlook.now}.`, `Today: ${outlook.now}.`)}</h1>
          <p className="story-body" style={{ fontSize: 16, fontWeight: 650, color: "var(--text-1)" }}>
            {l(`Em 30 dias: ${outlook.ahead}`, `In 30 days: ${outlook.ahead}`)}
          </p>
          <p className="story-evidence">{l("Não é promessa de resultado. É o que eu consigo garantir: te conhecer o suficiente pra propor o tamanho certo.", "Not a promise of results. It is what I can guarantee: knowing you well enough to propose the right size.")}</p>
        </>)}

        {step === "commitment" && (<>
          <p className="story-eyebrow">{l("Última pergunta", "Last question")}</p>
          <h1 className="story-title">{l("Quanto você quer que isso mude?", "How much do you want this to change?")}</h1>
          <div className="story-choices">
            {COMMITMENT.map((option) => (
              <button
                key={option.id}
                type="button"
                className="story-choice"
                aria-pressed={commitment === option.id}
                onClick={() => setCommitment(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {commitment && (
            <p className="story-body story-line" style={{ fontWeight: 650, color: "var(--text-1)" }}>
              {COMMITMENT_REPLY[commitment]}
            </p>
          )}
        </>)}
      </div>

      <div className="story-foot">
        <button
          type="button"
          className="story-cta"
          disabled={!canAdvance || (step === "building" && workDone < 4)}
          onClick={() => {
            tapHaptic();
            if (step === "commitment") { void finish(); return; }
            go(1);
          }}
        >
          {step === "welcome" ? l("Começar", "Start")
            : step === "commitment" ? l("Ir para o meu dia", "Go to my day")
            : step === "building" ? (workDone < 4 ? l("Montando...", "Building...") : l("Continuar", "Continue"))
            : step === "reckoning" ? l("Faz sentido", "That tracks")
            : l("Continuar", "Continue")}
        </button>

        {index > 0 && step !== "building" && (
          <button type="button" className="story-skip" onClick={() => { tapHaptic(); go(-1); }}>
            {l("Voltar", "Back")}
          </button>
        )}
      </div>
    </div>
  );
}
