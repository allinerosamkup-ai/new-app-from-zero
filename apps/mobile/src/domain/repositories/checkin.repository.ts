// Repository: CheckinRepository
// Responsável por: criar check-in, escutar resultado da IA via Realtime

import { supabase } from '../../lib/supabase'
import type {
  Checkin,
  CheckinCreateInput,
  DayStateLabel,
  FocusIntensity,
  TccTechnique,
} from '../entities/checkin'

export interface CheckinCreateResult {
  checkin: Checkin
  status: 'processing' | 'complete'
}

// Cria check-in e retorna imediatamente (IA processa em background)
export async function createCheckin(
  input: CheckinCreateInput
): Promise<CheckinCreateResult> {
  const { data, error } = await supabase.functions.invoke('checkin-create', {
    body: input,
  })
  if (error) throw new Error(error.message)
  return {
    checkin: parseCheckin(data.checkin),
    status: data.status,
  }
}

// Escuta Realtime até a IA preencher o estado — chama onUpdate quando pronto
export function subscribeToCheckinAi(
  checkinId: string,
  onUpdate: (checkin: Checkin) => void
) {
  const channel = (supabase as any)
    .channel(`checkin-ai:${checkinId}`)
    .on(
      'postgres_changes',
      {
        event:  'UPDATE',
        schema: 'public',
        table:  'daily_checkins',
        filter: `id=eq.${checkinId}`,
      },
      (payload: any) => {
        const row = payload.new
        // Só notifica quando a IA terminar (day_state_label preenchido)
        if (row.day_state_label) {
          onUpdate(parseCheckin(row))
          channel.unsubscribe()
        }
      }
    )
    .subscribe()

  // Retorna função de cleanup para usar em useEffect
  return () => channel.unsubscribe()
}

// Busca histórico de check-ins dos últimos N dias
export async function fetchCheckinHistory(days = 7): Promise<Checkin[]> {
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - days)

  const { data, error } = await supabase
    .from('daily_checkins')
    .select('*')
    .gte('checkin_date', weekStart.toISOString().split('T')[0])
    .order('checkin_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(parseCheckin)
}

// Mapeia snake_case do banco → camelCase da entity
function parseCheckin(row: Record<string, any>): Checkin {
  return {
    id:               row.id,
    date:             row.checkin_date,
    period:           row.period,
    moodScore:        row.mood_score,
    energyScore:      row.energy_score,
    clarityScore:     row.mental_clarity,
    irritabilityScore: row.irritability,
    physicalScore:    row.physical_score,
    socialScore:      row.social_score,
    note:             row.note ?? undefined,
    stateLabel:       row.state_summary ?? undefined,
    stateLabelType:   (row.day_state_label as DayStateLabel) ?? undefined,
    tccSuggestion:    row.tcc_suggestion ?? undefined,
    tccTechnique:     (row.tcc_technique as TccTechnique) ?? undefined,
    energyStateInternal: row.day_state_label ? {
      analysis:           row.state_summary ?? '',
      recommendations:    row.ai_recommendations ?? [],
      suggestedIntensity: (row.suggested_focus_level as FocusIntensity) ?? 'M',
    } : undefined,
  }
}
