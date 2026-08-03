/**
 * Registro de consentimento (LGPD Art. 8 §1).
 *
 * A lei põe o ônus da prova no controlador: não basta ter mostrado a política,
 * é preciso conseguir demonstrar que a pessoa consentiu, quando, e com qual
 * versão do texto. A tabela `Consent` existia no schema e era exportada em
 * `/api/privacy/export` desde sempre — mas nada nunca a escrevia, então ela
 * chegava vazia em todo export. Este serviço fecha esse buraco.
 *
 * O momento do registro é o primeiro acesso autenticado: a pessoa só chega ali
 * depois de passar pela tela de cadastro, que exibe Termos e Política. Gravar
 * antes disso registraria consentimento de quem nunca entrou.
 */

/** Versão vigente dos documentos. Subir aqui exige novo aceite de todos. */
export const CURRENT_CONSENT_VERSION = 'v1';

export const CONSENT_TYPES = ['privacy_policy', 'terms_of_use'] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

type ConsentRecord = {
  consentType: string;
  granted: boolean;
  version: string;
  grantedAt: Date | null;
  revokedAt: Date | null;
};

type ConsentCreateData = {
  userId: string;
  consentType: string;
  version: string;
  granted: boolean;
  grantedAt: Date;
};

/**
 * Tipos estruturais, um por operação, em vez de importar os do Prisma: o
 * serviço fica testável com um repositório de mentira e cada função declara só
 * o que de fato usa. A leitura do histórico não passa por aqui — o endpoint
 * chama `prisma.consent.findMany` direto, sem intermediário que não agrega.
 */
type ConsentUpsertRepository = {
  upsert(args: {
    where: { userId_consentType_version: { userId: string; consentType: string; version: string } };
    update: Record<string, never>;
    create: ConsentCreateData;
  }): Promise<unknown>;
};

type ConsentRevokeRepository = {
  updateMany(args: {
    where: { userId: string; consentType: string; granted: boolean; revokedAt: null };
    data: { granted: boolean; revokedAt: Date };
  }): Promise<{ count: number }>;
};

/**
 * Idempotente por (userId, consentType, version) — a constraint única do schema
 * garante isso no banco, e o `update: {}` garante que reexecutar não sobrescreve
 * a data original. Registrar de novo não reescreve a prova.
 */
export async function recordInitialConsents(
  consentRepository: ConsentUpsertRepository,
  userId: string,
  now: Date,
): Promise<void> {
  for (const consentType of CONSENT_TYPES) {
    await consentRepository.upsert({
      where: {
        userId_consentType_version: { userId, consentType, version: CURRENT_CONSENT_VERSION },
      },
      // Vazio de propósito: a data do primeiro aceite é o dado com valor legal.
      update: {},
      create: {
        userId,
        consentType,
        version: CURRENT_CONSENT_VERSION,
        granted: true,
        grantedAt: now,
      },
    });
  }
}

/**
 * Revogação (LGPD Art. 8 §5 e Art. 18 §1). Não apaga o registro: marca a
 * revogação e preserva o histórico, porque apagar destruiria justamente a prova
 * de que houve consentimento no período anterior.
 *
 * Revogar a política de privacidade não apaga os dados por si — quem faz isso é
 * `/api/privacy/delete-request`, que continua sendo o caminho de exclusão.
 */
export async function revokeConsent(
  consentRepository: ConsentRevokeRepository,
  userId: string,
  consentType: ConsentType,
  now: Date,
): Promise<number> {
  const result = await consentRepository.updateMany({
    where: { userId, consentType, granted: true, revokedAt: null },
    data: { granted: false, revokedAt: now },
  });
  return result.count;
}

export function summarizeConsents(records: ConsentRecord[]) {
  return records.map((record) => ({
    type: record.consentType,
    version: record.version,
    granted: record.granted,
    grantedAt: record.grantedAt?.toISOString() ?? null,
    revokedAt: record.revokedAt?.toISOString() ?? null,
  }));
}
