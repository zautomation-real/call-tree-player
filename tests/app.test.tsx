import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/app/App'
import type { CallScript, SessionState } from '../src/app/types'
import minimalData from '../fixtures/valid/minimal.call.json'
import repeatedData from '../fixtures/valid/repeated-provider.call.json'
import evidenceData from '../fixtures/valid/evidence.call.json'
import overrideData from '../fixtures/valid/unexpected-override.call.json'

const minimal = minimalData as CallScript
const repeated = repeatedData as CallScript
const evidence = evidenceData as CallScript
const override = overrideData as CallScript

function seed(script: CallScript, options: Partial<SessionState> = {}) {
  const hash = 'fixture-hash'
  const session: SessionState = {
    scriptId: script.script_id,
    scriptHash: hash,
    sessionId: 'session-1',
    startedAt: '2026-08-20T10:00:00.000Z',
    updatedAt: '2026-08-20T10:00:01.000Z',
    status: 'ready',
    context: 'call',
    currentId: script.start_node,
    history: [],
    events: [],
    ...options,
  }
  localStorage.setItem('call-tree-player:script', JSON.stringify({ script, raw: JSON.stringify(script), hash }))
  localStorage.setItem('call-tree-player:session', JSON.stringify(session))
}

async function openReady(script: CallScript) {
  seed(script)
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Continuar sesión' }))
  await user.click(screen.getByRole('button', { name: 'Iniciar llamada' }))
  return user
}

describe('Call Tree Player', () => {
  beforeEach(() => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001')
  })

  it('navega por clic y vuelve por el historial real', async () => {
    const user = await openReady(minimal)
    await user.click(screen.getByRole('button', { name: '1: Sí, soy yo' }))
    expect(screen.getByRole('heading', { name: /quería comentarte/i })).toBeVisible()
    await user.click(screen.getByRole('button', { name: '← Volver' }))
    expect(screen.getByRole('heading', { name: /podría hablar con Marta/i })).toBeVisible()
  })

  it('abre y copia el prompt para generar un archivo', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Prompt para generar tu .call.json' }))
    expect(screen.getByRole('dialog', { name: 'Prompt para generar tu .call.json' })).toBeVisible()
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Prompt para generar el archivo' }).value).toContain('CONTRATO JSON OBLIGATORIO')
    await user.click(screen.getByRole('button', { name: 'Copiar prompt' }))
    expect(screen.getByRole('button', { name: 'Prompt copiado' })).toBeVisible()
  })

  it('el teclado y el clic producen la misma navegación', async () => {
    await openReady(minimal)
    fireEvent.keyDown(document, { key: '1' })
    expect(screen.getByRole('heading', { name: /quería comentarte/i })).toBeVisible()
    fireEvent.keyDown(document, { key: 'Backspace' })
    expect(screen.getByRole('heading', { name: /podría hablar con Marta/i })).toBeVisible()
  })

  it('mantiene visible una respuesta repetida en momentos distintos', async () => {
    const user = await openReady(repeated)
    expect(screen.getByRole('button', { name: '1: Ya tenemos proveedor' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: '2: ¿Qué diferencia?' }))
    expect(screen.getByRole('button', { name: '1: Ya tenemos proveedor' })).toBeVisible()
  })

  it('muestra evidencia solo cuando existe y la cierra con Escape', async () => {
    await openReady(evidence)
    await userEvent.click(screen.getByRole('button', { name: 'Evidencia' }))
    expect(screen.getByRole('dialog', { name: 'Evidencia' })).toBeVisible()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Evidencia' })).not.toBeInTheDocument()
  })

  it('Escape cierra el registro incluso con el buscador enfocado y @return restaura el nodo', async () => {
    const user = await openReady(minimal)
    fireEvent.keyDown(document, { key: 'u' })
    const search = screen.getByRole('searchbox', { name: 'Buscar respuesta inesperada' })
    expect(search).toHaveFocus()
    fireEvent.keyDown(search, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Respuesta inesperada' })).not.toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'u' })
    await user.click(screen.getByRole('option', { name: /Cómo has conseguido mi número/i }))
    expect(screen.getByRole('heading', { name: /teléfono profesional publicado/i })).toBeVisible()
    await user.click(screen.getByRole('button', { name: '1: Continuar conversación' }))
    expect(screen.getByRole('heading', { name: /podría hablar con Marta/i })).toBeVisible()
  })

  it('usa la ruta específica del guion para una respuesta inesperada', async () => {
    const user = await openReady(override)
    fireEvent.keyDown(document, { key: 'u' })
    await user.click(screen.getByRole('option', { name: /No soy la persona adecuada/i }))
    expect(screen.getByRole('heading', { name: /Quién sería la persona adecuada/i })).toBeVisible()
  })

  it('muestra el texto terminal antes de finalizar', async () => {
    const user = await openReady(minimal)
    await user.click(screen.getByRole('button', { name: '1: Sí, soy yo' }))
    await user.click(screen.getByRole('button', { name: '1: Cuéntame' }))
    expect(screen.getByRole('heading', { name: /Perfecto, lo anoto/i })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Finalizar llamada' }))
    expect(screen.getByRole('heading', { name: 'Seguimiento' })).toBeVisible()
  })

  it('cierra el guion activo y elimina su sesión', async () => {
    const user = await openReady(minimal)
    await user.click(screen.getByRole('button', { name: 'Cerrar guion' }))
    expect(screen.getByRole('heading', { name: 'Guion interactivo' })).toBeVisible()
    expect(localStorage.getItem('call-tree-player:script')).toBeNull()
    expect(localStorage.getItem('call-tree-player:session')).toBeNull()
  })
})
