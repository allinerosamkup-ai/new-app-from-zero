/**
 * Benchmark do validador.
 *
 * Dois casos com gabarito: uma decomposição correta (tem que APROVAR) e uma
 * cheia de invenção (tem que REPROVAR). Modelo que erra qualquer um dos dois
 * não serve — aprovar tudo é tão inútil quanto reprovar tudo.
 */
import 'dotenv/config';
import OpenAI from 'openai';

import { buildActionValidationPrompt, type GoalStep } from '../src/services/goal-intelligence.service';

const SALA = 'Deixar a sala pronta para uso';

const BOA: GoalStep[] = [
  { title: 'Retire da sala tudo o que não deveria estar ali', basedOn: 'inferred' },
  { title: 'Organize os elementos principais da sala para deixar o espaço utilizável', basedOn: 'inferred' },
  { title: 'Faça uma limpeza básica do que estiver impedindo o uso', basedOn: 'inferred' },
  { title: 'Confira se a sala já está funcional para o uso pretendido', basedOn: 'inferred' },
];

const RUIM: GoalStep[] = [
  { title: 'Pegue um rolo de fita crepe e prenda a área solta do rodapé', basedOn: 'inferred' },
  { title: 'Compre uma caixa organizadora azul de 40 litros', basedOn: 'inferred' },
  { title: 'Troque a lâmpada queimada da sala', basedOn: 'inferred' },
];

const MODELOS = process.argv.slice(2);
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function temperatura(model: string) {
  const m = model.toLowerCase();
  const reasoning = m.startsWith('gpt-5') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4');
  return reasoning ? {} : { temperature: 0.25 };
}

async function julgar(model: string, steps: GoalStep[]) {
  const started = Date.now();
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'Você revisa recomendações e reprova o que não se sustenta em dado real. Responde só JSON.' },
      {
        role: 'user',
        content: buildActionValidationPrompt({
          goalTitle: SALA,
          contextText: SALA,
          resultDefinition: 'A sala funcional para o uso dela',
          steps,
        }),
      },
    ],
    response_format: { type: 'json_object' },
    max_completion_tokens: 500,
    ...temperatura(model),
  } as any);
  const raw = response.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(raw);
  return {
    approved: parsed.approved,
    failures: (parsed.failures ?? []).slice(0, 2),
    ms: Date.now() - started,
    tokens: response.usage?.total_tokens ?? 0,
  };
}

const RODADAS = 5;

(async () => {
  for (const model of MODELOS) {
    try {
      const rodadas = await Promise.all(
        Array.from({ length: RODADAS }, async () => {
          const [boa, ruim] = await Promise.all([julgar(model, BOA), julgar(model, RUIM)]);
          return { boaOk: boa.approved === true, ruimOk: ruim.approved === false, ms: boa.ms + ruim.ms, tok: boa.tokens + ruim.tokens, motivo: boa.failures };
        }),
      );
      const boaOk = rodadas.filter((r) => r.boaOk).length;
      const ruimOk = rodadas.filter((r) => r.ruimOk).length;
      const ms = Math.round(rodadas.reduce((t, r) => t + r.ms, 0) / RODADAS);
      const tok = Math.round(rodadas.reduce((t, r) => t + r.tok, 0) / RODADAS);
      const veredito = boaOk === RODADAS && ruimOk === RODADAS ? 'PASSOU' : 'FALHOU';
      console.log(`${veredito}  ${model.padEnd(16)} aprova-a-boa ${boaOk}/${RODADAS}  reprova-a-ruim ${ruimOk}/${RODADAS}  ${ms}ms  ${tok}tok`);
      const falha = rodadas.find((r) => !r.boaOk);
      if (falha) console.log(`      falso negativo: ${JSON.stringify(falha.motivo).slice(0, 190)}`);
    } catch (error: any) {
      console.log(`ERRO    ${model.padEnd(16)} ${error.message?.slice(0, 110)}`);
    }
  }
})();
