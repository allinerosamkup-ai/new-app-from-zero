import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../../..');

const forbiddenConsumerPatterns = [
  /VITE_AIRIA_DEMO_MODE/i,
  /\/api\/demo/i,
  /demo_mode_loaded/i,
  /Airia demo/i,
  /airia-demo/i,
  /carregar demo/i,
  /carregar demonstra[cç][aã]o/i,
  /modo demo/i,
  /produto vend[aá]vel/i,
  /prova comercial/i,
  /pitch comercial/i,
  /material de venda/i,
  /narrativa de investimento/i,
  /lista de espera/i,
  /poss[ií]vel investidor/i,
  /poss[ií]vel investidora/i,
  /\binvestidor(?:a|es|as)?\b/i,
  /O que a Airia faz/i,
];

const fakeFlowPatterns = [
  /user-temp-id/i,
  /mock user/i,
  /fake success/i,
  /coming soon/i,
  /TODO implementar/i,
  /placeholder de sucesso/i,
  /bot[aã]o morto/i,
  /navega[cç][aã]o simulada/i,
];

const unsafeClinicalClaimPatterns = [
  /\b(?:voc[eê]|voce)\s+tem\s+(?:bipolaridade|depress[aã]o|tdah|transtorno)/i,
  /\b(?:eu|n[oó]s|a\s+Airia)\s+diagnostic(?:o|amos|a)\b/i,
  /\bdiagn[oó]stico\s+da\s+Airia\b/i,
  /\b(?:cura|curar|curamos)\s+(?:sua\s+)?(?:bipolaridade|depress[aã]o|tdah|ansiedade)/i,
  /\btratamento\s+(?:da|pela)\s+Airia\b/i,
  /\b(?:sou|somos|serei|a\s+Airia\s+[eé])\s+(?:sua\s+)?(?:psic[oó]loga|terapeuta|psiquiatra)\b/i,
  /\b(?:substituo|substitu[ií]mos|a\s+Airia\s+substitui)\s+(?:psic[oó]loga|psiquiatra|terapia|emerg[eê]ncia)\b/i,
  /\bAiria\s+(?:faz|oferece|fornece)\s+terapia\b/i,
  /\bresultados?\s+cl[ií]nicos?\s+garantidos?\b/i,
  /\bmelhora\s+garantida\b/i,
];

const fabricatedUngroundedActionPatterns = [
  /fresh:morning-coffee/i,
  /fresh:morning-task/i,
  /fresh:post-lunch-admin/i,
  /fresh:night-wind/i,
  /gera sugest[aã]o de ancoragem baseada em hor[aá]rio e fase/i,
];

/**
 * Gamificação incentiva, não cobra. Copy que culpa ausência, ameaça perda ou manda
 * a pessoa voltar transforma recompensa em dívida — exatamente o que quebra o
 * público que a Airia atende.
 */
const nagginRewardCopyPatterns = [
  /voc[eê]\s+perdeu\s+(?:sua\s+)?(?:sequ[eê]ncia|streak|ofensiva)/i,
  /(?:sequ[eê]ncia|streak|ofensiva)\s+(?:perdida|quebrada|zerada)/i,
  /n[aã]o\s+desista/i,
  /voc[eê]\s+(?:falhou|fracassou|deixou\s+de)/i,
  /volte\s+(?:logo|hoje|agora)\s+(?:ou|antes)/i,
  /voc[eê]\s+(?:prometeu|devia|deveria)\s+/i,
  /sentimos\s+sua\s+falta/i,
];

/**
 * Capacidade é inferida, nunca declarada pela pessoa.
 *
 * A tela que pedia "Rápido / Moderado / Mais trabalhoso" saiu em `fb3d7e5`, mas
 * o prompt continuou dizendo ao modelo que a capacidade tinha sido "dita por
 * ela agora" — e o modelo, acreditando, respondia "como você pediu" sobre algo
 * que ninguém perguntou. Prompt que afirma origem falsa é tão grave quanto a
 * pergunta na tela: os dois transferem para a pessoa uma decisão que é da
 * Airia. Ver `PRODUCT_CONSTITUTION.md` §3.
 */
