import { readFileSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024
const SAFE_ENV_NAMES = new Set(['.env.example', '.env.sample', '.env.template'])

const secretPatterns = [
  ['llave privada', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['clave secreta de Supabase', /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g],
  ['token de GitHub', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/g],
  ['clave de AWS', /\bAKIA[0-9A-Z]{16}\b/g],
  ['clave de pago real', /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/g],
  ['URL de base de datos con contraseña', /\bpostgres(?:ql)?:\/\/[^:\s/@]+:[^@\s/]{8,}@[^\s'"`]+/gi],
]

const privilegedAssignment = /\b(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY)\b\s*[:=]\s*["']?([^\s"'`;]{16,})/gi

function normalizePath(filePath) {
  return filePath.replaceAll('\\', '/')
}

function isPlaceholder(value) {
  const normalized = value.toLowerCase()
  return value.includes('${')
    || value.includes('{{')
    || normalized.startsWith('process.env.')
    || normalized.startsWith('import.meta.env.')
    || normalized.startsWith('deno.env.')
    || normalized.includes('example')
    || normalized.includes('placeholder')
    || normalized.includes('your_')
    || normalized.includes('tu_')
    || /^<.*>$/.test(value)
}

export function riskyTrackedPath(filePath) {
  const normalized = normalizePath(filePath)
  const baseName = normalized.split('/').at(-1)?.toLowerCase() ?? ''
  if ((baseName === '.env' || baseName.startsWith('.env.')) && !SAFE_ENV_NAMES.has(baseName)) {
    return 'archivo de variables privadas'
  }
  if (/\.(?:pem|key|p12|pfx)$/i.test(baseName)) return 'archivo de credencial privada'
  return null
}

export function scanText(filePath, text) {
  const findings = []
  for (const [label, pattern] of secretPatterns) {
    pattern.lastIndex = 0
    if (pattern.test(text)) findings.push(`${filePath}: posible ${label}`)
  }

  privilegedAssignment.lastIndex = 0
  for (const match of text.matchAll(privilegedAssignment)) {
    if (!isPlaceholder(match[1])) {
      findings.push(`${filePath}: posible clave administrativa de Supabase`)
    }
  }
  return findings
}

export function trackedFiles(cwd = process.cwd()) {
  const result = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd, encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'No se pudo obtener la lista de archivos versionados.')
  }
  return result.stdout.split('\0').filter(Boolean)
}

export function scanRepository(cwd = process.cwd()) {
  const findings = []
  for (const relativePath of trackedFiles(cwd)) {
    const riskyPath = riskyTrackedPath(relativePath)
    if (riskyPath) findings.push(`${relativePath}: ${riskyPath}`)

    const fullPath = new URL(normalizePath(relativePath), `file:///${normalizePath(cwd)}/`)
    let size
    try {
      size = statSync(fullPath).size
    } catch {
      continue
    }
    if (size > MAX_TEXT_FILE_BYTES) continue

    const buffer = readFileSync(fullPath)
    if (buffer.includes(0)) continue
    findings.push(...scanText(relativePath, buffer.toString('utf8')))
  }
  return findings
}

function main() {
  const findings = scanRepository()
  if (findings.length > 0) {
    console.error('Se encontraron archivos o valores que podrían exponer credenciales:')
    for (const finding of findings) console.error(`- ${finding}`)
    process.exitCode = 1
    return
  }
  console.log('Credenciales: ningún secreto detectado en archivos versionados o preparados.')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
