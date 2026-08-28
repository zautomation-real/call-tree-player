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

  it('no rechaza una conversación que progresa por tener siete elecciones', () => {
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
    expect(result.valid).toBe(true)
    expect(result.warnings.join(' ')).not.toContain('ruta desde decisor')
  })

  it('advierte una ruta excepcionalmente profunda sin convertirla en error', () => {
    const script = structuredClone(bilingual)
    const terminal = script.nodes.pop()!
    let previous = 'identity'
    for (let index = 0; index < 15; index += 1) {
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
    expect(result.valid).toBe(true)
    expect(result.warnings.join(' ')).toContain('ruta desde decisor')
  })

  it('acepta identidad separada de Connect cuando existe una persona conocida', () => {
    const script = structuredClone(bilingual)
    script.nodes[0].responses![0].next = 'opening'
    script.nodes[0].responses![1].next = 'reception'
    script.nodes.splice(1, 0,
      {
        id: 'opening',
        say: {
          es: 'Marta, soy Zinddin, de Webs del Camp. He visto una diferencia en la carta en castellano. ¿Te la cuento en veinte segundos?',
          ca: 'Marta, soc en Zinddin, de Webs del Camp. He vist una diferència a la carta en català. Te la dic en vint segons?',
        },
        responses: [
          { id: 'yes', label: { es: 'Sí, dime', ca: 'Sí, digues' }, next: 'close', tone: 'advance' },
          { id: 'busy', label: { es: 'Ahora no puedo', ca: 'Ara no puc' }, next: 'close', tone: 'neutral' },
        ],
      },
      {
        id: 'reception',
        say: {
          es: 'Soy Zinddin, de Webs del Camp. He visto una diferencia en la carta en castellano. ¿Quién coordina el contenido web?',
          ca: 'Soc en Zinddin, de Webs del Camp. He vist una diferència a la carta en català. Qui coordina el contingut web?',
        },
        responses: [
          { id: 'route', label: { es: 'Te paso', ca: 'Et passo' }, next: 'close', tone: 'handoff' },
          { id: 'none', label: { es: 'No lo sé', ca: 'No ho sé' }, next: 'close', tone: 'close' },
        ],
      },
    )
    const result = evaluateWdcCall(script, {
      decisionEntry: 'opening',
      openingEntry: 'opening',
      receptionEntry: 'reception',
      openingMode: 'known-person',
      contactName: 'Marta',
      openingAnchors: { es: ['carta en castellano'], ca: ['carta en català'] },
    })
    expect(result.valid).toBe(true)
  })

  it('rechaza la apertura fusionada que motivó esta regresión', () => {
    const script = structuredClone(bilingual)
    script.nodes[0].say = {
      es: 'Hola. Soy Zinddin, de Webs del Camp. En el menú de Les 3 Marias aparecen descripciones en otro idioma. ¿Lo coordinas tú?',
      ca: 'Hola. Soc en Zinddin, de Webs del Camp. Al menú de Les 3 Marias apareixen descripcions en un altre idioma. Ho coordines tu?',
    }
    const result = evaluateWdcCall(script, {
      decisionEntry: 'identity',
      openingEntry: 'identity',
      openingMode: 'known-person',
      contactName: 'Marta',
      openingAnchors: { es: ['Les 3 Marias'], ca: ['Les 3 Marias'] },
    })
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toContain('antes de confirmar')
  })
})
