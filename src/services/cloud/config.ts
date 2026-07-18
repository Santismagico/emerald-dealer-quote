import type { SupabaseClient } from '@supabase/supabase-js';

export interface CloudEnvironment {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

let clientPromise: Promise<SupabaseClient> | null = null;

export function readCloudConfig(env: CloudEnvironment = import.meta.env as CloudEnvironment): {
  url: string;
  key: string;
} | null {
  const url = env.VITE_SUPABASE_URL?.trim() ?? '';
  const key = env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';
  return url && key ? { url, key } : null;
}

export function cloudEnabled(env: CloudEnvironment = import.meta.env as CloudEnvironment): boolean {
  return readCloudConfig(env) !== null;
}

export async function getSupabase(): Promise<SupabaseClient> {
  const config = readCloudConfig();
  if (!config) {
    throw new Error('La nube no está configurada en esta versión de Emerald Dealer.');
  }
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(config.url, config.key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      })
    );
  }
  return clientPromise;
}

export function resetSupabaseForTests(): void {
  clientPromise = null;
}
