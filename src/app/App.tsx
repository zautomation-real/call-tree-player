import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react'
import type { CallNode, CallScript, HistoryEntry, Response, SessionState, UnexpectedEntry } from './types'
import { hashText } from '../services/hashing'
import { clearAll, loadStored, saveImportedScript, saveSession } from '../services/persistence'
import { downloadSessionLog } from '../services/sessionLog'
import { parseAndValidate, unexpectedRegistry, validateCallScript } from '../services/validation'

type Screen = 'import' | 'ready' | 'call' | 'end'
type Overlay = 'restore' | 'replace' | 'unexpected' | 'evidence' | null

function now(): string { return new Date().toISOString() }
function makeSession(script: CallScript, hash: string): SessionState {
  const timestamp = now()
  return {
    scriptId: script.script_id,
    scriptHash: hash,
    sessionId: crypto.randomUUID(),
    startedAt: timestamp,
    updatedAt: timestamp,
    status: 'ready',
    context: 'call',
    currentId: script.start_node,
    history: [],
    events: [],
  }
}

function isTextInput(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)
}

function callerTextClass(text: string): string {
  if (text.length > 800) return 'caller-text caller-text--very-long'
  if (text.length > 450) return 'caller-text caller-text--long'
  if (text.length > 220) return 'caller-text caller-text--medium'
  return 'caller-text'
}

function Dialog({ title, onClose, children, labelledBy, closeLabel = 'Cerrar' }: {
  title: string
  onClose?: () => void
  children: ReactNode
  labelledBy: string
  closeLabel?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>('input[type="search"]') ?? panel?.querySelector<HTMLElement>('[autofocus]') ?? panel?.querySelector<HTMLElement>('input, button, a[href]')
    first?.focus()
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape' && onClose) {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const focusable = [...panel.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]')]
      if (!focusable.length) return
      const firstItem = focusable[0]
      const lastItem = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === firstItem) { event.preventDefault(); lastItem.focus() }
      else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <div className="panel" role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={panelRef}>
        <div className="panel-head">
          <h2 id={labelledBy}>{title}</h2>
          {onClose && <button className="icon-button" type="button" aria-label={closeLabel} onClick={onClose}>×</button>}
        </div>
        {children}
      </div>
    </div>
  )
}

function ResponseButton({ response, index, onClick }: { response: Response; index: number; onClick: () => void }) {
  return (
    <button className={`response tone-${response.tone ?? 'neutral'}`} type="button" aria-label={`${index + 1}: ${response.label}`} onClick={onClick}>
      <span className="shortcut" aria-hidden="true">{index + 1}</span>
      <span>{response.label}</span>
    </button>
  )
}

