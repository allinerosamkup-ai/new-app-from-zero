import { describe, expect, it } from "vitest";
import {
  buildGoalCardModel,
  buildGoalTaskSchedule,
  parsePausedGoalIds,
  selectFocusGoal,
  togglePausedGoalId,
} from "./goal-priority-actions";

describe("goal experience helpers", () => {
  it("uses only the first unfinished action that already belongs to the goal", () => {
    const model = buildGoalCardModel({
      id: 42,
      title: "Publicar meu portfólio",
      completedPct: 33,
      subtasks: [
        { id: 1, title: "Escolher 12 fotos", done: true },
        { id: 2, title: "Revisar a ordem das fotos", done: false },
        { id: 3, title: "Escrever a apresentação", done: false },
      ],
    });

    expect(model.result).toBe("Publicar meu portfólio");
    expect(model.nextAction).toEqual({
      id: 2,
      title: "Revisar a ordem das fotos",
    });
    expect(model.progressLabel).toBe("1 movimento concluído");
  });

  it("uses persisted action order instead of the order a stale screen happened to receive", () => {
    const model = buildGoalCardModel({
      id: "goal-ordered",
      title: "Organizar o lançamento",
      completedPct: 0,
      subtasks: [
        { id: "third", title: "Publicar", done: false, order: 2 },
        { id: "first", title: "Reunir material", done: false, order: 0 },
        { id: "second", title: "Revisar", done: false, order: 1 },
      ],
    });

    expect(model.nextAction).toEqual({ id: "first", title: "Reunir material" });
  });

  it("does not invent a next action when the goal has none", () => {
    const model = buildGoalCardModel({
      id: "goal-1",
      title: "Cuidar melhor da minha saúde",
      completedPct: 0,
      subtasks: [],
    });

    expect(model.nextAction).toBeNull();
    expect(model.progressLabel).toBe("Pronto para definir o primeiro passo");
  });

  it("describes progress without punishment or percentage pressure", () => {
    expect(buildGoalCardModel({
      id: 1,
      title: "Organizar a mudança",
      completedPct: 50,
      subtasks: [
        { id: 1, title: "Listar caixas", done: true },
        { id: 2, title: "Separar documentos", done: false },
      ],
    }).progressLabel).toBe("1 movimento concluído");

    expect(buildGoalCardModel({
      id: 2,
      title: "Finalizar curso",
      completedPct: 100,
      subtasks: [{ id: 3, title: "Enviar atividade", done: true }],
    }).progressLabel).toBe("Resultado alcançado");
  });

  it("pauses and resumes a goal without removing its id from the product data", () => {
    expect(togglePausedGoalId([], 7)).toEqual(["7"]);
    expect(togglePausedGoalId(["7", "9"], 7)).toEqual(["9"]);
    expect(parsePausedGoalIds('["7",9,null,"7"]')).toEqual(["7", "9"]);
    expect(parsePausedGoalIds("not-json")).toEqual([]);
  });

  it("builds a real task schedule from an explicit placement choice", () => {
    // The helper intentionally follows the user's browser timezone. Build the
    // fixture as local civil time so the assertion means the same thing in CI.
    const now = new Date(2026, 6, 26, 14, 17, 0);

    expect(buildGoalTaskSchedule("now", now)).toEqual({
      date: "2026-07-26",
      time: "14:30",
    });
    expect(buildGoalTaskSchedule("later", now)).toEqual({
      date: "2026-07-26",
      time: "18:00",
    });
    expect(buildGoalTaskSchedule("tomorrow", now)).toEqual({
      date: "2026-07-27",
      time: "09:00",
    });
  });

  it("never places the later option in a time that has already passed", () => {
    const lateNight = new Date(2026, 6, 26, 23, 40, 0);

    expect(buildGoalTaskSchedule("later", lateNight)).toEqual({
      date: "2026-07-27",
      time: "09:00",
    });
  });
});

describe("selectFocusGoal", () => {
  const goal = (id: string, done: number, total: number, completedPct?: number) => ({
    id,
    title: `Objetivo ${id}`,
    completedPct: completedPct ?? Math.round((done / Math.max(total, 1)) * 100),
    subtasks: Array.from({ length: total }, (_, index) => ({
      id: `${id}-${index}`,
      title: `Ação ${index}`,
      done: index < done,
      order: index,
    })),
  });

  it("põe em foco o objetivo mais perto de fechar", () => {
    const { focus, others } = selectFocusGoal([goal("a", 1, 4), goal("b", 3, 4), goal("c", 0, 4)]);

    expect(focus?.id).toBe("b");
    // Todos os demais continuam na lista, inclusive os menos avançados.
    expect(others.map((model) => model.id).sort()).toEqual(["a", "c"]);
  });

  it("ignora pausados, concluídos e quem não tem ação pendente", () => {
    const pausado = goal("pausado", 3, 4);
    const concluido = goal("concluido", 4, 4, 100);
    const semAcao = { id: "vazio", title: "Sem ações", completedPct: 0, subtasks: [] };
    const elegivel = goal("ok", 1, 4);

    const { focus } = selectFocusGoal([pausado, concluido, semAcao, elegivel], { pausedIds: ["pausado"] });

    expect(focus?.id).toBe("ok");
  });

  it("devolve foco nulo quando não há objetivo elegível", () => {
    const { focus, others } = selectFocusGoal([goal("feito", 4, 4, 100)]);

    expect(focus).toBeNull();
    // O concluído não some da tela — ele sai do card grande, não da lista.
    expect(others).toHaveLength(1);
  });

  it("passa o foco adiante quando o objetivo em destaque conclui", () => {
    const antes = selectFocusGoal([goal("a", 3, 4), goal("b", 1, 4)]);
    expect(antes.focus?.id).toBe("a");

    // Mesma lista, com "a" agora fechado — o seguinte assume sem estado salvo.
    const depois = selectFocusGoal([goal("a", 4, 4, 100), goal("b", 1, 4)]);
    expect(depois.focus?.id).toBe("b");
  });
});
