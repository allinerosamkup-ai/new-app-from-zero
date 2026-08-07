/**
 * Smoke test do modelo contra TODAS as superfícies de IA do app.
 *
 * Trocar o modelo global conserta a validação, mas pode quebrar o contrato de
 * saída de qualquer outra superfície — e aí o estrago é maior que o conserto.
 * Aqui cada superfície manda um prompt representativo do que roda em produção e
 * o resultado é validado contra o formato que o app espera de verdade.
 */
import 'dotenv/config';
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.argv[2] || 'gpt-5.4-mini';

function temperatura(model: string) {
  const m = model.toLowerCase();
  const reasoning = m.startsWith('gpt-5') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4');
  return reasoning ? {} : { temperature: 0.4 };
}

type Caso = {
  nome: string;
  json: boolean;
  prompt: string;
  valida: (raw: string) => string | null;
};

function parse(raw: string): any {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(trimmed);
}

const arrayDeTarefas = (raw: string) => {
  const v = parse(raw);
  const list = Array.isArray(v) ? v : v.tasks ?? v.items;
  if (!Array.isArray(list) || list.length === 0) return 'não veio array de tarefas';
  if (!list.every((t: any) => typeof t?.title === 'string' && t.title.trim())) return 'tarefa sem title';
  return null;
};

const CASOS: Caso[] = [
  {
    nome: 'goal-subtasks / checkin-next-step',
    json: true,
    prompt: `Objetivo: "Deixar a sala pronta para uso". Devolva de 2 a 5 passos reais, sem inventar objeto ou defeito.
JSON APENAS: {"resultDefinition":"...","assumptions":["..."],"steps":[{"title":"...","basedOn":"stated|inferred","rationale":"..."}]}`,
    valida: (raw) => {
      const v = parse(raw);
      if (!Array.isArray(v.steps) || v.steps.length < 2) return 'steps ausente ou curto';
      if (!v.steps.every((s: any) => typeof s?.title === 'string')) return 'step sem title';
      return null;
    },
  },
  {
    nome: 'day-tasks',
    json: false,
    prompt: `Gere 3 tarefas para hoje para alguém com energia baixa.
Retorne SOMENTE array JSON: [{"title":"...","category":"trabalho|saude|rotina|social","time":"HH:MM"}]. Sem explicação.`,
    valida: arrayDeTarefas,
  },
  {
    nome: 'journal-tasks',
    json: false,
    prompt: `Com base nesta conversa de diário: "Tô exausta, não consegui fazer nada hoje e me sinto culpada."
Gere 0-3 tarefas gentis. Retorne SOMENTE um array JSON: [{"title":"...","category":"trabalho|saude|rotina|social","time":"HH:MM"}].`,
    valida: (raw) => {
      const v = parse(raw);
      const list = Array.isArray(v) ? v : v.tasks ?? v.items;
      if (!Array.isArray(list)) return 'não veio array';
      return null; // lista vazia é resposta legítima aqui
    },
  },
  {
    nome: 'task-checklist',
    json: false,
    prompt: `Crie 3-5 itens de checklist para a tarefa "Preparar apresentação" (categoria: trabalho). Retorne SOMENTE um array JSON de strings: ["Item 1","Item 2"]. Sem explicação.`,
    valida: (raw) => {
      const v = parse(raw);
      const list = Array.isArray(v) ? v : v.items;
      if (!Array.isArray(list) || list.length === 0) return 'não veio array de strings';
      if (!list.every((i: any) => typeof i === 'string')) return 'item não-string';
      return null;
    },
  },
  {
    nome: 'task-content',
    json: true,
    prompt: `Decida o apoio para o bloco "Revisar contrato" (área trabalho).
JSON APENAS: {"mode":"note|checklist|mixed","note":"texto opcional","items":["passo 1","passo 2"]}`,
    valida: (raw) => {
      const v = parse(raw);
      if (!['note', 'checklist', 'mixed'].includes(v.mode)) return `mode inválido: ${v.mode}`;
      return null;
    },
  },
  {
    nome: 'weekly-insight',
    json: true,
    prompt: `Leitura semanal. Humor médio 5/10, energia 4/10, 5 check-ins, pico na terça, baixa na sexta.
Retorne SOMENTE JSON: {"insight":"2 frases","action":"1 ação concreta","category":"energia|humor|rotina|autocuidado","actionTitle":"título curto"}`,
    valida: (raw) => {
      const v = parse(raw);
      for (const k of ['insight', 'action', 'category', 'actionTitle']) {
        if (typeof v[k] !== 'string' || !v[k].trim()) return `campo ausente: ${k}`;
      }
      return null;
    },
  },
  {
    nome: 'stability-analysis',
    json: true,
    prompt: `Analise: humor 4/10, energia 3/10, estabilidade 38/100, 7 check-ins, meta ativa "Deixar a sala pronta para uso".
Retorne SOMENTE JSON: {"stabilityScore":38,"state":"declining","pattern":"...","insight":"...","actions":[{"title":"...","category":"rotina","why":"..."}]}`,
    valida: (raw) => {
      const v = parse(raw);
      if (typeof v.insight !== 'string') return 'insight ausente';
      if (!Array.isArray(v.actions)) return 'actions não é array';
      return null;
    },
  },
  {
    nome: 'checkin-response',
    json: true,
    prompt: `Check-in: humor 4/10, energia 3/10, fatores "sono ruim" e "sobrecarga mental".
Retorne SOMENTE JSON: {"stateLabel":"...","analysis":"2 frases diretas","recommendations":["..."],"suggestedIntensity":"P|M|G"}`,
    valida: (raw) => {
      const v = parse(raw);
      if (typeof v.analysis !== 'string' || !v.analysis.trim()) return 'analysis ausente';
      if (!Array.isArray(v.recommendations)) return 'recommendations não é array';
      return null;
    },
  },
  {
    nome: 'home-messages',
    json: true,
    prompt: `Mensagens da home para alguém em fase de Recolhimento, energia 3/10.
Retorne SOMENTE JSON: {"motivacional":"1 frase","autocuidado":["..."]}`,
    valida: (raw) => {
      const v = parse(raw);
      if (typeof v.motivacional !== 'string' || !v.motivacional.trim()) return 'motivacional ausente';
      return null;
    },
  },
  {
    nome: 'task-notes (texto puro)',
    json: false,
    prompt: `Escreva observações práticas (2-3 frases) para a tarefa "Ligar para a médica" (categoria: saude). Responda diretamente, sem JSON.`,
    valida: (raw) => (raw.trim().length > 20 ? null : 'resposta curta demais'),
  },
  {
    nome: 'voice-checkin',
    json: true,
    prompt: `Transcrição: "hoje eu tô bem cansada, dormi mal, umas cinco horas, e tô meio ansiosa com o trabalho".
Extraia. JSON APENAS: {"humor":1-10,"energia":1-10,"sleepHours":number,"emotions":["tired","anxious"],"factors":["slept_little","work_pressure"],"note":"..."}`,
    valida: (raw) => {
      const v = parse(raw);
      if (typeof v.energia !== 'number') return 'energia não numérica';
      if (!Array.isArray(v.emotions)) return 'emotions não é array';
      return null;
    },
  },
];

