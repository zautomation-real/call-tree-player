export type Tone = 'neutral' | 'advance' | 'clarify' | 'objection' | 'handoff' | 'close'

export interface Company {
  name: string
  contact_name?: string
  contact_role?: string
  phone?: string
}

export interface Outcome { id: string; label: string }
export interface Evidence { title: string; text?: string; url?: string; image_url?: string }
export interface Response { id: string; label: string; next: string; tone?: Tone }
export interface CallNode {
  id: string
  say: string
  evidence?: Evidence[]
  responses?: Response[]
  terminal?: { outcome: string }
}

export interface CallScript {
  schema_version: '1.0.0'
  script_id: string
  title: string
  company: Company
  start_node: string
  outcomes: Outcome[]
  unexpected_routes?: Record<string, string>
  nodes: CallNode[]
}

export interface UnexpectedEntry {
  id: string
  label: string
  category: string
  keywords: string[]
  behavior: 'return' | 'branch' | 'end'
  tone?: Tone
  say: string
  responses: Response[]
}

export interface UnexpectedRegistry { schema_version: '1.0.0'; entries: UnexpectedEntry[] }
export interface HistoryEntry { context: 'call' | 'unexpected'; id: string }
export interface SessionEvent { type: string; at: string; [key: string]: unknown }
export interface SessionState {
  scriptId: string
  scriptHash: string
  sessionId: string
  startedAt: string
  updatedAt: string
  status: 'ready' | 'in_call' | 'ended'
  context: 'call' | 'unexpected'
  currentId: string
  history: HistoryEntry[]
  events: SessionEvent[]
  outcomeId?: string
}

export interface ValidationResult {
  valid: boolean
  script?: CallScript
  errors: string[]
  warnings: string[]
}
