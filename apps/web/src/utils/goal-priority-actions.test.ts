import { describe, expect, it } from "vitest";
import {
  buildGoalCardModel,
  buildGoalTaskSchedule,
  parsePausedGoalIds,
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
    const now = new Date("2026-07-26T14:17:00-03:00");

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
    const lateNight = new Date("2026-07-26T23:40:00-03:00");

    expect(buildGoalTaskSchedule("later", lateNight)).toEqual({
      date: "2026-07-27",
      time: "09:00",
    });
  });
});
