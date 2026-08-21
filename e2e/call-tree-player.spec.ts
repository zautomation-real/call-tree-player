import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const fixture = (kind: 'valid' | 'invalid', name: string) => path.resolve(`fixtures/${kind}/${name}`)

async function importScript(page: Page, file: string) {
  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles(file)
}

async function startScript(page: Page, file: string) {
  await importScript(page, file)
  await expect(page.getByText('Guion validado')).toBeVisible()
  await page.getByRole('button', { name: 'Iniciar llamada' }).click()
}

test.describe('importación y validación', () => {
  for (const name of ['minimal.call.json', 'repeated-provider.call.json', 'evidence.call.json', 'unexpected-override.call.json']) {
    test(`carga ${name}`, async ({ page }) => {
      await importScript(page, fixture('valid', name))
      await expect(page.getByText('Guion validado')).toBeVisible()
    })
  }

  for (const [name, message] of [
    ['missing-target.call.json', 'no existe'],
    ['too-many-responses.call.json', 'como máximo 6'],
    ['duplicate-node-id.call.json', 'duplicado'],
    ['duplicate-response-label.call.json', 'duplicada'],
  ]) {
    test(`rechaza ${name}`, async ({ page }) => {
      await importScript(page, fixture('invalid', name))
      await expect(page.getByRole('alert')).toContainText(message)
    })
  }
})

test('navegación, repetición, Back y recuperación tras recarga', async ({ page }) => {
  await startScript(page, fixture('valid', 'repeated-provider.call.json'))
  await expect(page.getByRole('button', { name: '1: Ya tenemos proveedor' })).toBeVisible()
  await page.getByRole('button', { name: '2: ¿Qué diferencia?' }).click()
  await expect(page.getByRole('button', { name: '1: Ya tenemos proveedor' })).toBeVisible()
  await page.getByRole('button', { name: '2: Dime dónde' }).click()
  await page.getByRole('button', { name: '1: Por correo' }).click()
  await page.reload()
  await expect(page.getByRole('dialog', { name: 'Sesión guardada' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar sesión' }).click()
  await expect(page.getByRole('heading', { name: /Perfecto, te lo envío/i })).toBeVisible()
  await page.getByRole('button', { name: '← Volver' }).click()
  await expect(page.getByRole('heading', { name: /Prefieres que te lo envíe/i })).toBeVisible()
})

test('un mismo script_id con contenido distinto exige confirmar el reemplazo', async ({ page }) => {
  await startScript(page, fixture('valid', 'minimal.call.json'))
  await page.reload()
  await page.getByRole('button', { name: 'Cargar otro archivo' }).click()
  const minimalScript = JSON.parse(await readFile(fixture('valid', 'minimal.call.json'), 'utf8')) as Record<string, unknown>
  await page.locator('input[type="file"]').setInputFiles({
    name: 'minimal-modificado.call.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...minimalScript, title: 'Contenido modificado' })),
  })
  await expect(page.getByRole('dialog', { name: 'El contenido ha cambiado' })).toBeVisible()
  await page.getByRole('button', { name: 'Reemplazar sesión' }).click()
  await expect(page.getByRole('heading', { name: 'Contenido modificado' })).toBeVisible()
})

test('evidencia, registro inesperado, @return y override', async ({ page }) => {
  await startScript(page, fixture('valid', 'evidence.call.json'))
  await page.getByRole('button', { name: 'Evidencia' }).click()
  await expect(page.getByRole('dialog', { name: 'Evidencia' })).toContainText('Datos diferentes')
  await page.keyboard.press('Escape')
  await page.keyboard.press('u')
  const search = page.getByRole('searchbox', { name: 'Buscar respuesta inesperada' })
  await expect(search).toBeFocused()
  await search.fill('número')
  await expect(page.getByRole('option', { name: /Cómo has conseguido mi número/i })).toBeVisible()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: '1: Continuar conversación' }).click()
  await expect(page.getByRole('heading', { name: /dos teléfonos distintos/i })).toBeVisible()

  await page.evaluate(() => localStorage.clear())
  await startScript(page, fixture('valid', 'unexpected-override.call.json'))
  await page.keyboard.press('u')
  await page.getByRole('option', { name: /No soy la persona adecuada/i }).click()
  await expect(page.getByRole('heading', { name: /Quién sería la persona adecuada/i })).toBeVisible()
})

test('terminal, final y descarga de un registro JSON', async ({ page }) => {
  await startScript(page, fixture('valid', 'minimal.call.json'))
  await page.keyboard.press('1')
  await page.keyboard.press('1')
  await expect(page.getByRole('button', { name: 'Finalizar llamada' })).toBeVisible()
  await page.getByRole('button', { name: 'Finalizar llamada' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar registro' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('minimal-001.call-session.json')
  const downloadedPath = await download.path()
  expect(downloadedPath).not.toBeNull()
  const log = JSON.parse(await readFile(downloadedPath!, 'utf8')) as { script_id: string; outcome: string; events: unknown[] }
  expect(log.script_id).toBe('minimal-001')
  expect(log.outcome).toBe('follow_up')
  expect(log.events.length).toBeGreaterThan(0)
})

test('@end finaliza desde una respuesta inesperada', async ({ page }) => {
  await startScript(page, fixture('valid', 'minimal.call.json'))
  await page.keyboard.press('u')
  await page.getByRole('option', { name: /No vuelvas a contactar/i }).click()
  await page.getByRole('button', { name: '1: Finalizar llamada' }).click()
  await expect(page.getByRole('heading', { name: 'do_not_contact' })).toBeVisible()
})

test('geometría desktop, seis botones y accesibilidad', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await startScript(page, fixture('valid', 'six-responses.call.json'))
  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect()
    const main = rect('.call-main')
    const say = rect('.say-zone')
    const responses = rect('.responses-zone')
    const utility = rect('.utility-bar')
    const buttons = [...document.querySelectorAll('.response')].map((button) => button.getBoundingClientRect())
    return {
      documentFits: document.documentElement.scrollHeight === innerHeight,
      headerHeight: rect('.call-header').height,
      callerRatio: say.height / main.height,
      lowerRatio: (responses.height + utility.height) / main.height,
      buttons: buttons.map(({ height, bottom }) => ({ height, bottom })),
    }
  })
  expect(geometry.documentFits).toBe(true)
  expect(geometry.headerHeight).toBeLessThanOrEqual(60)
  expect(geometry.callerRatio).toBeGreaterThanOrEqual(.42)
  expect(geometry.callerRatio).toBeLessThanOrEqual(.52)
  expect(geometry.lowerRatio).toBeGreaterThanOrEqual(.48)
  expect(geometry.lowerRatio).toBeLessThanOrEqual(.58)
  expect(geometry.buttons).toHaveLength(6)
  for (const button of geometry.buttons) {
    expect(button.height).toBeGreaterThanOrEqual(86)
    expect(button.bottom).toBeLessThanOrEqual(900)
  }
  const accessibility = await new AxeBuilder({ page }).analyze()
  expect(accessibility.violations).toEqual([])
  await page.screenshot({ path: path.resolve('artifacts/screenshots/desktop-1440x900.png') })
})

