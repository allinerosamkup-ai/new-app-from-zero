import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ObjectivePathConflictError, ObjectivePathService } from './objective-path.service';

function repository(seed: Record<string, any>) {
  const objective = structuredClone(seed);
  const events: any[] = [];
  return {
    objective,
    events,
    prisma: {
      objective: {
        findFirst: async ({ where }: any) => (
          objective.id === where.id && objective.userId === where.userId ? structuredClone(objective) : null
        ),
        updateMany: async ({ where, data }: any) => {
          if (objective.id !== where.id || objective.userId !== where.userId) return { count: 0 };
          if (where.pathVersion !== undefined && objective.pathVersion !== where.pathVersion) return { count: 0 };
          for (const [key, value] of Object.entries(data)) {
            if (value && typeof value === 'object' && 'increment' in value) {
              objective[key] += (value as any).increment;
            } else {
              objective[key] = structuredClone(value);
            }
          }
          return { count: 1 };
        },
      },
      eventLog: { create: async ({ data }: any) => { events.push(structuredClone(data)); return data; } },
      $transaction: async (operation: any) => operation({
        objective: {
          updateMany: async ({ where, data }: any) => {
            if (where.pathVersion !== undefined && objective.pathVersion !== where.pathVersion) return { count: 0 };
            for (const [key, value] of Object.entries(data)) {
              if (value && typeof value === 'object' && 'increment' in value) objective[key] += (value as any).increment;
              else objective[key] = structuredClone(value);
            }
            return { count: 1 };
          },
        },
        eventLog: { create: async ({ data }: any) => { events.push(structuredClone(data)); return data; } },
      }),
    } as any,
  };
}

const baseObjective = {
  id: 'goal-1', userId: 'user-1', title: 'Conquistar a primeira cliente', description: 'Tenho portfólio e Instagram',
  progress: 0, archived: false, pausedAt: null, deadline: null, resultDefinition: null, currentReality: null,
  milestones: [], subgoals: [], pathVersion: 1, pathProposal: null, pathProposalCreatedAt: null,
  pathStatus: 'not_started', pathQuestion: null,
};

