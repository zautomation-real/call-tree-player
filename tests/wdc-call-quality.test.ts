import { describe, expect, it } from 'vitest'
import bilingual from '../fixtures/valid/bilingual.call.json'
import { evaluateWdcCall } from '../scripts/check-wdc-call.mjs'

const options = {
  decisionEntry: 'identity',
  openingAnchors: { es: ['Marta'], ca: ['Marta'] },
}

describe('gate comercial de guiones WDC', () => {
  it('acepta un árbol breve con ancla factual explícita', () => {
    expect(evaluateWdcCall(structuredClone(bilingual), options).valid).toBe(true)
  })

  it('rechaza una apertura que ha perdido el ancla de la cuenta', () => {
    const script = structuredClone(bilingual)
    script.nodes[0].say.es = 'Hola, quería hablar con la persona responsable.'
    const result = evaluateWdcCall(script, options)
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toContain('ancla factual')
  })

  it('rechaza una ruta de más de seis elecciones desde el decisor', () => {
    const script = structuredClone(bilingual)
    const terminal = script.nodes.pop()!
    let previous = 'identity'
    for (let index = 0; index < 6; index += 1) {
      const id = `step_${index}`
      const previousNode = script.nodes.find((node) => node.id === previous)!
      previousNode.responses!.forEach((response) => { response.next = id })
      script.nodes.push({
        id,
        say: { es: `Paso ${index}`, ca: `Pas ${index}` },
        responses: [
          { id: 'yes', label: { es: 'Sí', ca: 'Sí' }, next: terminal.id, tone: 'advance' },
          { id: 'no', label: { es: 'No', ca: 'No' }, next: terminal.id, tone: 'close' },
        ],
      })
      previous = id
    }
    script.nodes.find((node) => node.id === previous)!.responses!.forEach((response) => { response.next = terminal.id })
    script.nodes.push(terminal)
    const result = evaluateWdcCall(script, options)
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toContain('máximo 6')
  })
})
