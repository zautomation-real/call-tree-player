import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react'
import type { CallNode, CallScript, HistoryEntry, Language, Response, SessionState, UnexpectedEntry } from './types'
import { hashText } from '../services/hashing'
import { clearAll, loadStored, saveImportedScript, saveSession } from '../services/persistence'
import { downloadSessionLog } from '../services/sessionLog'
import { parseAndValidate, unexpectedRegistry, validateCallScript } from '../services/validation'
import { allText, resolveText } from '../services/localization'
import promptDocument from '../../PROMPT_CREAR_CALL_JSON.md?raw'

type Screen = 'import' | 'ready' | 'call' | 'end'
type Overlay = 'restore' | 'replace' | 'unexpected' | 'evidence' | 'prompt' | null

const generatorPrompt = promptDocument.match(/```text\r?\n([\s\S]*?)\r?\n```/)?.[1].trim() ?? promptDocument.trim()

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
    language: script.default_language ?? 'es',
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

function ResponseButton({ response, index, language, onClick }: { response: Response; index: number; language: Language; onClick: () => void }) {
  const label = resolveText(response.label, language)
  return (
    <button className={`response tone-${response.tone ?? 'neutral'}`} type="button" aria-label={`${index + 1}: ${label}`} onClick={onClick}>
      <span className="shortcut" aria-hidden="true">{index + 1}</span>
      <span>{label}</span>
    </button>
  )
}