test('fallback móvil usable y sin desplazamiento horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await startScript(page, fixture('valid', 'six-responses.call.json'))
  const mobile = await page.evaluate(() => ({
    fits: document.documentElement.scrollWidth <= innerWidth,
    columns: getComputedStyle(document.querySelector('.response-grid')!).gridTemplateColumns.split(' ').length,
    utilityBottom: document.querySelector('.utility-bar')!.getBoundingClientRect().bottom,
  }))
  expect(mobile.fits).toBe(true)
  expect(mobile.columns).toBe(1)
  expect(mobile.utilityBottom).toBeLessThanOrEqual(844)
  await page.screenshot({ path: path.resolve('artifacts/screenshots/mobile-390x844.png') })
})

test('un texto caller largo permanece dentro de su zona y el guion se puede cerrar', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  const source = JSON.parse(await readFile(fixture('valid', 'six-responses.call.json'), 'utf8')) as {
    nodes: Array<{ say: string }>
  } & Record<string, unknown>
  source.nodes[0].say = 'Este es un texto largo preparado para comprobar que la intervención completa sigue siendo legible y nunca invade las respuestas del cliente. '.repeat(8).trim()
  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles({
    name: 'texto-largo.call.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(source)),
  })
  await page.getByRole('button', { name: 'Iniciar llamada' }).click()
  const bounds = await page.evaluate(() => {
    const zone = document.querySelector('.say-zone')!.getBoundingClientRect()
    const heading = document.querySelector('.caller-text')!.getBoundingClientRect()
    const responses = document.querySelector('.responses-zone')!.getBoundingClientRect()
    return { zoneBottom: zone.bottom, headingBottom: heading.bottom, responsesTop: responses.top }
  })
  expect(bounds.headingBottom).toBeLessThanOrEqual(bounds.zoneBottom)
  expect(bounds.zoneBottom).toBeLessThanOrEqual(bounds.responsesTop)
  await expect(page.getByRole('button', { name: 'Cerrar guion' })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar guion' }).click()
  await expect(page.getByRole('heading', { name: 'Guion interactivo' })).toBeVisible()
})
