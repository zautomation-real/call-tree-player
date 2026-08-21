import { describe, expect, it } from 'vitest'
import { validateCallScript } from '../src/services/validation'
import minimal from '../fixtures/valid/minimal.call.json'
import repeated from '../fixtures/valid/repeated-provider.call.json'
import evidence from '../fixtures/valid/evidence.call.json'
import unexpectedOverride from '../fixtures/valid/unexpected-override.call.json'
import duplicateNode from '../fixtures/invalid/duplicate-node-id.call.json'
import duplicateLabel from '../fixtures/invalid/duplicate-response-label.call.json'
import missingTarget from '../fixtures/invalid/missing-target.call.json'
import tooMany from '../fixtures/invalid/too-many-responses.call.json'

describe('validación de guiones', () => {
  it.each([
    ['minimal', minimal],
    ['repeated-provider', repeated],
    ['evidence', evidence],
    ['unexpected-override', unexpectedOverride],
  ])('acepta el fixture válido %s', (_name, fixture) => {
    expect(validateCallScript(fixture).errors).toEqual([])
    expect(validateCallScript(fixture).valid).toBe(true)
  })

  it.each([
    ['duplicate-node', duplicateNode, 'duplicado'],
    ['duplicate-label', duplicateLabel, 'duplicada'],
    ['missing-target', missingTarget, 'no existe'],
    ['too-many', tooMany, 'como máximo 6'],
  ])('rechaza el fixture inválido %s con un mensaje útil', (_name, fixture, message) => {
    const result = validateCallScript(fixture)
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toContain(message)
  })

  it('acepta etiquetas repetidas entre nodos distintos', () => {
    expect(validateCallScript(repeated).valid).toBe(true)
  })
})
