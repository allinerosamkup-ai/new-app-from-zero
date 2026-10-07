// Isolated browser integration: synthetic auth, repository and IA. Never production.
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../../..');
// index.js calls dotenv.config({ override:true }); block all dotenv loading in
// this fixture process before importing it, including transitive imports.
const dotenv = require(require.resolve('dotenv', { paths: [path.join(root, 'apps/backend')] }));
dotenv.config = () => ({ parsed: {} });
process.env.DATABASE_URL = 'postgresql://fixture:fixture@127.0.0.1:1/fixture';
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.OPENAI_API_KEY = '';
process.env.ANTHROPIC_API_KEY = '';
process.env.GOOGLE_API_KEY = '';
process.env.GEMINI_API_KEY = '';
process.env.SUPABASE_URL = 'http://127.0.0.1:4291';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
// Fail closed on accidental provider/remote transport from this Node process.
const localOnly = target => {
  const url = typeof target === 'string' || target instanceof URL ? new URL(target) : new URL(`http://${target.hostname ?? target.host ?? 'localhost'}`);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Fixture blocked non-loopback transport');
};
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, ...args) => { localOnly(input?.url ?? input); return originalFetch(input, ...args); };
for (const protocol of ['node:http', 'node:https']) {
  const transport = require(protocol);
  for (const method of ['request', 'get']) {
    const original = transport[method];
    transport[method] = function (target, ...args) { localOnly(target); return original.call(this, target, ...args); };
  }
}
process.env.VITE_SUPABASE_URL = 'http://127.0.0.1:4291';
process.env.VITE_SUPABASE_ANON_KEY = 'synthetic-public-fixture';
process.env.VITE_API_URL = 'http://127.0.0.1:4291/api';
const express = require(path.join(root, 'node_modules/express'));
const { createApp } = require(path.join(root, 'apps/backend/dist/index.js'));
const fixtureProvidersBlank = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].every(key => process.env[key] === '');
const fixtureBrowserLocal = process.env.VITE_SUPABASE_URL === 'http://127.0.0.1:4291' && process.env.VITE_API_URL === 'http://127.0.0.1:4291/api' && process.env.SUPABASE_URL === 'http://127.0.0.1:4291';
if (process.env.DATABASE_URL !== 'postgresql://fixture:fixture@127.0.0.1:1/fixture' || process.env.DIRECT_URL !== process.env.DATABASE_URL || !fixtureProvidersBlank || !fixtureBrowserLocal) throw new Error('Fixture isolation assertion failed');
console.log('FIXTURE_ISOLATION_PASS db_loopback_closed_port=true provider_blank=true remote_http_blocked=true');
const userId = '550e8400-e29b-41d4-a716-446655440000';
const traffic = [], goals = [];
const oldDay = new Date(Date.now() - 12 * 86400000).toISOString().slice(0, 10);
let rows = [{ id: 'fixture-checkin', userId, localDate: oldDay, recordedAt: `${oldDay}T15:00:00Z`, moodScore: 5, energyScore: 6, factors: [], emotions: [] }];
let mode = 'old';
const preference = { fullName: 'Pessoa Sintética', timezone: 'America/Sao_Paulo', biologicalSex: 'prefer_not_to_say', notificationPreferences: {} };
const syntheticUser = { id: userId, email: 'fixture@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { full_name: 'Pessoa Sintética' }, created_at: '2025-01-01T00:00:00Z' };
const syntheticSession = () => {
  const exp = Math.floor(Date.now()/1000)+86400;
  const b64 = data => Buffer.from(JSON.stringify(data)).toString('base64url');
  return { access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: userId, aud: 'authenticated', role: 'authenticated', exp })}.synthetic-signature`, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_at: exp, expires_in: 86400, user: syntheticUser };
};
const api = express();
api.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://127.0.0.1:4290'); res.header('Access-Control-Allow-Headers', '*'); res.header('Access-Control-Allow-Methods', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  traffic.push({ method: req.method, path: req.url }); next();
});
api.use(express.json());
api.get('/auth/v1/user', (_, res) => res.json(syntheticUser));
api.post('/auth/v1/token', (_, res) => res.json(syntheticSession()));
api.post('/auth/v1/logout', (_, res) => res.sendStatus(204));
api.get('/rest/v1/profiles', (_, res) => res.json({ onboarding_done: true, created_at: '2025-01-01T00:00:00Z', cycle_start: null, cycle_length: null, luteal_length: null }));
api.get('/api/preferences', (_, res) => res.json(preference));
api.get('/api/checkins', (_, res) => mode === 'error' ? res.status(503).json({ error: 'Synthetic transport unavailable' }) : res.json(mode === 'empty' ? [] : rows));
api.get('/api/objectives', (_, res) => res.json(goals));
// Only goal preview/create transport is real under test; ancillary Home reads are explicit fixtures.
api.get('/api/progress', (_, res) => res.json({ level: 1, totalXp: 0, counters: { actionsCompleted: 0, goalsCompleted: 0 }, streak: { current: 0, isProtectedToday: false } }));
api.get('/api/jornada', (_, res) => res.json({ steps: [], completedCount: 0, totalCount: 13 }));
api.get('/api/daily-priorities', (_, res) => res.json({ status: 'ready', focus: null, priorities: [], canWait: [] }));
api.get('/api/airia/reading', (_, res) => res.json({ version: 'v1', generatedAt: new Date().toISOString(), currentState: { phase: 'Estável', observedAt: `${oldDay}T15:00:00Z`, moodScore: 5, energyScore: 6 }, period: { observedDays: mode === 'empty' ? 0 : 1, confidence: 0.1 }, alerts: [], riskSafety: { riskLevel: 'none', route: 'self_support', signals: [] }, decision: null }));
api.post('/api/ai/suggest', (_, res) => res.status(503).json({ error: 'Synthetic suggestion unavailable; no provider' }));
api.post('/api/events', (_, res) => res.json({ ok: true }));
api.post('/api/events/product', (_, res) => res.json({ ok: true }));
api.get('/fixture/evidence', (_, res) => res.json({ declaration: 'synthetic in-memory fixture, no private DB/provider', mode, rows, goals, traffic }));
api.post('/fixture/mode', (req, res) => { mode = req.body.mode ?? 'old'; res.json({ mode }); });
const prisma = {
  userPreference: { findUnique: async () => preference },
  dailyCheckin: { findMany: async () => rows, findFirst: async () => rows[0] ?? null },
  objective: {
    findMany: async () => goals,
    findFirst: async ({ where } = {}) => goals.find(item => !where?.id || item.id === where.id) ?? null,
    create: async ({ data }) => { const item = { ...data, id: `770e8400-e29b-41d4-a716-${String(goals.length + 1).padStart(12, '0')}`, archived: false, progress: 0, pathVersion: 1, createdAt: new Date(), updatedAt: new Date() }; goals.push(item); return item; },
  },
  journalMessage: { findMany: async () => [] }, auraCommandMessage: { findMany: async () => [] },
  eventLog: { findMany: async () => [] }, userMemory: { findMany: async () => [] }, onboardingResponse: { findUnique: async () => null },
};
api.use(createApp({ prisma,
  authMiddleware: (req, _, next) => { req.userId = userId; next(); },
  memoryService: { store: async () => {}, retrieve: async () => [], formatForPrompt: () => '', deleteAll: async () => {} },
  goalDecompose: async () => ({ mode: 'actions', resultDefinition: 'Três tópicos escritos', currentReality: 'Sem tópicos ainda', currentMilestoneId: 'm1', assumptions: [], question: null, milestones: [{ id: 'm1', title: 'Preparar', order: 0, doneWhen: 'Tópicos prontos', actions: [{ title: 'Escrever três tópicos QA', basedOn: 'stated', doneWhen: 'Três tópicos no documento', effortSize: 'small' }] }], steps: [{ title: 'Escrever três tópicos QA', basedOn: 'stated', doneWhen: 'Três tópicos no documento', effortSize: 'small' }] }),
}));
api.listen(4291, '127.0.0.1');
(async () => {
  const viteEntry = require.resolve('vite', { paths: [path.join(root, 'apps/web')] });
  const { createServer } = await import(pathToFileURL(path.join(path.dirname(viteEntry), 'dist/node/index.js')).href);
  const server = await createServer({ root: path.join(root, 'apps/web'), server: { host: '127.0.0.1', port: 4290, strictPort: true }, plugins: [{ name: 'browser-total-isolated-bootstrap', configureServer(vite) {
    vite.middlewares.use('/fixture-start', (req, res) => {
      const params = new URL(req.url, 'http://fixture').searchParams;
      const lang = params.get('lang') === 'en' ? 'en' : 'pt';
      const route = params.get('route') === 'goals' ? '/goals' : '/home';
      const session = syntheticSession();
      res.setHeader('Content-Type', 'text/html');
      res.end(`<p>Isolated synthetic browser fixture</p><script>localStorage.clear();localStorage.setItem('sb-127-auth-token', ${JSON.stringify(JSON.stringify(session))});localStorage.setItem('airia_lang','${lang}');location.replace('${route}?lang=${lang}');</script>`);
    });
  } }] });
  await server.listen(); console.log('ISOLATED_BROWSER_READY http://127.0.0.1:4290/fixture-start?lang=pt');
})().catch(error => { console.error(error); process.exit(1); });