describe('ObjectivePathService', () => {
  it('persiste caminho estruturado e somente as ações da etapa atual', async () => {
    const state = repository(baseObjective);
    let projected: any = null;
    const service = new ObjectivePathService(state.prisma, async () => ({
      mode: 'actions',
      resultDefinition: 'Uma cliente contratou o serviço',
      currentReality: 'Já existe portfólio e canal no Instagram',
      currentMilestoneId: 'm-1',
      assumptions: [], question: null, rejectedSteps: [],
      milestones: [
        { id: 'm-1', title: 'Apresentar o trabalho', order: 0, doneWhen: 'Perfil claro', actions: [
          { title: 'Selecionar três trabalhos de noiva do portfólio', basedOn: 'stated', doneWhen: 'Três trabalhos separados', effortSize: 'medium', evidenceRefs: ['objective:description'] },
        ] },
        { id: 'm-2', title: 'Abrir conversas', order: 1, doneWhen: 'Conversas reais iniciadas', actions: [] },
      ],
      steps: [{ title: 'Selecionar três trabalhos de noiva do portfólio', basedOn: 'stated', milestoneId: 'm-1', doneWhen: 'Três trabalhos separados', effortSize: 'medium', evidenceRefs: ['objective:description'] }],
    }), async (_transaction, snapshot, source) => { projected = { snapshot, source }; });

    const result = await service.generate({ userId: 'user-1', objectiveId: 'goal-1', locale: 'pt-BR', userStatements: ['Tenho portfólio e Instagram'] });

    assert.equal(result.status, 'ready');
    assert.equal(state.objective.pathVersion, 2);
    assert.equal(state.objective.subgoals.length, 1);
    assert.equal(state.objective.subgoals[0].milestoneId, 'm-1');
    assert.equal(state.objective.milestones[1].actions.length, 0);
    assert.equal(state.events[0].eventName, 'objective_path_generated');
    assert.equal(projected.source, 'objective_path_generated');
    assert.equal(projected.snapshot.pathVersion, 2);
    assert.equal(projected.snapshot.subgoals[0].milestoneId, 'm-1');
  });

  it('preserva o objetivo e guarda uma pergunta decisiva quando não há caminho válido', async () => {
    const state = repository(baseObjective);
    const service = new ObjectivePathService(state.prisma, async () => ({
      mode: 'question', resultDefinition: null, currentReality: null, currentMilestoneId: null,
      milestones: [], assumptions: [], steps: [], question: 'Hoje o principal problema é dívida, gasto mensal ou falta de controle?',
    }));

    const result = await service.generate({ userId: 'user-1', objectiveId: 'goal-1', locale: 'pt-BR' });

    assert.equal(result.status, 'needs_answer');
    assert.equal(state.objective.subgoals.length, 0);
    assert.match(state.objective.pathQuestion, /dívida/);
    assert.equal(state.objective.pathStatus, 'needs_answer');
  });

  it('obriga proposta de revisão quando já existe ação concluída ou editada pela pessoa', async () => {
    const state = repository({
      ...baseObjective,
      pathStatus: 'ready',
      subgoals: [{ id: 'manual-1', title: 'Texto escolhido pela pessoa', done: false, order: 0, userEdited: true }],
    });
    let generated = false;
    const service = new ObjectivePathService(state.prisma, async () => {
      generated = true;
      throw new Error('não deveria gerar');
    });

    await assert.rejects(
      () => service.generate({ userId: 'user-1', objectiveId: 'goal-1', locale: 'pt-BR' }),
      (error: unknown) => error instanceof ObjectivePathConflictError && error.message === 'revision_requires_proposal',
    );
    assert.equal(generated, false);
    assert.equal(state.objective.subgoals[0].title, 'Texto escolhido pela pessoa');
  });

  it('preserva histórico e etapa vigente mesmo quando a revisão ocorre depois do primeiro marco', async () => {
    const seeded = {
      ...baseObjective,
      pathVersion: 4,
      pathStatus: 'ready',
      milestones: [
        { id: 'm-done', title: 'Etapa concluída', order: 0, doneWhen: 'Concluída', actions: [] },
        { id: 'm-current', title: 'Etapa atual', order: 1, doneWhen: 'Atual concluída', actions: [] },
        { id: 'm-future', title: 'Etapa antiga', order: 2, doneWhen: 'Antiga concluída', actions: [] },
      ],
      subgoals: [
        { id: 'done-1', title: 'Ação já concluída', done: true, order: 0, milestoneId: 'm-done', aiGenerated: true },
        { id: 'manual-1', title: 'Ação ajustada por mim', done: false, order: 1, milestoneId: 'm-current', aiGenerated: true, userEdited: true },
      ],
    };
    const state = repository(seeded);
    const service = new ObjectivePathService(state.prisma, async () => ({
      mode: 'actions', resultDefinition: 'Novo resultado', currentReality: 'Novo contexto', currentMilestoneId: 'new-1',
      assumptions: [], question: null, rejectedSteps: [], steps: [],
      milestones: [
        { id: 'new-1', title: 'Etapa gerada atual', order: 0, doneWhen: 'Gerada', actions: [] },
        { id: 'new-2', title: 'Nova etapa futura', order: 1, doneWhen: 'Nova concluída', actions: [] },
      ],
    }));

    const proposal = await service.proposeRevision({ userId: 'user-1', objectiveId: 'goal-1', locale: 'pt-BR', reason: 'Agora o canal disponível mudou' });
    assert.equal(state.objective.pathVersion, 4, 'propor não altera a versão confirmada');
    assert.equal(proposal.proposal.baseVersion, 4);
    assert.deepEqual(proposal.proposal.milestones.map((milestone) => milestone.id), ['m-done', 'm-current', 'new-2']);
    assert.equal(proposal.proposal.milestones[2].title, 'Nova etapa futura');
    assert.equal(state.objective.subgoals[1].title, 'Ação ajustada por mim');
    assert.equal(state.objective.subgoals[0].done, true);

    state.objective.pathVersion = 5;
    await assert.rejects(
      () => service.confirmRevision({ userId: 'user-1', objectiveId: 'goal-1', expectedVersion: 4 }),
      (error: unknown) => error instanceof ObjectivePathConflictError,
    );
  });

  it('renomeia etapas futuras geradas quando a IA repete um id preservado', async () => {
    const state = repository({
      ...baseObjective,
      pathVersion: 5,
      pathStatus: 'ready',
      milestones: [
        { id: 'm-1', title: 'Etapa concluída', order: 0, doneWhen: 'Concluída', actions: [] },
        { id: 'm-2', title: 'Etapa atual', order: 1, doneWhen: 'Atual concluída', actions: [] },
      ],
      subgoals: [
        { id: 'done-1', title: 'Ação concluída', done: true, order: 0, milestoneId: 'm-1', aiGenerated: true },
        { id: 'current-1', title: 'Ação vigente', done: false, order: 1, milestoneId: 'm-2', aiGenerated: true },
      ],
    });
    const service = new ObjectivePathService(state.prisma, async () => ({
      mode: 'actions', resultDefinition: 'Novo resultado', currentReality: 'Novo contexto', currentMilestoneId: 'generated-current',
      assumptions: [], question: null, rejectedSteps: [], steps: [],
      milestones: [
        { id: 'generated-current', title: 'Atual gerada', order: 0, doneWhen: 'Atual', actions: [] },
        { id: 'm-2', title: 'Etapa futura com id repetido', order: 1, doneWhen: 'Futura', actions: [] },
        { id: 'm-2', title: 'Outra etapa futura com id repetido', order: 2, doneWhen: 'Outra futura', actions: [] },
      ],
    }));

    const result = await service.proposeRevision({
      userId: 'user-1', objectiveId: 'goal-1', locale: 'pt-BR', reason: 'A limitação central mudou',
    });
    const ids = result.proposal.milestones.map((milestone) => milestone.id);

    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(ids.slice(0, 2), ['m-1', 'm-2']);
  });

  it('abre a próxima etapa somente após confirmação e preserva todo histórico', async () => {
    const state = repository({
      ...baseObjective, pathVersion: 7, pathStatus: 'ready', progress: 50,
      milestones: [
        { id: 'm-1', title: 'Etapa concluída', order: 0, doneWhen: 'Concluída', actions: [] },
        { id: 'm-2', title: 'Abrir conversas', order: 1, doneWhen: 'Conversas iniciadas', actions: [] },
      ],
      subgoals: [{ id: 'done-1', title: 'Selecionar trabalhos', done: true, order: 0, milestoneId: 'm-1', aiGenerated: true }],
    });
    const service = new ObjectivePathService(state.prisma, async () => ({
      mode: 'actions', resultDefinition: 'Conversas reais iniciadas', currentReality: 'A primeira etapa já foi concluída',
      currentMilestoneId: 'generated', assumptions: [], question: null, rejectedSteps: [],
      milestones: [{ id: 'generated', title: 'Abrir conversas', order: 0, doneWhen: 'Conversas iniciadas', actions: [
        { title: 'Publicar um trabalho de noiva no Instagram', basedOn: 'stated', milestoneId: 'generated', doneWhen: 'Publicação visível' },
      ] }],
      steps: [{ title: 'Publicar um trabalho de noiva no Instagram', basedOn: 'stated', milestoneId: 'generated', doneWhen: 'Publicação visível' }],
    }));

    const result = await service.advance({ userId: 'user-1', objectiveId: 'goal-1', expectedVersion: 7, locale: 'pt-BR' });

    assert.equal(result.status, 'ready');
    assert.equal(state.objective.subgoals[0].id, 'done-1');
    assert.equal(state.objective.subgoals[0].done, true);
    assert.equal(state.objective.subgoals[1].milestoneId, 'm-2');
    assert.equal(state.objective.pathVersion, 8);
  });
});
