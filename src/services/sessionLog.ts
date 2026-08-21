import type { CallScript, SessionState } from '../app/types'

export function createSessionLog(script: CallScript, session: SessionState) {
  return {
    schema_version: '1.0.0',
    script_id: script.script_id,
    script_hash: session.scriptHash,
    session_id: session.sessionId,
    started_at: session.startedAt,
    ended_at: session.updatedAt,
    outcome: session.outcomeId,
    selection_count: session.events.filter((event) => event.type === 'response' || event.type === 'unexpected_response').length,
    events: session.events,
  }
}

export function downloadSessionLog(script: CallScript, session: SessionState): void {
  const blob = new Blob([JSON.stringify(createSessionLog(script, session), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${script.script_id}.call-session.json`
  link.click()
  URL.revokeObjectURL(url)
}
