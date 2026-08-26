export type Tone = 'neutral' | 'advance' | 'clarify' | 'objection' | 'handoff' | 'close'
export type Language = 'es' | 'ca'
export type LocalizedText = string | Record<Language, string>

export interface Company {
  name: string
  contact_name?: string
  contact_role?: string
  phone?: string
}

export interface Outcome { id: string; label: LocalizedText }
export interface Evidence { title: LocalizedText; text?: LocalizedText; url?: string; image_url?: string }
export interface Response { id: string; label: LocalizedText; next: string; tone?: Tone }
export interface CallNode {
  id: string
  say: LocalizedText
  evidence?: Evidence[]
  responses?: Response[]
  terminal?: { outcome: string }
}

export interface CallScript {
  schema_version: '1.0.0'
  default_language?: Language
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
  label: LocalizedText
  category: LocalizedText
  keywords: string[]
  behavior: 'return' | 'branch' | 'end'
  tone?: Tone
  say: LocalizedText
  responses: Response[]
}

export interface UnexpectedRegistry { schema_version: '1.0.0'; default_language: Language; entries: UnexpectedEntry[] }
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
  language?: Language
}

export interface ValidationResult {
  valid: boolean
  script?: CallScript
  errors: string[]
  warnings: string[]
}