const falseCapacityProvenancePatterns = [
  /capacidade[^\n]{0,80}\((?:dita|dito|escolhida|respondida|informada|declarada)\s+(?:por\s+ela|no\s+check-?in)/i,
  /(?:capacidade|o que cabe hoje)[^\n]{0,60}(?:respondid[ao]|dit[ao]|escolhid[ao])\s+(?:no\s+check-?in|por\s+ela)/i,
];

const pseudoTherapeuticInferencePatterns = [
  /serve de escudo/i,
  /moeda de troca/i,
  /precisa existir como alibi/i,
  /ela prefere esse problema/i,
  /presuma que ela j[aá] disse/i,
];

const backendAgendaFilesWithUtcTimePolicy = [
  'apps/backend/src/services/planner.service.ts',
  'apps/backend/src/services/agenda-adaptation.service.ts',
  'apps/backend/src/services/adaptive-agenda-engine.service.ts',
];

const reviewSkillPath = 'skills/airia-pr-review/SKILL.md';
const reviewSkillRegistryPath = 'skills/_registry.md';
const reviewSkillRequiredTerms = [
  'Produto final antes de apresentacao',
  'Fluxo real sem estado falso',
  'Contratos API e erro visivel',
  'Tempo e agenda sem drift',
  'IA ancorada em contexto atual',
  'Seguranca emocional sem terapeuta falsa',
  'Higiene de release',
  '42a287f',
  'f8f7db4',
  'b8b35f2',
  'PR #3',
];

const scannedRoots = [
  'apps/web/src',
  'apps/backend/src',
];

const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.json']);
const ignoredDirs = new Set(['dist', 'node_modules', '.next', 'coverage']);

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (ignoredDirs.has(entry)) return [];
      return listFiles(fullPath);
    }

    if (!allowedExtensions.has(path.extname(entry))) return [];
    return [fullPath];
  });
}

