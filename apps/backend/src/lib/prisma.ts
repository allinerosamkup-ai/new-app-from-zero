import { PrismaClient } from '@app/database';

/**
 * O cliente Prisma do processo. Um só.
 *
 * Havia **nove** `new PrismaClient()` espalhados — `index.ts`, o middleware de
 * autenticação e sete serviços. Cada instância abre o **próprio pool**, e é
 * isso que produzia `P2024` (`Timed out fetching a new connection from the
 * connection pool`) com o banco folgado: o pool que estourava tinha 5 conexões
 * e os outros oito estavam parados segurando as delas. Não faltava banco,
 * faltava um pool só.
 *
 * ## Por que o limite era 5
 *
 * Sem `connection_limit` na URL, o Prisma calcula `núcleos × 2 + 1`. O contêiner
 * enxerga 2 CPUs, então dava 5 — número que descreve a CPU da máquina e não tem
 * relação nenhuma com quantas conexões o banco aguenta.
 *
 * ## Por que dá para subir sem medo
 *
 * `DATABASE_URL` aponta para o **pooler do Supabase** (porta 6543,
 * `pgbouncer=true`). Em modo transação o pgBouncer multiplexa: as conexões que
 * o app abre não viram conexões diretas no Postgres. O gargalo real é o app se
 * limitar sozinho, e um único `Promise.all` de cinco consultas — como o do
 * check-in — já consumia o pool inteiro.
 *
 * E o total **cai**: nove pools de 5 podiam abrir 45 conexões; um pool de 20
 * abre no máximo 20. Cada rota ganha quatro vezes mais folga enquanto o
 * processo pressiona menos o banco do que antes.
 *
 * O limite fica explícito na URL, e não no ambiente, porque o valor precisa do
 * raciocínio acima do lado. Uma URL que já traga `connection_limit` é
 * respeitada: quem configurou o ambiente sabe mais do que este arquivo.
 */

const DEFAULT_CONNECTION_LIMIT = 20;

export function resolveDatabaseUrl(
  rawUrl: string | undefined,
  connectionLimit = DEFAULT_CONNECTION_LIMIT,
): string | undefined {
  if (!rawUrl) return rawUrl;

  try {
    const url = new URL(rawUrl);
    if (url.searchParams.has('connection_limit')) return rawUrl;
    url.searchParams.set('connection_limit', String(connectionLimit));
    return url.toString();
  } catch {
    // URL malformada é problema de configuração, não deste arquivo: devolve
    // como veio para o Prisma falhar com a mensagem dele, que é mais útil.
    return rawUrl;
  }
}

const databaseUrl = resolveDatabaseUrl(process.env.DATABASE_URL);

/**
 * `globalThis` guarda a instância porque `ts-node-dev` recarrega módulos a cada
 * alteração em desenvolvimento. Sem isso, cada recarga deixaria um pool órfão e
 * o processo acabaria esgotando o banco — o oposto do que este arquivo existe
 * para resolver.
 */
const globalForPrisma = globalThis as unknown as { __airiaPrisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.__airiaPrisma
  ?? new PrismaClient(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__airiaPrisma = prisma;
}
