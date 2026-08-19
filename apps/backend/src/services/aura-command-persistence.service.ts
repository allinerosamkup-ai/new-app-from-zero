import type { PrismaClient } from '@app/database';
import { Prisma } from '@prisma/client';

import {
  AuraCommandOperationSchema,
  type AuraCommandPlan,
  type AuraCommandPlanPatch,
} from '../contracts/aura-command-plan.contract';

export class AuraCommandPersistenceService {
  static async createSession(input: {
    prisma: PrismaClient;
    userId: string;
    locale: string;
    timezone: string;
  }) {
    return input.prisma.auraCommandSession.create({
      data: {
        userId: input.userId,
        locale: input.locale,
        timezone: input.timezone,
      },
    });
  }

  static async appendMessage(input: {
    prisma: PrismaClient;
    userId: string;
    sessionId: string;
    role: 'user' | 'assistant';
    content: string;
  }) {
    const session = await input.prisma.auraCommandSession.findFirst({
      where: { id: input.sessionId, userId: input.userId, status: 'active' },
      select: { id: true },
    });
    if (!session) throw new Error('Sessão da Airia não encontrada ou encerrada.');
    const message = await input.prisma.auraCommandMessage.create({
      data: {
        userId: input.userId,
        sessionId: input.sessionId,
        role: input.role,
        content: input.content,
      },
    });
    await input.prisma.auraCommandSession.update({
      where: { id: input.sessionId },
      data: { updatedAt: new Date() },
    });
    return message;
  }

  static async persistPlan(input: {
    prisma: PrismaClient;
    userId: string;
    plan: AuraCommandPlan;
  }) {
    return input.prisma.auraCommandPlan.create({
      data: {
        id: input.plan.id,
        userId: input.userId,
        sessionId: input.plan.sessionId,
        sourceMessageId: input.plan.sourceMessageId,
        status: input.plan.status,
        executionPolicy: input.plan.executionPolicy,
        confidence: input.plan.confidence,
        assistantMessage: input.plan.assistantMessage,
        missingFields: input.plan.missingFields,
        operations: {
          create: input.plan.operations.map((operation) => ({
            userId: input.userId,
            clientOperationId: operation.id,
            type: operation.type,
            status: operation.status,
            selected: operation.selected,
            payload: operation.payload as any,
          })),
        },
      },
      include: { operations: { orderBy: { createdAt: 'asc' } } },
    });
  }

  static async getSession(input: {
    prisma: PrismaClient;
    userId: string;
    sessionId: string;
  }) {
    return input.prisma.auraCommandSession.findFirst({
      where: { id: input.sessionId, userId: input.userId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        plans: {
          orderBy: { createdAt: 'asc' },
          include: { operations: { orderBy: { createdAt: 'asc' } } },
        },
      },
    });
  }

  static async updatePlan(input: {
    prisma: PrismaClient;
    userId: string;
    planId: string;
    changes: AuraCommandPlanPatch['operations'];
  }) {
    const plan = await input.prisma.auraCommandPlan.findFirst({
      where: { id: input.planId, userId: input.userId },
      include: { operations: { orderBy: { createdAt: 'asc' } } },
    });
    if (!plan) throw new Error('Plano de comando não encontrado.');
    if (plan.status === 'applied' || plan.status === 'applying') {
      throw new Error('Um plano já aplicado não pode ser alterado.');
    }

    await input.prisma.$transaction(async (tx) => {
      for (const change of input.changes) {
        const row = plan.operations.find((operation) =>
          operation.clientOperationId === change.id || operation.id === change.id);
        if (!row) throw new Error(`Ação ${change.id} não encontrada neste plano.`);
        if (row.status === 'applied') throw new Error('Uma ação já aplicada não pode ser alterada.');

        const validated = AuraCommandOperationSchema.parse({
          id: row.clientOperationId,
          type: row.type,
          status: 'proposed',
          selected: change.selected ?? row.selected,
          payload: change.payload ?? row.payload,
        });
        await tx.auraCommandOperation.update({
          where: { id: row.id },
          data: {
            selected: validated.selected,
            payload: validated.payload as any,
            status: 'proposed',
            error: Prisma.DbNull,
          },
        });
      }
      await tx.auraCommandPlan.update({
        where: { id: plan.id },
        data: { status: 'proposed', appliedAt: null },
      });
    });

    const updated = await input.prisma.auraCommandPlan.findFirst({
      where: { id: input.planId, userId: input.userId },
      include: { operations: { orderBy: { createdAt: 'asc' } } },
    });
    if (!updated) throw new Error('Plano de comando não encontrado após a atualização.');
    return updated;
  }
}
