import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8')
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) throw new Error(message)
}

function gitValue(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : null
}

function sha256(relativePath) {
  return createHash('sha256').update(readFileSync(resolve(root, relativePath))).digest('hex')
}

export function verifySecurityConfiguration() {
  const deploy = read('.github/workflows/deploy.yml')
  const gates = read('.github/workflows/security-gates.yml')
  const migration = read('supabase/migrations/20260718200036_harden_cloud_writes.sql').toLowerCase()

  if (/^\s*push\s*:/m.test(deploy)) {
    throw new Error('La publicación sigue activándose automáticamente con push.')
  }
  requireText(deploy, 'workflow_dispatch:', 'La publicación debe exigir una orden manual.')
  requireText(deploy, 'n6_evidence_commit:', 'La publicación no exige evidencia N6 para el commit exacto.')
  requireText(deploy, 'test "$N6_EVIDENCE_COMMIT" = "$GITHUB_SHA"', 'La publicación no ata N6 al commit candidato.')
  requireText(deploy, 'test "$RELEASE_CONFIRMATION" = "PUBLICAR"', 'La publicación no exige confirmación humana explícita.')
  requireText(deploy, 'npm audit --audit-level=high', 'La publicación no revisa dependencias vulnerables.')
  requireText(deploy, 'npm run security:secrets', 'La publicación no revisa credenciales.')
  requireText(deploy, 'npm run security:evidence', 'La publicación no verifica sus propios controles.')
  requireText(deploy, 'npm test', 'La publicación no ejecuta pruebas.')
  requireText(deploy, 'npm run build', 'La publicación no compila la candidata.')
  requireText(deploy, 'npm run security:record', 'La publicación no guarda su evidencia.')

  requireText(gates, 'pull_request:', 'Falta la revisión de seguridad para cambios propuestos.')
  requireText(gates, 'workflow_dispatch:', 'Falta la revisión manual de seguridad.')
  requireText(gates, 'npm audit --audit-level=high', 'La revisión no controla dependencias.')
  requireText(gates, 'npm run security:secrets:test', 'La revisión no prueba el detector de credenciales.')
  requireText(gates, 'npm run security:record', 'La revisión no genera evidencia auditable.')
  requireText(gates, 'actions/upload-artifact@v4', 'La evidencia no queda guardada como artefacto.')

  requireText(migration, 'revoke insert, update, delete on table public.org_settings', 'Las escrituras directas siguen abiertas.')
  requireText(migration, 'alter default privileges for role postgres', 'Los objetos futuros no nacen cerrados.')
  requireText(migration, 'revoke execute on functions from public, anon, authenticated, service_role', 'Las funciones futuras conservan permisos implícitos.')

  return {
    checkedAt: new Date().toISOString(),
    commit: gitValue(['rev-parse', 'HEAD']),
    branch: gitValue(['branch', '--show-current']),
    githubRunId: process.env.GITHUB_RUN_ID ?? null,
    githubActor: process.env.GITHUB_ACTOR ?? null,
    checks: {
      publicationIsManual: true,
      dependencyAuditRequired: true,
      trackedSecretScanRequired: true,
      testsAndBuildRequired: true,
      directCloudWritesClosed: true,
      defaultDatabasePrivilegesClosed: true,
    },
    hashes: {
      packageLock: sha256('package-lock.json'),
      schema: sha256('supabase/migrations/0001_esquema.sql'),
      rls: sha256('supabase/migrations/0002_rls.sql'),
      functions: sha256('supabase/migrations/0003_funciones.sql'),
      hardening: sha256('supabase/migrations/20260718200036_harden_cloud_writes.sql'),
    },
  }
}

function main() {
  const evidence = verifySecurityConfiguration()
  if (process.argv.includes('--write')) {
    const directory = resolve(root, 'security-evidence')
    mkdirSync(directory, { recursive: true })
    writeFileSync(resolve(directory, 'release-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
    console.log('Evidencia de seguridad generada sin credenciales.')
  } else {
    console.log('Controles de publicación y base de datos verificados.')
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
