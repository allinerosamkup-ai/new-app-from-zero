// Isolated UI evidence only. Synthetic auth/repository; no external provider or database.
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../../..');
process.env.DATABASE_URL = 'postgresql://fixture:fixture@127.0.0.1:1/fixture';
process.env.OPENAI_API_KEY = '';
process.env.VITE_SUPABASE_URL = 'http://127.0.0.1:4191';
process.env.VITE_SUPABASE_ANON_KEY = 'synthetic-public-fixture';
process.env.VITE_API_URL = 'http://127.0.0.1:4191/api';
const express = require(path.join(root, 'node_modules/express'));
// Run after the current backend build; never alias application code from a worktree.
const { createApp } = require(path.join(root, 'apps/backend/dist/index.js'));
const { CheckinApplicationService } = require(path.join(root, 'apps/backend/dist/services/checkin-application.service.js'));
const userId = '550e8400-e29b-41d4-a716-446655440000';
const rows = [];
const traffic = [];
let failure = 'analysis';
const repository = {
  findByIdempotency: async (_, key) => rows.find(row => row.idempotencyKey === key) ?? null,
  upsertBySlot: async input => {
    if (failure === 'write') throw new Error('synthetic write unavailable');
    let row = rows.find(row => row.checkinSlot === input.checkinSlot);
    if (!row) { row = { id: `fixture-${rows.length + 1}`, createdAt: new Date() }; rows.unshift(row); }
    Object.assign(row, input, { factors: input.factors ?? [], emotions: input.emotions ?? [], stateLabel: null, stateLabelType: null, stateSummary: null });
    return { ...row };
  },
  updateEvaluation: async (id, evaluation) => {
    const row = rows.find(row => row.id === id);
    Object.assign(row, evaluation);
    return { ...row };
  },
};
const service = new CheckinApplicationService({ repository, evaluate: async () => { throw new Error('synthetic analysis unavailable'); } });
const preference = { fullName: 'Pessoa Sintética', timezone: 'America/Sao_Paulo', biologicalSex: 'prefer_not_to_say', notificationPreferences: {} };
const staleReading = {
  version: 'v1', generatedAt: new Date(Date.now() - 3600000).toISOString(),
  currentState: { phase: 'Retomada', observedAt: new Date(Date.now() - 3600000).toISOString(), moodScore: 8, energyScore: 8 },
  period: { observedDays: 8, confidence: 0.8 }, alerts: [],
  riskSafety: { riskLevel: 'none', route: 'self_support', signals: [] },
  decision: { id: 'stale-decision', status: 'proposed', title: 'STALE FIXTURE DECISION MUST NOT APPEAR', reason: 'Old synthetic reading', requiresConfirmation: true },
};
const api = express();
api.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://127.0.0.1:4190');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  traffic.push({ method: req.method, path: req.url }); next();
});
api.use(express.json());
api.get('/rest/v1/profiles', (_, res) => res.json({ onboarding_done: true, created_at: '2025-01-01T00:00:00Z', cycle_start: null, cycle_length: null, luteal_length: null }));
api.get('/api/preferences', (_, res) => res.json(preference));
api.get('/api/objectives', (_, res) => res.json([]));
api.post('/api/events', (_, res) => res.json({ ok: true }));
api.post('/api/events/product', (_, res) => res.json({ ok: true }));
// Adjacent diary transport is synthetic; only Check-in POST/GET are under test.
api.post('/api/journal/external-message', (_, res) => res.json({ ok: true }));
api.get('/fixture/evidence', (_, res) => res.json({ declaration: 'synthetic in-memory fixture; no production writes', rows, traffic }));
api.post('/fixture/mode', (req, res) => { failure = req.body.failure ?? 'analysis'; res.json({ failure }); });
api.use(createApp({
  prisma: { userPreference: { findUnique: async () => preference }, dailyCheckin: { findMany: async () => rows } },
  authMiddleware: (req, _, next) => { req.userId = userId; next(); },
  checkinApplicationService: service,
  airiaReadingService: { rebuild: async () => staleReading, get: async () => staleReading, feedback: async () => staleReading },
}));
api.listen(4191, '127.0.0.1');
(async () => {
  const viteEntry = require.resolve('vite', { paths: [path.join(root, 'apps/web')] });
  const viteEsm = path.join(path.dirname(viteEntry), 'dist/node/index.js');
  const { createServer } = await import(pathToFileURL(viteEsm).href);
  const server = await createServer({ root: path.join(root, 'apps/web'), server: { host: '127.0.0.1', port: 4190, strictPort: true }, plugins: [{
    name: 'isolated-integration-bootstrap', configureServer(vite) {
      vite.middlewares.use('/fixture-start', (req, res) => {
        const lang = new URL(req.url, 'http://fixture').searchParams.get('lang') === 'en' ? 'en' : 'pt';
        const session = { access_token: 'synthetic-fixture-token', refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 86400, user: { id: userId, email: 'fixture@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { full_name: 'Pessoa Sintética' }, created_at: '2025-01-01T00:00:00Z' } };
        res.setHeader('Content-Type', 'text/html');
        res.end(`<p>Synthetic isolated integration fixture</p><script>localStorage.setItem('sb-127-auth-token', ${JSON.stringify(JSON.stringify(session))});localStorage.setItem('airia_lang', '${lang}');location.replace('/checkin?lang=${lang}');</script>`);
      });
    },
  }] });
  await server.listen();
  console.log('ISOLATED_UI_READY http://127.0.0.1:4190/fixture-start?lang=pt');
})().catch(error => { console.error(error); process.exit(1); });
