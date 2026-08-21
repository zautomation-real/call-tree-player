import type { CallScript, SessionState } from '../app/types'

const SCRIPT_KEY = 'call-tree-player:script'
const SESSION_KEY = 'call-tree-player:session'

export interface StoredScript { raw: string; hash: string; script: CallScript }

export function loadStored(): { script?: StoredScript; session?: SessionState; corrupted: boolean } {
  let script: StoredScript | undefined
  let session: SessionState | undefined
  let corrupted = false
  try {
    const rawScript = localStorage.getItem(SCRIPT_KEY)
    script = rawScript ? JSON.parse(rawScript) as StoredScript : undefined
  } catch {
    localStorage.removeItem(SCRIPT_KEY)
    corrupted = true
  }
  try {
    const rawSession = localStorage.getItem(SESSION_KEY)
    session = rawSession ? JSON.parse(rawSession) as SessionState : undefined
  } catch {
    localStorage.removeItem(SESSION_KEY)
    corrupted = true
  }
  return { script, session, corrupted }
}

export function saveImportedScript(script: CallScript, raw: string, hash: string): void {
  localStorage.setItem(SCRIPT_KEY, JSON.stringify({ script, raw, hash } satisfies StoredScript))
}

export function saveSession(session: SessionState): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession(): void { localStorage.removeItem(SESSION_KEY) }
export function clearAll(): void {
  localStorage.removeItem(SCRIPT_KEY)
  localStorage.removeItem(SESSION_KEY)
}
