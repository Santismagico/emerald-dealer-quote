import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)])
);
const expected = 'ovfaehoeidxcjrlapioo';
const production = 'wrvokfzrcmmlzekudypu';
if (
  env.N6_TEST_PROJECT_REF !== expected ||
  env.N6_PRODUCTION_PROJECT_REF !== production ||
  env.SUPABASE_URL !== `https://${expected}.supabase.co` ||
  env.N6_CONFIRM_TEST_PROJECT !== `TEST_ONLY:${expected}`
) throw new Error('El entorno no es el proyecto de pruebas autorizado.');

const secret = execFileSync('pbpaste', { encoding: 'utf8' }).trim();
if (secret.length < 20 || secret === env.SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('El portapapeles no contiene la clave secreta del proyecto de pruebas.');
}
const admin = createClient(env.SUPABASE_URL, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publicKey = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `audit-race-${nonce}@example.invalid`;
const password = `Audit-${crypto.randomUUID()}-Aa1!`;
let userId;
let organizationIds = [];

try {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  userId = created.data.user.id;

  const clients = Array.from({ length: 12 }, () => createClient(env.SUPABASE_URL, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));
  await Promise.all(clients.map(async (client) => {
    const login = await client.auth.signInWithPassword({ email, password });
    if (login.error) throw login.error;
  }));
  const attempts = await Promise.all(clients.map((client, index) =>
    client.rpc('create_organization', { org_name: `Audit race ${nonce} ${index}` })
  ));
  organizationIds = attempts.filter((result) => !result.error).map((result) => result.data);
  const membershipResult = await admin
    .from('memberships')
    .select('organization_id')
    .eq('user_id', userId);
  if (membershipResult.error) throw membershipResult.error;
  const memberships = membershipResult.data?.map((row) => row.organization_id) ?? [];
  organizationIds = [...new Set([...organizationIds, ...memberships])];
  console.log(JSON.stringify({
    attempts: attempts.length,
    successfulRpcs: attempts.filter((result) => !result.error).length,
    membershipsCreated: memberships.length,
    invariantBroken: memberships.length > 1,
    errorCodes: [...new Set(attempts.filter((result) => result.error).map((result) => result.error.code || 'unknown'))],
  }));
} finally {
  if (organizationIds.length) {
    const deleted = await admin.from('organizations').delete().in('id', organizationIds);
    if (deleted.error) console.error(`cleanup organizations failed: ${deleted.error.code || 'unknown'}`);
  }
  if (userId) {
    const deleted = await admin.auth.admin.deleteUser(userId);
    if (deleted.error) console.error(`cleanup user failed: ${deleted.error.code || 'unknown'}`);
  }
  try { execFileSync('pbcopy', { input: '' }); } catch {}
}
