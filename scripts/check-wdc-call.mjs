import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const schema = JSON.parse(fs.readFileSync(path.join(projectRoot, 'src/schemas/call-script.schema.json'), 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats(ajv)
const validateSchema = ajv.compile(schema)

function localText(value, language) {
  return typeof value === 'string' ? value : value?.[language] ?? ''
}

function normalized(value) {
  return value.normalize('NFKC').toLocaleLowerCase('es')
}

function longestDecisionPath(nodes, entry) {
  const map = new Map(nodes.map((node) => [node.id, node]))
  const active = new Set()
  const memo = new Map()

  function visit(id) {
    if (active.has(id)) throw new Error(`ciclo detectado desde ${id}`)
    if (memo.has(id)) return memo.get(id)
    const node = map.get(id)
    if (!node) throw new Error(`nodo inexistente: ${id}`)
    if (!node.responses) return { choices: 0, path: [id] }
    active.add(id)
    const branches = node.responses.map((response) => visit(response.next))
    active.delete(id)
    const longest = branches.sort((a, b) => b.choices - a.choices)[0]
    const result = { choices: 1 + longest.choices, path: [id, ...longest.path] }
    memo.set(id, result)
    return result
  }

  return visit(entry)
}

export function evaluateWdcCall(script, options) {
  const errors = []
  const warnings = []
  if (!validateSchema(script)) {
    return { valid: false, errors: (validateSchema.errors ?? []).map((error) => `${error.instancePath || 'archivo'} ${error.message}`), warnings: [] }
  }

  const nodeMap = new Map(script.nodes.map((node) => [node.id, node]))
  if (script.nodes.length > 24) errors.push(`nodos: ${script.nodes.length}; máximo comercial: 24`)
  script.nodes.forEach((node) => {
    if ((node.responses?.length ?? 0) > 4) errors.push(`${node.id}: más de cuatro opciones visibles`)
    for (const language of ['es', 'ca']) {
      const text = localText(node.say, language)
      const limit = node.evidence?.length ? 300 : 220
      if (text.length > limit) errors.push(`${node.id}.${language}: ${text.length} caracteres; máximo ${limit}`)
      if ((text.match(/\?/g) ?? []).length > 1) errors.push(`${node.id}.${language}: contiene más de una pregunta`)
    }
  })

  const roots = [script.start_node, ...Object.values(script.unexpected_routes ?? {})]
  const reachable = new Set()
  const queue = [...roots]
  while (queue.length) {
    const id = queue.shift()
    if (reachable.has(id)) continue
    reachable.add(id)
    nodeMap.get(id)?.responses?.forEach((response) => queue.push(response.next))
  }
  script.nodes.filter((node) => !reachable.has(node.id)).forEach((node) => errors.push(`${node.id}: no alcanzable`))

  if (!nodeMap.has(options.decisionEntry)) errors.push(`decision-entry inexistente: ${options.decisionEntry}`)
  else {
    try {
      const longest = longestDecisionPath(script.nodes, options.decisionEntry)
      if (longest.choices > 6) errors.push(`ruta desde decisor: ${longest.choices} elecciones; máximo 6 (${longest.path.join(' > ')})`)
    } catch (error) {
      errors.push(error.message)
    }
  }

  const start = nodeMap.get(script.start_node)
  const decision = nodeMap.get(options.decisionEntry)
  for (const language of ['es', 'ca']) {
    const anchors = options.openingAnchors[language]
    if (!anchors.length) errors.push(`falta al menos un ancla factual para la apertura ${language}`)
    const startText = normalized(localText(start?.say, language))
    const decisionText = normalized(localText(decision?.say, language))
    anchors.forEach((anchor) => {
      const expected = normalized(anchor)
      if (!startText.includes(expected)) errors.push(`apertura ${language}: no contiene el ancla factual «${anchor}»`)
      if (!decisionText.includes(expected)) warnings.push(`continuidad ${language}: el nodo decisor no conserva el ancla «${anchor}»`)
    })
  }

  return { valid: errors.length === 0, errors, warnings }
}

function parseArgs(argv) {
  const args = [...argv]
  if (args[0] === '--') args.shift()
  const file = args.shift()
  const options = { decisionEntry: '', openingAnchors: { es: [], ca: [] } }
  while (args.length) {
    const flag = args.shift()
    const value = args.shift()
    if (!value) throw new Error(`falta valor para ${flag}`)
    if (flag === '--decision-entry') options.decisionEntry = value
    else if (flag === '--opening-es') options.openingAnchors.es.push(value)
    else if (flag === '--opening-ca') options.openingAnchors.ca.push(value)
    else throw new Error(`opción desconocida: ${flag}`)
  }
  if (!file || !options.decisionEntry) throw new Error('uso: check-wdc-call <archivo> --decision-entry <nodo> --opening-es <ancla> --opening-ca <ancla>')
  return { file, options }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { file, options } = parseArgs(process.argv.slice(2))
    const script = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'))
    const result = evaluateWdcCall(script, options)
    result.warnings.forEach((warning) => console.warn(`ADVERTENCIA: ${warning}`))
    if (!result.valid) {
      result.errors.forEach((error) => console.error(`ERROR: ${error}`))
      process.exit(1)
    }
    console.log(`WDC_CALL_GATE_OK nodes=${script.nodes.length} decision_entry=${options.decisionEntry}`)
  } catch (error) {
    console.error(`ERROR: ${error.message}`)
    process.exit(1)
  }
}