function run() {
  const offendingMatches: string[] = [];
  const fakeFlowMatches: string[] = [];
  const unsafeClinicalMatches: string[] = [];
  const timezoneMatches: string[] = [];
  const reviewSkillMatches: string[] = [];
  const groundingGuardrailMatches: string[] = [];

  // Fixture files whose purpose is to LIST forbidden phrases (so the test
  // harness can prove the model avoids them). They are allowed to mention
  // demo/investor/pitch language as data, not as product copy.
  const fixtureAllowlist = new Set<string>([
    'apps/backend/src/lib/aura-eval/cases.ts',
  ]);

  for (const root of scannedRoots) {
    const files = listFiles(path.join(repoRoot, root));
    for (const file of files) {
      const relative = path.relative(repoRoot, file).replace(/\\/g, '/');
      if (relative === 'apps/backend/src/lib/product-guardrails.test.ts') continue;
      if (relative.endsWith('.test.ts') || relative.endsWith('.test.tsx')) continue;
      if (fixtureAllowlist.has(relative)) continue;
      const content = readFileSync(file, 'utf8');

      for (const pattern of forbiddenConsumerPatterns) {
        if (pattern.test(content)) {
          offendingMatches.push(`${relative} matches ${pattern}`);
        }
      }

      for (const pattern of fakeFlowPatterns) {
        if (pattern.test(content)) {
          fakeFlowMatches.push(`${relative} matches ${pattern}`);
        }
      }

      for (const pattern of unsafeClinicalClaimPatterns) {
        if (pattern.test(content)) {
          unsafeClinicalMatches.push(`${relative} matches ${pattern}`);
        }
      }

      for (const pattern of falseCapacityProvenancePatterns) {
        if (pattern.test(content)) {
          groundingGuardrailMatches.push(`${relative} matches ${pattern} — capacidade é inferida, não dita pela usuária`);
        }
      }

      if (backendAgendaFilesWithUtcTimePolicy.includes(relative) && /\bsetHours\s*\(/.test(content)) {
        timezoneMatches.push(`${relative} uses setHours(); agenda backend code must use UTC-consistent helpers such as setUTCHours()`);
      }
    }
  }

  const decisionEngine = readFileSync(path.join(repoRoot, 'apps/backend/src/services/decision-engine.service.ts'), 'utf8');
  for (const pattern of fabricatedUngroundedActionPatterns) {
    if (pattern.test(decisionEngine)) groundingGuardrailMatches.push(`decision-engine.service.ts matches ${pattern}`);
  }

  const rewards = readFileSync(path.join(repoRoot, 'apps/backend/src/services/progress-rewards.service.ts'), 'utf8');
  for (const pattern of nagginRewardCopyPatterns) {
    if (pattern.test(rewards)) groundingGuardrailMatches.push(`progress-rewards.service.ts matches ${pattern}`);
  }
  for (const required of ['PROTECTED_PHASES', 'Recolhimento', 'Pausa', 'isProtectedToday']) {
    if (!rewards.includes(required)) {
      groundingGuardrailMatches.push(`progress-rewards.service.ts must keep streak protection (${required})`);
    }
  }

  const airiaMethod = readFileSync(path.join(repoRoot, 'apps/backend/src/lib/airia-method.ts'), 'utf8');
  for (const pattern of pseudoTherapeuticInferencePatterns) {
    if (pattern.test(airiaMethod)) groundingGuardrailMatches.push(`airia-method.ts matches ${pattern}`);
  }

  const phaseWindows = readFileSync(path.join(repoRoot, 'apps/backend/src/lib/phase-time-windows.ts'), 'utf8');
  for (const phaseId of ['elevated', 'flowing', 'stable', 'falling', 'low', 'depleted', 'recovering', 'mixed']) {
    if (!phaseWindows.includes(`${phaseId}:`)) groundingGuardrailMatches.push(`phase-time-windows.ts must explicitly map ${phaseId}`);
  }

  assert.deepEqual(
    groundingGuardrailMatches,
    [],
    `Operational action and phase guardrails must stay explicit:\n${groundingGuardrailMatches.join('\n')}`,
  );

  assert.deepEqual(
    offendingMatches,
    [],
    `Consumer app must not contain demo, investor, or pitch surfaces:\n${offendingMatches.join('\n')}`,
  );

  assert.deepEqual(
    fakeFlowMatches,
    [],
    `Consumer flows must not ship fake users, placeholders, dead buttons, or simulated success:\n${fakeFlowMatches.join('\n')}`,
  );

  assert.deepEqual(
    unsafeClinicalMatches,
    [],
    `Airia must not make diagnostic, cure, treatment, or clinical-substitution claims:\n${unsafeClinicalMatches.join('\n')}`,
  );

  assert.deepEqual(
    timezoneMatches,
    [],
    `Planner and agenda backend services must preserve UTC-consistent time semantics:\n${timezoneMatches.join('\n')}`,
  );

  const reviewSkillAbsolutePath = path.join(repoRoot, reviewSkillPath);
  if (!existsSync(reviewSkillAbsolutePath)) {
    reviewSkillMatches.push(`${reviewSkillPath} is missing`);
  } else {
    const content = readFileSync(reviewSkillAbsolutePath, 'utf8');
    for (const term of reviewSkillRequiredTerms) {
      if (!content.includes(term)) {
        reviewSkillMatches.push(`${reviewSkillPath} must include "${term}"`);
      }
    }
  }

  const registryAbsolutePath = path.join(repoRoot, reviewSkillRegistryPath);
  if (!existsSync(registryAbsolutePath)) {
    reviewSkillMatches.push(`${reviewSkillRegistryPath} is missing`);
  } else {
    const registry = readFileSync(registryAbsolutePath, 'utf8');
    if (!registry.includes('airia-pr-review')) {
      reviewSkillMatches.push(`${reviewSkillRegistryPath} must register airia-pr-review`);
    }
  }

  const agents = readFileSync(path.join(repoRoot, 'AGENTS.md'), 'utf8');
  if (!agents.includes(reviewSkillPath)) {
    reviewSkillMatches.push(`AGENTS.md must require ${reviewSkillPath}`);
  }

  // A asserção antiga exigia a frase "não são autoridade operacional". Essa regra
  // foi substituída de propósito: a §5.3 da Constituição passou a permitir que um
  // padrão verificado calibre uma Ação, desde que passe por relevância,
  // atualidade, capacidade/segurança e âncora operacional. O guardrail continua
  // existindo, só que agora protege a regra vigente — Diário e Check-in seguem
  // sendo contexto, e ação a partir deles continua exigindo condição explícita.
  const roadmap = readFileSync(path.join(repoRoot, 'docs/product/pr-review-skill-roadmap.md'), 'utf8');
  if (!/Di[aá]rio e Check-in s[aã]o contexto/i.test(roadmap)) {
    reviewSkillMatches.push('pr-review roadmap must state that Journal and Check-in are context');
  }
  if (!/Di[aá]rio e Check-in s[aã]o contexto[^\n]*(pedido atual|destino operacional|padr[aã]o verificado)/i.test(roadmap)) {
    reviewSkillMatches.push('pr-review roadmap must condition action on an explicit request, an operational anchor or a verified pattern');
  }

  assert.deepEqual(
    reviewSkillMatches,
    [],
    `Airia PR review skill must stay available and evidence-based:\n${reviewSkillMatches.join('\n')}`,
  );

  console.log('product-guardrails tests passed');
}

run();
