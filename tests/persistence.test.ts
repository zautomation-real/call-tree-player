import { describe, expect, it } from 'vitest'
import { loadStored, saveImportedScript, saveSession } from '../src/services/persistence'
import minimalData from '../fixtures/valid/minimal.call.json'
import type { CallScript, SessionState } from '../src/app/types'

describe('persistencia', () => {
  it('conserva el guion si los datos de sesión están dañados', () => {
    const script = minimalData as CallScript
    saveImportedScript(script, JSON.stringify(script), 'hash')
    localStorage.setItem('call-tree-player:session', '{roto')
    const stored = loadStored()
    expect(stored.corrupted).toBe(true)
    expect(stored.script?.script.script_id).toBe(script.script_id)
    expect(stored.session).toBeUndefined()
  })

  it('restaura nodo e historial exactos', () => {
    const script = minimalData as CallScript
    const session: SessionState = {
      scriptId: script.script_id, scriptHash: 'hash', sessionId: 's1', startedAt: '2026-08-20T10:00:00Z', updatedAt: '2026-08-20T10:01:00Z',
      status: 'in_call', context: 'call', currentId: 'n2', history: [{ context: 'call', id: 'n1' }], events: [],
    }
    saveImportedScript(script, JSON.stringify(script), 'hash')
    saveSession(session)
    expect(loadStored().session).toEqual(session)
  })
})
