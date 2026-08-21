import Ajv2020, { type ErrorObject } from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import callScriptSchema from '../schemas/call-script.schema.json'
import registrySchema from '../schemas/unexpected-registry.schema.json'
import registryData from '../data/unexpected.registry.json'
import type { CallScript, UnexpectedRegistry, ValidationResult } from '../app/types'

const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats(ajv)
const validateSchema = ajv.compile<CallScript>(callScriptSchema)
const validateRegistrySchema = ajv.compile<UnexpectedRegistry>(registrySchema)

function displayPath(instancePath: string): string {
  if (!instancePath) return 'archivo'
  return instancePath
    .split('/')
    .filter(Boolean)
    .map((part, index) => (/^\d+$/.test(part) ? `[${part}]` : `${index ? '.' : ''}${part}`))
    .join('')
}

function schemaMessage(error: ErrorObject): string {
  const path = displayPath(error.instancePath)
  if (error.keyword === 'additionalProperties') {
    return `${path}.${String(error.params.additionalProperty)}: propiedad no permitida`
  }
  if (error.keyword === 'required') {
    return `${path}.${String(error.params.missingProperty)}: campo obligatorio`
  }
  if (error.keyword === 'maxItems') return `${path}: debe contener como máximo ${error.params.limit} elementos`
  if (error.keyword === 'minItems') return `${path}: debe contener al menos ${error.params.limit} elementos`
  if (error.keyword === 'oneOf') return `${path}: debe ser un nodo con respuestas o un nodo terminal válido`
  return `${path}: ${error.message ?? 'valor no válido'}`
}

function semanticValidation(script: CallScript): Pick<ValidationResult, 'errors' | 'warnings'> {
  const errors: string[] = []
  const warnings: string[] = []
  const nodeIds = script.nodes.map((node) => node.id)
  const nodeSet = new Set(nodeIds)
  const outcomeIds = script.outcomes.map((outcome) => outcome.id)
  const outcomeSet = new Set(outcomeIds)

  nodeIds.forEach((id, index) => {
    if (nodeIds.indexOf(id) !== index) errors.push(`nodes[${index}].id: el identificador "${id}" está duplicado`)
  })
  outcomeIds.forEach((id, index) => {
    if (outcomeIds.indexOf(id) !== index) errors.push(`outcomes[${index}].id: el identificador "${id}" está duplicado`)
  })
  if (!nodeSet.has(script.start_node)) errors.push(`start_node: el nodo "${script.start_node}" no existe`)

  script.nodes.forEach((node, nodeIndex) => {
    if (node.responses) {
      const responseIds = node.responses.map((response) => response.id)
      const labels = node.responses.map((response) => response.label)
      node.responses.forEach((response, responseIndex) => {
        if (responseIds.indexOf(response.id) !== responseIndex) {
          errors.push(`nodes[${nodeIndex}].responses[${responseIndex}].id: el identificador "${response.id}" está duplicado en este nodo`)
        }
        if (labels.indexOf(response.label) !== responseIndex) {
          errors.push(`nodes[${nodeIndex}].responses[${responseIndex}].label: la respuesta "${response.label}" está duplicada en este nodo`)
        }
        if (!nodeSet.has(response.next)) {
          errors.push(`nodes[${nodeIndex}].responses[${responseIndex}].next: el nodo destino "${response.next}" no existe`)
        }
      })
    }
    if (node.terminal && !outcomeSet.has(node.terminal.outcome)) {
      errors.push(`nodes[${nodeIndex}].terminal.outcome: el resultado "${node.terminal.outcome}" no existe`)
    }
    node.evidence?.forEach((evidence, evidenceIndex) => {
      if (evidence.image_url && !evidence.text) {
        warnings.push(`nodes[${nodeIndex}].evidence[${evidenceIndex}]: la imagen no tiene texto alternativo de respaldo`)
      }
    })
  })

  Object.entries(script.unexpected_routes ?? {}).forEach(([entry, target]) => {
    if (!nodeSet.has(target)) errors.push(`unexpected_routes.${entry}: el nodo destino "${target}" no existe`)
  })

  if (nodeSet.has(script.start_node)) {
    const reachable = new Set<string>()
    const queue = [script.start_node]
    while (queue.length) {
      const id = queue.shift()!
      if (reachable.has(id)) continue
      reachable.add(id)
      script.nodes.find((node) => node.id === id)?.responses?.forEach((response) => queue.push(response.next))
    }
    script.nodes.forEach((node, index) => {
      if (!reachable.has(node.id)) warnings.push(`nodes[${index}]: el nodo "${node.id}" no es alcanzable desde start_node`)
    })
  }

  return { errors, warnings }
}

export function validateCallScript(value: unknown): ValidationResult {
  if (!validateSchema(value)) {
    const messages = (validateSchema.errors ?? []).map(schemaMessage)
    return { valid: false, errors: [...new Set(messages)], warnings: [] }
  }
  const result = semanticValidation(value)
  return { valid: result.errors.length === 0, script: value, ...result }
}

export function parseAndValidate(raw: string): ValidationResult {
  try {
    return validateCallScript(JSON.parse(raw) as unknown)
  } catch (error) {
    const detail = error instanceof SyntaxError ? error.message : 'contenido ilegible'
    return { valid: false, errors: [`JSON no válido: ${detail}`], warnings: [] }
  }
}

export const unexpectedRegistry = registryData as UnexpectedRegistry
if (!validateRegistrySchema(unexpectedRegistry)) throw new Error('El registro de respuestas inesperadas incluido no es válido')
