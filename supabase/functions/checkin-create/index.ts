// Edge Function: checkin-create
// Fluxo: salva check-in → responde imediatamente → processa IA em background
// Realtime: cliente escuta updates em daily_checkins via supabase_realtime

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return error(401, 'unauthorized')

    // Resolve usuário pelo JWT
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authErr || !user) return error(401, 'invalid_token')

    const body = await req.json()

    // Validação básica de ranges (schema completo no contrato Zod do backend)
    const validated = validateCheckin(body)
    if (!validated.ok) return error(400, validated.message)

    const today = body.date ?? new Date().toISOString().split('T')[0]

    // 1. Salva check-in imediatamente — sem aguardar IA
    const { data: checkin, error: insertErr } = await supabase
      .from('daily_checkins')
      .insert({
        user_id:           user.id,
        checkin_date:      today,
        period:            body.period,
        mood_score:        body.moodScore,
        energy_score:      body.energyScore,
        mental_clarity:    body.clarityScore,
        irritability:      body.irritabilityScore,
        physical_score:    body.physicalScore,
        social_score:      body.socialScore,
        note:              body.note ?? null,
        source:            'manual',
      })
      .select()
      .single()

    if (insertErr) return error(500, insertErr.message)

    // 2. Dispara IA em background — não bloqueia o response
    EdgeRuntime.waitUntil(processAiState(checkin.id, user.id, body))

    // 3. Retorna check-in salvo imediatamente (sem aiEvaluation ainda)
    return new Response(
      JSON.stringify({ checkin, aiEvaluation: null, status: 'processing' }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return error(500, err.message)
  }
})

// Processamento assíncrono da IA — atualiza o registro via Realtime
async function processAiState(checkinId: string, userId: string, body: any) {
  try {
    // Busca contexto de aprendizado do usuário
    const { data: tccCtx } = await supabase.rpc('get_tcc_learning_context', {
      p_days_back: 30
    })

    const prompt = buildStatePrompt(body, tccCtx)

    // Chama OpenAI
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      })
    })

    const aiJson = await aiRes.json()
    const evaluation = JSON.parse(aiJson.choices[0].message.content)

    // Atualiza o registro — Realtime dispara update para o cliente
    await supabase
      .from('daily_checkins')
      .update({
        day_state_label:      evaluation.stateLabelType,
        state_summary:        evaluation.analysis,
        suggested_focus_level: evaluation.suggestedIntensity,
        ai_recommendations:   evaluation.recommendations ?? [],
        tcc_suggestion:       evaluation.tccSuggestion ?? null,
        tcc_technique:        evaluation.tccTechnique ?? null,
        ai_confidence:        evaluation.confidence ?? null,
        updated_at:           new Date().toISOString(),
      })
      .eq('id', checkinId)

  } catch (err) {
    console.error('[processAiState] failed:', err.message)
    // Falha silenciosa — check-in já foi salvo, IA tenta novamente na próxima
  }
}

function buildStatePrompt(body: any, tccCtx: any): string {
  return `Avalie o estado energético desta pessoa e retorne APENAS JSON válido:

DADOS DO CHECK-IN:
- Humor: ${body.moodScore}/5
- Energia: ${body.energyScore}/3
- Clareza mental: ${body.clarityScore}/4
- Irritabilidade: ${body.irritabilityScore}/5
- Estado físico: ${body.physicalScore}/4
- Estado social: ${body.socialScore}/3
${body.note ? `- Nota: "${body.note}"` : ''}

HISTÓRICO (últimos 30 dias):
- Técnicas TCC recentes (não repetir): ${JSON.stringify(tccCtx?.recentTechniques ?? [])}
- Temas recorrentes: ${JSON.stringify(tccCtx?.recurringThemes ?? [])}
- Crashes recentes: ${JSON.stringify(tccCtx?.crashHistory ?? [])}

RACIOCÍNIO INTERNO OBRIGATÓRIO:
- Separe fato concreto de interpretação.
- Identifique movimento em curso, obstáculo, utilidade de curto prazo do obstáculo e custo oculto de obedecer a ele.
- Em queda/depressão: priorize ativação comportamental mínima e ação física pequena.
- Em agitação/mania: priorize contenção, redução de estímulo e decisão reversível.
- Exposição gradual: quando houver evitação, proponha só a menor aproximação segura.
- Somática é suporte, não eixo principal; não repita "respire", "mão no peito" ou "sinta o corpo" sem sinal concreto.
- Não repita técnica recente. Se a mesma linha for inevitável, escreva como retomada explícita de uma sugestão anterior com ajuste concreto.

Retorne APENAS este JSON:
{
  "stateLabelType": "leve|estavel|sensivel|sobrecarregado",
  "analysis": "frase curta descrevendo o estado (máx 120 chars)",
  "suggestedIntensity": "L|M|P",
  "recommendations": ["string", "string"],
  "tccSuggestion": "sugestão TCC personalizada e concreta (máx 140 chars)",
  "tccTechnique": "ativacao_comportamental|reestruturacao_cognitiva|regulacao_emocional|higiene_sono_energia|agenda_prazer|exposicao_gradual",
  "confidence": 0.0
}`
}

function validateCheckin(body: any): { ok: boolean; message: string } {
  const rules: Array<[string, number, number]> = [
    ['moodScore',         1, 5],
    ['energyScore',       1, 3],
    ['clarityScore',      1, 4],
    ['irritabilityScore', 1, 5],
    ['physicalScore',     1, 4],
    ['socialScore',       1, 3],
  ]
  for (const [field, min, max] of rules) {
    const v = body[field]
    if (typeof v !== 'number' || v < min || v > max)
      return { ok: false, message: `${field} must be ${min}-${max}` }
  }
  const validPeriods = ['manha', 'tarde', 'noite']
  if (!validPeriods.includes(body.period))
    return { ok: false, message: 'period must be manha|tarde|noite' }
  return { ok: true, message: '' }
}

function error(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
