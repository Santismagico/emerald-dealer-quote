import type { Settings } from '../../types';
import { getSupabase } from './config';

export interface CloudUser {
  id: string;
  email?: string;
}

export interface CloudSession {
  user: CloudUser;
}

export interface CloudOrganization {
  id: string;
  name: string;
}

export type CloudAuthEvent =
  | 'INITIAL_SESSION'
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'PASSWORD_RECOVERY'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED'
  | string;

interface AuthError {
  code?: string;
  message?: string;
}

interface SupabaseAuthLike {
  auth: {
    getSession: () => Promise<{ data: { session: CloudSession | null }; error: AuthError | null }>;
    signInWithPassword: (credentials: { email: string; password: string }) => Promise<{
      data: { session: CloudSession | null };
      error: AuthError | null;
    }>;
    signUp: (credentials: {
      email: string;
      password: string;
      options: { emailRedirectTo: string; data: Record<string, unknown> };
    }) => Promise<{ data: { session: CloudSession | null }; error: AuthError | null }>;
    resetPasswordForEmail: (
      email: string,
      options: { redirectTo: string }
    ) => Promise<{ error: AuthError | null }>;
    updateUser: (attributes: { password: string }) => Promise<{ error: AuthError | null }>;
    signOut: () => Promise<{ error: AuthError | null }>;
    onAuthStateChange: (
      callback: (event: CloudAuthEvent, session: CloudSession | null) => void
    ) => { data: { subscription: { unsubscribe: () => void } } };
  };
  from: (table: string) => {
    select: (columns: string) => {
      maybeSingle: () => Promise<{ data: unknown; error: AuthError | null }>;
    };
  };
  rpc: (
    name: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: unknown; error: AuthError | null }>;
}

export interface CloudAuthService {
  getSession: () => Promise<CloudSession | null>;
  subscribe: (
    callback: (event: CloudAuthEvent, session: CloudSession | null) => void
  ) => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, acceptedLegal: boolean) => Promise<{
    needsEmailConfirmation: boolean;
  }>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  getOrganization: () => Promise<CloudOrganization | null>;
  createOrganization: (name: string, settings: Settings) => Promise<CloudOrganization>;
}

export function authErrorInSpanish(error: AuthError | null): string {
  const code = error?.code ?? '';
  if (code === 'invalid_credentials') return 'El correo o la contraseña no coinciden.';
  if (code === 'email_not_confirmed') return 'Confirma tu correo antes de iniciar sesión.';
  if (code === 'user_already_exists' || code === 'email_exists') return 'Ya existe una cuenta con ese correo.';
  if (code === 'weak_password') return 'La contraseña debe tener al menos 8 caracteres.';
  if (code === 'over_email_send_rate_limit') return 'Espera unos minutos antes de pedir otro correo.';
  if (code === 'same_password') return 'La nueva contraseña debe ser diferente a la anterior.';
  return 'No se pudo completar la acción. Revisa tu conexión e intenta de nuevo.';
}

function throwIfError(error: AuthError | null): void {
  if (error) throw new Error(authErrorInSpanish(error));
}

function cleanEmail(email: string): string {
  return email.trim().toLowerCase();
}

function appRedirectUrl(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString();
}

export function createCloudAuthService(
  getClient: () => Promise<SupabaseAuthLike> = async () =>
    (await getSupabase()) as unknown as SupabaseAuthLike,
  redirectUrl: () => string = appRedirectUrl,
  now: () => Date = () => new Date()
): CloudAuthService {
  return {
    async getSession() {
      const result = await (await getClient()).auth.getSession();
      throwIfError(result.error);
      return result.data.session;
    },
    subscribe(callback) {
      let stop: (() => void) | null = null;
      let cancelled = false;
      void getClient().then((client) => {
        if (cancelled) return;
        const subscription = client.auth.onAuthStateChange(callback).data.subscription;
        stop = () => subscription.unsubscribe();
      });
      return () => {
        cancelled = true;
        stop?.();
      };
    },
    async signIn(email, password) {
      const result = await (await getClient()).auth.signInWithPassword({
        email: cleanEmail(email),
        password
      });
      throwIfError(result.error);
    },
    async signUp(email, password, acceptedLegal) {
      if (!acceptedLegal) throw new Error('Debes aceptar los términos y la política de privacidad.');
      if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
      const acceptedAt = now().toISOString();
      const result = await (await getClient()).auth.signUp({
        email: cleanEmail(email),
        password,
        options: {
          emailRedirectTo: redirectUrl(),
          data: {
            accepted_terms_at: acceptedAt,
            accepted_privacy_at: acceptedAt,
            legal_draft_date: '2026-07-17'
          }
        }
      });
      throwIfError(result.error);
      return { needsEmailConfirmation: result.data.session === null };
    },
    async sendPasswordReset(email) {
      const result = await (await getClient()).auth.resetPasswordForEmail(cleanEmail(email), {
        redirectTo: redirectUrl()
      });
      throwIfError(result.error);
    },
    async updatePassword(password) {
      if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
      const result = await (await getClient()).auth.updateUser({ password });
      throwIfError(result.error);
    },
    async signOut() {
      const result = await (await getClient()).auth.signOut();
      throwIfError(result.error);
    },
    async getOrganization() {
      const result = await (await getClient())
        .from('memberships')
        .select('organization_id, organizations(name)')
        .maybeSingle();
      throwIfError(result.error);
      if (!result.data || typeof result.data !== 'object') return null;
      const row = result.data as {
        organization_id?: unknown;
        organizations?: { name?: unknown } | Array<{ name?: unknown }> | null;
      };
      if (typeof row.organization_id !== 'string') return null;
      const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
      return {
        id: row.organization_id,
        name: typeof organization?.name === 'string' ? organization.name : ''
      };
    },
    async createOrganization(name, settings) {
      const cleanName = name.trim();
      if (!cleanName) throw new Error('Escribe el nombre de tu joyería.');
      const client = await getClient();
      const created = await client.rpc('create_organization', { org_name: cleanName });
      throwIfError(created.error);
      if (typeof created.data !== 'string') {
        throw new Error('No se pudo crear la joyería. Intenta de nuevo.');
      }
      const saved = await client.rpc('upsert_settings', {
        p_data: { ...settings, jewelryName: cleanName },
        p_updated_at: now().toISOString()
      });
      throwIfError(saved.error);
      return { id: created.data, name: cleanName };
    }
  };
}

export const cloudAuth = createCloudAuthService();