function BrandCredit({ utility = false }: { utility?: boolean }) {
  const credit = (
    <a className="brand-credit__link" href="https://websdelcamp.cat/ca?utm_source=guionizador&utm_medium=app&utm_campaign=enlace_marca" target="_blank" rel="noopener noreferrer" aria-label="Visitar Webs del Camp">
      <img src="./wdc-footer-icon.png" alt="" aria-hidden="true" />
      <span className="brand-credit__copy"><small>Ofrecido por</small><strong>Webs del Camp</strong></span>
      <span className="brand-credit__arrow" aria-hidden="true">↗</span>
    </a>
  )
  if (utility) return <span className="brand-credit brand-credit--utility">{credit}</span>
  return <footer className="brand-credit brand-credit--floating">{credit}</footer>
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
  const [promptCopyStatus, setPromptCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [pendingReplacement, setPendingReplacement] = useState<{ script: CallScript; raw: string; hash: string; warnings: string[] } | null>(null)
  const [registryQuery, setRegistryQuery] = useState('')
  const [registryCategory, setRegistryCategory] = useState('@all')
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
  const language = session?.language ?? script?.default_language ?? 'es'
  const activeSay = activeNode ? resolveText(activeNode.say, language) : ''

  const switchLanguage = useCallback((nextLanguage: Language) => {
    if (!session || session.language === nextLanguage) return
    persistSession({ ...session, language: nextLanguage })
    setRegistryCategory('@all')
  }, [persistSession, session])

  const closeOverlay = useCallback(() => {
    setOverlay(null)
    setPromptCopyStatus('idle')
    requestAnimationFrame(() => {
      if (!document.querySelector('[role="dialog"]')) overlayTriggerRef.current?.focus()
    })
  }, [])

  const copyGeneratorPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generatorPrompt)
      setPromptCopyStatus('copied')
    } catch {
      setPromptCopyStatus('error')
    }
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
      events: [...session.events, { type: 'response', nodeId: callNode.id, responseId: response.id, label: resolveText(response.label, language), language, at: now() }],
    })
  }, [callNode, language, persistSession, script, session])

  const openUnexpected = useCallback((trigger?: HTMLElement) => {
    if (!callNode?.responses) return
    overlayTriggerRef.current = trigger ?? document.activeElement as HTMLElement
    setRegistryQuery(''); setRegistryCategory('@all'); setRegistryIndex(0); setOverlay('unexpected')
  }, [callNode])

  const selectUnexpected = useCallback((entry: UnexpectedEntry) => {
    if (!script || !session) return
    const origin: HistoryEntry = { context: session.context, id: session.currentId }
    const override = script.unexpected_routes?.[entry.id]
    const baseEvents = [...session.events, { type: 'unexpected_selected', entryId: entry.id, label: resolveText(entry.label, language), language, at: now() }]
    if (override) {
      persistSession({ ...session, context: 'call', currentId: override, history: [...session.history, origin], events: baseEvents })
    } else {
      persistSession({ ...session, context: 'unexpected', currentId: entry.id, history: [...session.history, origin], events: baseEvents })
    }
    setOverlay(null)
    setScreen('call')
  }, [language, persistSession, script, session])

  const chooseUnexpected = useCallback((response: Response) => {
    if (!session || !unexpectedNode) return
    const events = [...session.events, { type: 'unexpected_response', entryId: unexpectedNode.id, responseId: response.id, label: resolveText(response.label, language), language, at: now() }]
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
  }, [language, persistSession, session, unexpectedNode])

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

  const allCategoryLabel = language === 'ca' ? 'Totes' : 'Todas'
  const categories = useMemo(() => ['@all', ...new Set(unexpectedRegistry.entries.map((entry) => resolveText(entry.category, language)))], [language])
  const registryResults = useMemo(() => {
    const query = registryQuery.trim().toLocaleLowerCase('es')
    return unexpectedRegistry.entries.filter((entry) => {
      const categoryMatches = registryCategory === '@all' || resolveText(entry.category, language) === registryCategory
      const haystack = [...allText(entry.label), ...allText(entry.category), ...entry.keywords].join(' ').toLocaleLowerCase(language)
      return categoryMatches && (!query || haystack.includes(query))
    }).slice(0, 12)
  }, [language, registryCategory, registryQuery])
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
          <button className="prompt-button" type="button" onClick={() => { setPromptCopyStatus('idle'); setOverlay('prompt') }}>Prompt para generar tu .call.json</button>
          {!!errors.length && <div className="message error-message" role="alert"><strong>No se puede cargar el archivo</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
        </section>
        <BrandCredit />
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
        {overlay === 'prompt' && (
          <Dialog title="Prompt para generar tu .call.json" labelledBy="prompt-title" onClose={closeOverlay}>
            <textarea className="prompt-textarea" readOnly value={generatorPrompt} aria-label="Prompt para generar el archivo" />
            <div className="dialog-actions prompt-actions">
              <button autoFocus className="primary-button" type="button" onClick={() => void copyGeneratorPrompt()}>{promptCopyStatus === 'copied' ? 'Prompt copiado' : 'Copiar prompt'}</button>
              {promptCopyStatus === 'error' && <span className="copy-error" role="alert">No se pudo copiar. Selecciona el texto manualmente.</span>}
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
        <BrandCredit />
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
          <h1>{outcome ? resolveText(outcome.label, language) : session.outcomeId ?? 'Finalizada'}</h1>
          <p className="end-stats">{selections} selecciones · {duration}</p>
          <div className="dialog-actions vertical-mobile">
            <button type="button" onClick={() => downloadSessionLog(script, session)}>Descargar registro</button>
            <button type="button" onClick={restart}>Reiniciar guion</button>
            <button type="button" onClick={loadAnother}>Cargar otro guion</button>
          </div>
        </section>
        <BrandCredit />
      </main>
    )
  }

  if (screen !== 'call' || !script || !session || !activeNode) {
    return <main className="screen fatal-screen"><h1>No se puede mostrar la sesión</h1><button type="button" onClick={loadAnother}>Cargar otro archivo</button><BrandCredit /></main>
  }

  const responses = activeNode.responses ?? []
  return (
    <main className="screen call-screen">
      <header className="call-header">
        <div className="company-block"><strong>{script.company.name}</strong><span>{[script.company.contact_name, script.company.contact_role, script.company.phone].filter(Boolean).join(' · ')}</span></div>
        <div className="header-actions">
          <div className="language-switch" role="group" aria-label="Idioma del guion">
            <button type="button" aria-pressed={language === 'ca'} onClick={() => switchLanguage('ca')}>CAT</button>
            <span aria-hidden="true">|</span>
            <button type="button" aria-pressed={language === 'es'} onClick={() => switchLanguage('es')}>ES</button>
          </div>
          <button type="button" className="back-button" disabled={!session.history.length} onClick={goBack}>← Volver</button>
          <button type="button" className="close-script-button" onClick={loadAnother}>Cerrar guion</button>
        </div>
      </header>
      <div className="call-main">
        <section className="say-zone" aria-labelledby="caller-text">
          <h1 id="caller-text" className={callerTextClass(activeSay)} ref={headingRef} tabIndex={-1}>{activeSay}</h1>
        </section>
        <section className="responses-zone" aria-labelledby="response-heading">
          {responses.length > 0 && <h2 id="response-heading">{session.context === 'call' ? '¿Qué ha respondido el cliente?' : '¿Qué ocurre ahora?'}</h2>}
          {responses.length > 0 && <div className={`response-grid ${responses.length % 2 ? 'odd' : ''}`}>
            {responses.map((response, index) => <ResponseButton key={response.id} response={response} index={index} language={language} onClick={() => session.context === 'unexpected' ? chooseUnexpected(response) : navigateCall(response)} />)}
          </div>}
        </section>
        <footer className="utility-bar">
          <div>{callNode?.evidence?.length ? <button type="button" onClick={(event) => { overlayTriggerRef.current = event.currentTarget; setOverlay('evidence') }}>Evidencia</button> : null}</div>
          <div>{callNode?.responses ? <button type="button" className="unexpected-button" onClick={(event) => openUnexpected(event.currentTarget)}>Respuesta inesperada</button> : callNode?.terminal ? <button type="button" className="finish-button" onClick={finishCall}>Finalizar llamada</button> : null}</div>
          <div><BrandCredit utility /></div>
        </footer>
      </div>
      {runtimeError && <div className="runtime-error" role="alert"><span>{runtimeError}</span><button type="button" onClick={() => setRuntimeError('')}>Cerrar</button></div>}
      {overlay === 'unexpected' && (
        <Dialog title="Respuesta inesperada" labelledBy="unexpected-title" onClose={closeOverlay}>
          <input autoFocus className="search-input" type="search" placeholder="Buscar respuesta…" aria-label="Buscar respuesta inesperada" value={registryQuery} onChange={(event) => setRegistryQuery(event.target.value)} onKeyDown={registryKeys} />
          <div className="category-chips" aria-label="Categorías">{categories.map((category) => <button className={category === registryCategory ? 'active' : ''} type="button" key={category} onClick={() => setRegistryCategory(category)}>{category === '@all' ? allCategoryLabel : category}</button>)}</div>
          <div className="registry-grid" role="listbox" aria-label="Respuestas inesperadas">
            {registryResults.map((entry, index) => <button className={index === registryIndex ? 'registry-item selected' : 'registry-item'} role="option" aria-selected={index === registryIndex} type="button" key={entry.id} onMouseEnter={() => setRegistryIndex(index)} onClick={() => selectUnexpected(entry)}><span>{resolveText(entry.category, language)}</span>{resolveText(entry.label, language)}</button>)}
            {!registryResults.length && <p className="empty-results">No hay coincidencias.</p>}
          </div>
        </Dialog>
      )}
      {overlay === 'evidence' && callNode?.evidence && (
        <Dialog title="Evidencia" labelledBy="evidence-title" onClose={closeOverlay}>
          <div className="evidence-list">{callNode.evidence.map((item, index) => { const title = resolveText(item.title, language); const evidenceText = item.text ? resolveText(item.text, language) : ''; return <article className="evidence-card" key={`${title}-${index}`}><h3>{title}</h3>{evidenceText && <p>{evidenceText}</p>}{item.image_url && <img src={item.image_url} alt={evidenceText || title} onError={(event) => { event.currentTarget.hidden = true }} />}{item.url && <a href={item.url} target="_blank" rel="noopener noreferrer">Abrir fuente</a>}</article> })}</div>
        </Dialog>
      )}
    </main>
  )
}
