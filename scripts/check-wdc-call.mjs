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
  if (script.nodes.length > 40) errors.push(`nodos: ${script.nodes.length}; límite absoluto: 40`)
  else if (script.nodes.length > 30) warnings.push(`nodos: ${script.nodes.length}; revisar carga cognitiva a partir de 30`)
  script.nodes.forEach((node) => {
    if ((node.responses?.length ?? 0) > 4) errors.push(`${node.id}: más de cuatro opciones visibles`)
    for (const language of ['es', 'ca']) {
      const text = localText(node.say, language)
      if (text.length > 700) errors.push(`${node.id}.${language}: ${text.length} caracteres; máximo absoluto 700`)
      else if (text.length > 380) warnings.push(`${node.id}.${language}: ${text.length} caracteres; requiere lectura oral consciente`)
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
      if (longest.choices > 14) warnings.push(`ruta desde decisor: ${longest.choices} elecciones; revisar la ruta, sin fusionar etapas humanas solo para reducir profundidad (${longest.path.join(' > ')})`)
    } catch (error) {
      errors.push(error.message)
    }
  }

  const start = nodeMap.get(script.start_node)
  const opening = nodeMap.get(options.openingEntry ?? script.start_node)
  const reception = options.receptionEntry ? nodeMap.get(options.receptionEntry) : undefined
  const decision = nodeMap.get(options.decisionEntry)
  if (!opening) errors.push(`opening-entry inexistente: ${options.openingEntry}`)
  if (options.receptionEntry && !reception) errors.push(`reception-entry inexistente: ${options.receptionEntry}`)

  if (options.openingMode === 'known-person') {
    const identity = nodeMap.get(options.identityEntry ?? script.start_node)
    if (!identity) errors.push(`identity-entry inexistente: ${options.identityEntry}`)
    for (const language of ['es', 'ca']) {
      const startText = normalized(localText(identity?.say, language))
      const contactName = normalized(options.contactName ?? script.company?.contact_name ?? '')
      if (!contactName || !startText.includes(contactName)) errors.push(`identidad ${language}: el inicio no confirma el nombre conocido`)
      if (startText.includes('webs del camp')) errors.push(`identidad ${language}: presenta Webs del Camp antes de confirmar a la persona`)
      if (startText.length > 120) errors.push(`identidad ${language}: mezcla confirmación con contexto comercial (${startText.length} caracteres)`)
    }
    if (!identity?.responses?.some((response) => response.next === options.openingEntry)) {
      errors.push(`identidad: ninguna respuesta conduce al opening-entry ${options.openingEntry}`)
    }
  }

  for (const language of ['es', 'ca']) {
    const anchors = options.openingAnchors[language]
    if (!anchors.length) errors.push(`falta al menos un ancla factual para la apertura ${language}`)
    const openingText = normalized(localText(opening?.say, language))
    const receptionText = normalized(localText(reception?.say, language))
    const decisionText = normalized(localText(decision?.say, language))
    anchors.forEach((anchor) => {
      const expected = normalized(anchor)
      if (!openingText.includes(expected)) errors.push(`Connect ${language}: no contiene el ancla factual «${anchor}»`)
      if (reception && !receptionText.includes(expected)) errors.push(`recepción ${language}: no contiene el ancla factual «${anchor}»`)
      if (!decisionText.includes(expected)) warnings.push(`continuidad ${language}: el nodo decisor no conserva el ancla «${anchor}»`)
    })
    if (options.openingMode && !normalized(localText(opening?.say, language)).includes('webs del camp')) errors.push(`Connect ${language}: no identifica Webs del Camp`)
  }

  return { valid: errors.length === 0, errors, warnings }
}

function parseArgs(argv) {
  const args = [...argv]
  if (args[0] === '--') args.shift()
  const file = args.shift()
  const options = { decisionEntry: '', identityEntry: undefined, openingEntry: undefined, receptionEntry: undefined, openingMode: 'reception', contactName: '', openingAnchors: { es: [], ca: [] } }
  while (args.length) {
    const flag = args.shift()
    const value = args.shift()
    if (!value) throw new Error(`falta valor para ${flag}`)
    if (flag === '--decision-entry') options.decisionEntry = value
    else if (flag === '--identity-entry') options.identityEntry = value
    else if (flag === '--opening-entry') options.openingEntry = value
    else if (flag === '--reception-entry') options.receptionEntry = value
    else if (flag === '--opening-mode') options.openingMode = value
    else if (flag === '--contact-name') options.contactName = value
    else if (flag === '--opening-es') options.openingAnchors.es.push(value)
    else if (flag === '--opening-ca') options.openingAnchors.ca.push(value)
    else throw new Error(`opción desconocida: ${flag}`)
  }
  if (!file || !options.decisionEntry) throw new Error('uso: check-wdc-call <archivo> --decision-entry <nodo> [--identity-entry <nodo>] [--opening-entry <nodo>] [--opening-mode known-person|reception] [--contact-name <nombre>] [--reception-entry <nodo>] --opening-es <ancla> --opening-ca <ancla>')
  if (!['known-person', 'reception'].includes(options.openingMode)) throw new Error(`opening-mode desconocido: ${options.openingMode}`)
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