export function App() {
  const [screen, setScreen] = useState<Screen>('import')
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [script, setScript] = useState<CallScript | null>(null)
  const [rawScript, setRawScript] = useState('')
  const [scriptHash, setScriptHash] = useState('')
  const [session, setSession] = useState<SessionState | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [warningsAccepted, setWarningsAccepted] = useState(false)
  const [runtimeError, setRuntimeError] = useState('')
  const [pendingReplacement, setPendingReplacement] = useState<{ script: CallScript; raw: string; hash: string; warnings: string[] } | null>(null)
  const [registryQuery, setRegistryQuery] = useState('')
  const [registryCategory, setRegistryCategory] = useState('Todas')
  const [registryIndex, setRegistryIndex] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const overlayTriggerRef = useRef<HTMLElement | null>(null)

  const persistSession = useCallback((next: SessionState) => {
    const updated = { ...next, updatedAt: now() }
    setSession(updated)
    saveSession(updated)
    return updated
  }, [])

  useEffect(() => {
    const stored = loadStored()
    if (stored.corrupted) setErrors(['La sesión guardada estaba dañada. Puedes cargar de nuevo el guion o reiniciar la copia conservada.'])
    if (!stored.script) return
    const validation = validateCallScript(stored.script.script)
    if (!validation.valid || stored.script.hash !== stored.session?.scriptHash && stored.session) return
    setScript(stored.script.script)
    setRawScript(stored.script.raw)
    setScriptHash(stored.script.hash)
    setWarnings(validation.warnings)
    if (stored.session && ['ready', 'in_call', 'ended'].includes(stored.session.status)) {
      setSession(stored.session)
      setOverlay('restore')
    } else {
      setScreen('ready')
    }
  }, [])

  useEffect(() => {
    if (screen === 'call' && !overlay) headingRef.current?.focus()
  }, [screen, overlay, session?.currentId, session?.context])

  const callNode = useMemo(() => {
    if (!script || !session || session.context !== 'call') return undefined
    return script.nodes.find((node) => node.id === session.currentId)
  }, [script, session])
  const unexpectedNode = useMemo(() => {
    if (!session || session.context !== 'unexpected') return undefined
    return unexpectedRegistry.entries.find((entry) => entry.id === session.currentId)
  }, [session])
  const activeNode = callNode ?? unexpectedNode

  const closeOverlay = useCallback(() => {
    setOverlay(null)
    requestAnimationFrame(() => {
      if (!document.querySelector('[role="dialog"]')) overlayTriggerRef.current?.focus()
    })
  }, [])

  const applyImport = useCallback((nextScript: CallScript, raw: string, hash: string, nextWarnings: string[]) => {
    const nextSession = makeSession(nextScript, hash)
    saveImportedScript(nextScript, raw, hash)
    saveSession(nextSession)
    setScript(nextScript)
    setRawScript(raw)
    setScriptHash(hash)
    setSession(nextSession)
    setWarnings(nextWarnings)
    setWarningsAccepted(nextWarnings.length === 0)
    setErrors([])
    setRuntimeError('')
    setPendingReplacement(null)
    setOverlay(null)
    setScreen('ready')
  }, [])

  const importFile = useCallback(async (file?: File) => {
    if (!file) return
    setErrors([])
    try {
      const raw = await file.text()
      const result = parseAndValidate(raw)
      if (!result.valid || !result.script) { setErrors(result.errors); return }
      const hash = await hashText(raw)
      if (script && script.script_id === result.script.script_id && scriptHash && scriptHash !== hash) {
        setPendingReplacement({ script: result.script, raw, hash, warnings: result.warnings })
        setOverlay('replace')
        return
      }
      applyImport(result.script, raw, hash, result.warnings)
    } catch {
      setErrors(['No se pudo leer el archivo seleccionado.'])
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [applyImport, script, scriptHash])

  const startCall = useCallback(() => {
    if (!script || !session || (warnings.length && !warningsAccepted)) return
    const next = { ...session, status: 'in_call' as const, context: 'call' as const, currentId: script.start_node }
    persistSession(next)
    setScreen('call')
  }, [persistSession, script, session, warnings.length, warningsAccepted])

  const restart = useCallback(() => {
    if (!script) return
    const next = makeSession(script, scriptHash)
    next.status = 'in_call'
    saveSession(next)
    setSession(next)
    setScreen('call')
    setOverlay(null)
  }, [script, scriptHash])

  const loadAnother = useCallback(() => {
    clearAll()
    setScript(null); setRawScript(''); setScriptHash(''); setSession(null)
    setErrors([]); setWarnings([]); setWarningsAccepted(false); setOverlay(null); setScreen('import')
  }, [])

  const goBack = useCallback(() => {
    if (overlay) { closeOverlay(); return }
    if (!session?.history.length) return
    const history = [...session.history]
    const previous = history.pop()!
    persistSession({
      ...session,
      context: previous.context,
      currentId: previous.id,
      history,
      events: [...session.events, { type: 'back', at: now() }],
    })
  }, [closeOverlay, overlay, persistSession, session])

  const navigateCall = useCallback((response: Response) => {
    if (!script || !session || !callNode) return
    if (!script.nodes.some((node) => node.id === response.next)) {
      setRuntimeError(`No se puede continuar: el nodo destino "${response.next}" ya no está disponible.`)
      return
    }
    persistSession({
      ...session,
      currentId: response.next,
      history: [...session.history, { context: 'call', id: callNode.id }],
      events: [...session.events, { type: 'response', nodeId: callNode.id, responseId: response.id, label: response.label, at: now() }],
    })
  }, [callNode, persistSession, script, session])

  const openUnexpected = useCallback((trigger?: HTMLElement) => {
    if (!callNode?.responses) return
    overlayTriggerRef.current = trigger ?? document.activeElement as HTMLElement
    setRegistryQuery(''); setRegistryCategory('Todas'); setRegistryIndex(0); setOverlay('unexpected')
  }, [callNode])

  const selectUnexpected = useCallback((entry: UnexpectedEntry) => {
    if (!script || !session) return
    const origin: HistoryEntry = { context: session.context, id: session.currentId }
    const override = script.unexpected_routes?.[entry.id]
    const baseEvents = [...session.events, { type: 'unexpected_selected', entryId: entry.id, label: entry.label, at: now() }]
    if (override) {
      persistSession({ ...session, context: 'call', currentId: override, history: [...session.history, origin], events: baseEvents })
    } else {
      persistSession({ ...session, context: 'unexpected', currentId: entry.id, history: [...session.history, origin], events: baseEvents })
    }
    setOverlay(null)
    setScreen('call')
  }, [persistSession, script, session])

  const chooseUnexpected = useCallback((response: Response) => {
    if (!session || !unexpectedNode) return
    const events = [...session.events, { type: 'unexpected_response', entryId: unexpectedNode.id, responseId: response.id, label: response.label, at: now() }]
    if (response.next === '@return') {
      const history = [...session.history]
      const origin = history.pop()
      if (!origin) { setRuntimeError('No se encontró el punto de retorno de esta respuesta.'); return }
      persistSession({ ...session, context: origin.context, currentId: origin.id, history, events })
      return
    }
    if (response.next.startsWith('@end:')) {
      const outcomeId = response.next.slice(5)
      persistSession({ ...session, status: 'ended', outcomeId, events: [...events, { type: 'end', outcomeId, at: now() }] })
      setScreen('end')
      return
    }
    const target = unexpectedRegistry.entries.find((entry) => entry.id === response.next)
    if (!target) { setRuntimeError(`No se puede continuar: la respuesta inesperada "${response.next}" no existe.`); return }
    persistSession({
      ...session,
      currentId: target.id,
      history: [...session.history, { context: 'unexpected', id: unexpectedNode.id }],
      events,
    })
  }, [persistSession, session, unexpectedNode])

  const finishCall = useCallback(() => {
    if (!session || !callNode?.terminal) return
    const outcomeId = callNode.terminal.outcome
    persistSession({ ...session, status: 'ended', outcomeId, events: [...session.events, { type: 'end', outcomeId, at: now() }] })
    setScreen('end')
  }, [callNode, persistSession, session])

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (screen !== 'call' || overlay) return
      if (event.key === 'Backspace' && !isTextInput(event.target)) { event.preventDefault(); goBack(); return }
      if (event.key.toLowerCase() === 'u' && callNode?.responses) { event.preventDefault(); openUnexpected(); return }
      if (event.key.toLowerCase() === 'e' && callNode?.evidence?.length) {
        event.preventDefault(); overlayTriggerRef.current = document.activeElement as HTMLElement; setOverlay('evidence'); return
      }
      if (/^[1-6]$/.test(event.key) && !isTextInput(event.target)) {
        const response = activeNode?.responses?.[Number(event.key) - 1]
        if (response) { event.preventDefault(); session?.context === 'unexpected' ? chooseUnexpected(response) : navigateCall(response) }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [activeNode, callNode, chooseUnexpected, goBack, navigateCall, openUnexpected, overlay, screen, session?.context])

  const categories = useMemo(() => ['Todas', ...new Set(unexpectedRegistry.entries.map((entry) => entry.category))], [])
  const registryResults = useMemo(() => {
    const query = registryQuery.trim().toLocaleLowerCase('es')
    return unexpectedRegistry.entries.filter((entry) => {
      const categoryMatches = registryCategory === 'Todas' || entry.category === registryCategory
      const haystack = [entry.label, entry.category, ...entry.keywords].join(' ').toLocaleLowerCase('es')
      return categoryMatches && (!query || haystack.includes(query))
    }).slice(0, 12)
  }, [registryCategory, registryQuery])
  useEffect(() => setRegistryIndex(0), [registryCategory, registryQuery])

  function registryKeys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setRegistryIndex((value) => Math.min(value + 1, registryResults.length - 1)) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setRegistryIndex((value) => Math.max(value - 1, 0)) }
    if (event.key === 'Enter' && registryResults[registryIndex]) { event.preventDefault(); selectUnexpected(registryResults[registryIndex]) }
  }

  if (screen === 'import') {
    return (
      <main className="screen import-screen">
        <section className="import-card" aria-labelledby="import-title">
          <h1 id="import-title">Guion interactivo</h1>
          <p>Carga un archivo <strong>.call.json</strong> para iniciar una sesión.</p>
          <div className="drop-zone" onDragOver={(event) => event.preventDefault()} onDrop={(event: DragEvent) => { event.preventDefault(); void importFile(event.dataTransfer.files[0]) }}>
            <span>Arrastra aquí el archivo</span>
            <small>El archivo permanece en este navegador.</small>
          </div>
          <input ref={fileInputRef} className="visually-hidden" id="script-file" type="file" accept=".json,.call.json,application/json" onChange={(event) => void importFile(event.target.files?.[0])} />
          <button className="primary-button" type="button" onClick={() => fileInputRef.current?.click()}>Seleccionar archivo</button>
          <p className="format-note">Formato aceptado: .call.json</p>
          {!!errors.length && <div className="message error-message" role="alert"><strong>No se puede cargar el archivo</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
        </section>
        {overlay === 'restore' && script && session && (
          <Dialog title="Sesión guardada" labelledBy="restore-title">
            <p>Hay una sesión de <strong>{script.company.name}</strong>. Elige cómo continuar.</p>
            <div className="dialog-actions vertical-mobile">
              <button autoFocus className="primary-button" type="button" onClick={() => { setOverlay(null); setScreen(session.status === 'ended' ? 'end' : session.status === 'ready' ? 'ready' : 'call') }}>Continuar sesión</button>
              <button type="button" onClick={restart}>Empezar de nuevo</button>
              <button type="button" onClick={() => setOverlay(null)}>Cargar otro archivo</button>
            </div>
          </Dialog>
        )}
        {overlay === 'replace' && pendingReplacement && (
          <Dialog title="El contenido ha cambiado" labelledBy="replace-title" onClose={() => { setPendingReplacement(null); setOverlay(null) }}>
            <p>Ya existe una sesión con el identificador <strong>{pendingReplacement.script.script_id}</strong>, pero el contenido del archivo es distinto.</p>
            <div className="dialog-actions">
              <button autoFocus className="primary-button" type="button" onClick={() => applyImport(pendingReplacement.script, pendingReplacement.raw, pendingReplacement.hash, pendingReplacement.warnings)}>Reemplazar sesión</button>
              <button type="button" onClick={() => { setPendingReplacement(null); setOverlay(null) }}>Cancelar</button>
            </div>
          </Dialog>
        )}
      </main>
    )
  }

  if (screen === 'ready' && script) {
    const evidenceCount = script.nodes.reduce((total, node) => total + (node.evidence?.length ?? 0), 0)
    return (
      <main className="screen summary-screen">
        <section className="summary-card">
          <p className="eyebrow">Guion validado</p>
          <h1>{script.title}</h1>
          <dl className="summary-grid">
            <div><dt>Empresa</dt><dd>{script.company.name}</dd></div>
            {script.company.contact_name && <div><dt>Contacto</dt><dd>{script.company.contact_name}</dd></div>}
            {script.company.phone && <div><dt>Teléfono</dt><dd>{script.company.phone}</dd></div>}
            <div><dt>Nodos</dt><dd>{script.nodes.length}</dd></div>
            <div><dt>Evidencias</dt><dd>{evidenceCount}</dd></div>
          </dl>
          {!!warnings.length && <div className="message warning-message"><strong>Advertencias</strong><ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul><label className="acknowledge"><input type="checkbox" checked={warningsAccepted} onChange={(event) => setWarningsAccepted(event.target.checked)} /> He revisado las advertencias</label></div>}
          <div className="dialog-actions">
            <button className="primary-button" type="button" disabled={!!warnings.length && !warningsAccepted} onClick={startCall}>Iniciar llamada</button>
            <button type="button" onClick={loadAnother}>Cargar otro archivo</button>
          </div>
        </section>
      </main>
    )
  }

  if (screen === 'end' && script && session) {
    const outcome = script.outcomes.find((item) => item.id === session.outcomeId)
    const seconds = Math.max(0, Math.round((new Date(session.updatedAt).getTime() - new Date(session.startedAt).getTime()) / 1000))
    const selections = session.events.filter((event) => event.type === 'response' || event.type === 'unexpected_response').length
    const duration = seconds >= 60 ? `${Math.floor(seconds / 60)} min ${seconds % 60} s` : `${seconds} s`
    return (
      <main className="screen end-screen">
        <section className="end-card">
          <p className="eyebrow">Llamada finalizada</p>
          <h1>{outcome?.label ?? session.outcomeId ?? 'Finalizada'}</h1>
          <p className="end-stats">{selections} selecciones · {duration}</p>
          <div className="dialog-actions vertical-mobile">
            <button type="button" onClick={() => downloadSessionLog(script, session)}>Descargar registro</button>
            <button type="button" onClick={restart}>Reiniciar guion</button>
            <button type="button" onClick={loadAnother}>Cargar otro guion</button>
          </div>
        </section>
      </main>
    )
  }

  if (screen !== 'call' || !script || !session || !activeNode) {
    return <main className="screen fatal-screen"><h1>No se puede mostrar la sesión</h1><button type="button" onClick={loadAnother}>Cargar otro archivo</button></main>
  }

  const responses = activeNode.responses ?? []
  return (
    <main className="screen call-screen">
      <header className="call-header">
        <div className="company-block"><strong>{script.company.name}</strong><span>{[script.company.contact_name, script.company.contact_role, script.company.phone].filter(Boolean).join(' · ')}</span></div>
        <div className="header-actions">
          <button type="button" className="back-button" disabled={!session.history.length} onClick={goBack}>← Volver</button>
          <button type="button" className="close-script-button" onClick={loadAnother}>Cerrar guion</button>
        </div>
      </header>
      <div className="call-main">
        <section className="say-zone" aria-labelledby="caller-text">
          <h1 id="caller-text" className={callerTextClass(activeNode.say)} ref={headingRef} tabIndex={-1}>{activeNode.say}</h1>
        </section>
        <section className="responses-zone" aria-labelledby="response-heading">
          {responses.length > 0 && <h2 id="response-heading">{session.context === 'call' ? '¿Qué ha respondido el cliente?' : '¿Qué ocurre ahora?'}</h2>}
          {responses.length > 0 && <div className={`response-grid ${responses.length % 2 ? 'odd' : ''}`}>
            {responses.map((response, index) => <ResponseButton key={response.id} response={response} index={index} onClick={() => session.context === 'unexpected' ? chooseUnexpected(response) : navigateCall(response)} />)}
          </div>}
        </section>
        <footer className="utility-bar">
          <div>{callNode?.evidence?.length ? <button type="button" onClick={(event) => { overlayTriggerRef.current = event.currentTarget; setOverlay('evidence') }}>Evidencia</button> : null}</div>
          <div>{callNode?.responses ? <button type="button" className="unexpected-button" onClick={(event) => openUnexpected(event.currentTarget)}>Respuesta inesperada</button> : callNode?.terminal ? <button type="button" className="finish-button" onClick={finishCall}>Finalizar llamada</button> : null}</div>
          <div />
        </footer>
      </div>
      {runtimeError && <div className="runtime-error" role="alert"><span>{runtimeError}</span><button type="button" onClick={() => setRuntimeError('')}>Cerrar</button></div>}
      {overlay === 'unexpected' && (
        <Dialog title="Respuesta inesperada" labelledBy="unexpected-title" onClose={closeOverlay}>
          <input autoFocus className="search-input" type="search" placeholder="Buscar respuesta…" aria-label="Buscar respuesta inesperada" value={registryQuery} onChange={(event) => setRegistryQuery(event.target.value)} onKeyDown={registryKeys} />
          <div className="category-chips" aria-label="Categorías">{categories.map((category) => <button className={category === registryCategory ? 'active' : ''} type="button" key={category} onClick={() => setRegistryCategory(category)}>{category}</button>)}</div>
          <div className="registry-grid" role="listbox" aria-label="Respuestas inesperadas">
            {registryResults.map((entry, index) => <button className={index === registryIndex ? 'registry-item selected' : 'registry-item'} role="option" aria-selected={index === registryIndex} type="button" key={entry.id} onMouseEnter={() => setRegistryIndex(index)} onClick={() => selectUnexpected(entry)}><span>{entry.category}</span>{entry.label}</button>)}
            {!registryResults.length && <p className="empty-results">No hay coincidencias.</p>}
          </div>
        </Dialog>
      )}
      {overlay === 'evidence' && callNode?.evidence && (
        <Dialog title="Evidencia" labelledBy="evidence-title" onClose={closeOverlay}>
          <div className="evidence-list">{callNode.evidence.map((item, index) => <article className="evidence-card" key={`${item.title}-${index}`}><h3>{item.title}</h3>{item.text && <p>{item.text}</p>}{item.image_url && <img src={item.image_url} alt={item.text || item.title} onError={(event) => { event.currentTarget.hidden = true }} />}{item.url && <a href={item.url} target="_blank" rel="noopener noreferrer">Abrir fuente</a>}</article>)}</div>
        </Dialog>
      )}
    </main>
  )
}