(async () => {
  console.log(`modelo: ${MODEL}\n`);
  let falhas = 0;

  const resultados = await Promise.all(CASOS.map(async (caso) => {
    const started = Date.now();
    try {
      const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: 'Você é a Airia, assistente pessoal. Siga exatamente o formato de saída pedido.' },
          { role: 'user', content: caso.prompt },
        ],
        max_completion_tokens: 1200,
        ...(caso.json ? { response_format: { type: 'json_object' as const } } : {}),
        ...temperatura(MODEL),
      } as any);
      const raw = response.choices?.[0]?.message?.content?.trim() ?? '';
      if (!raw) return { nome: caso.nome, erro: 'resposta vazia', ms: Date.now() - started };
      const erro = caso.valida(raw);
      return { nome: caso.nome, erro, ms: Date.now() - started, amostra: raw.slice(0, 90).replace(/\s+/g, ' ') };
    } catch (error: any) {
      return { nome: caso.nome, erro: `EXCEÇÃO: ${error.message?.slice(0, 90)}`, ms: Date.now() - started };
    }
  }));

  for (const r of resultados) {
    if (r.erro) {
      falhas += 1;
      console.log(`FALHOU  ${r.nome.padEnd(32)} ${r.erro}`);
    } else {
      console.log(`ok      ${r.nome.padEnd(32)} ${r.ms}ms   ${r.amostra}`);
    }
  }

  console.log(`\n${CASOS.length - falhas}/${CASOS.length} superfícies com contrato respeitado`);
  process.exit(falhas > 0 ? 1 : 0);
})();
