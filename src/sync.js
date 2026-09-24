import { createClient } from '@supabase/supabase-js'

// Shared storage for the tracker. When the Supabase env vars are set, every
// device reads and writes the same `subject_state` rows. Without them the app
// falls back to this browser's localStorage only.

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = url && key ? createClient(url, key) : null

const TABLE = 'subject_state'

function toRow(id, state) {
  return {
    id,
    remaining: state.remaining,
    log: state.log,
    daily_goal: state.dailyGoal,
    last_synced_log_total: state.lastSyncedLogTotal,
    updated_at: new Date().toISOString(),
  }
}

function fromRow(row) {
  return {
    remaining: row.remaining,
    log: row.log || {},
    dailyGoal: row.daily_goal,
    lastSyncedLogTotal: row.last_synced_log_total,
  }
}

// Returns the shared state, or null if there's no row yet (or no backend).
export async function fetchRemote(id) {
  if (!supabase) return null
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? fromRow(data) : null
}

export async function pushRemote(id, state) {
  if (!supabase) return
  const { error } = await supabase.from(TABLE).upsert(toRow(id, state))
  if (error) throw error
}

// Calls onChange with the new state whenever another device saves this subject.
// Returns an unsubscribe function.
export function subscribeRemote(id, onChange) {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(`${TABLE}:${id}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `id=eq.${id}` },
      (payload) => {
        if (payload.new && payload.new.id === id) onChange(fromRow(payload.new))
      }
    )
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}
