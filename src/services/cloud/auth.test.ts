import { describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../storage';
import { authErrorInSpanish, createCloudAuthService } from './auth';

function fakeClient() {
  const rpc = vi.fn(async (_name: string, _args?: Record<string, unknown>): Promise<{
    data: unknown;
    error: null;
  }> => ({ data: null, error: null }));
  return {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      signInWithPassword: vi.fn(async () => ({ data: { session: null }, error: null })),
      signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
      resetPasswordForEmail: vi.fn(async () => ({ error: null })),
      updateUser: vi.fn(async () => ({ error: null })),
      signOut: vi.fn(async () => ({ error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } }
      }))
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data: null, error: null }))
      }))
    })),
    rpc
  };
}

describe('cuenta de nube', () => {
  it('traduce los errores comunes a español claro', () => {
    expect(authErrorInSpanish({ code: 'invalid_credentials' })).toBe('El correo o la contraseña no coinciden.');
    expect(authErrorInSpanish({ code: 'email_not_confirmed' })).toContain('Confirma tu correo');
    expect(authErrorInSpanish({ code: 'weak_password' })).toContain('8 caracteres');
  });

  it('no crea una cuenta sin aceptar los documentos legales', async () => {
    const client = fakeClient();
    const service = createCloudAuthService(async () => client as never);

    await expect(service.signUp('joyeria@ejemplo.com', 'segura123', false)).rejects.toThrow('Debes aceptar');
    expect(client.auth.signUp).not.toHaveBeenCalled();
  });

  it('normaliza el correo y registra la aceptación al crear la cuenta', async () => {
    const client = fakeClient();
    const service = createCloudAuthService(
      async () => client as never,
      () => 'https://ejemplo.test/app/',
      () => new Date('2026-07-18T15:00:00Z')
    );

    expect(await service.signUp(' JOYERIA@EJEMPLO.COM ', 'segura123', true)).toEqual({
      needsEmailConfirmation: true
    });
    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: 'joyeria@ejemplo.com',
      password: 'segura123',
      options: {
        emailRedirectTo: 'https://ejemplo.test/app/',
        data: {
          accepted_terms_at: '2026-07-18T15:00:00.000Z',
          accepted_privacy_at: '2026-07-18T15:00:00.000Z',
          legal_draft_date: '2026-07-17'
        }
      }
    });
  });

  it('crea la joyería y guarda los ajustes iniciales en ese orden', async () => {
    const client = fakeClient();
    client.rpc
      .mockResolvedValueOnce({ data: 'org-1', error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const service = createCloudAuthService(
      async () => client as never,
      () => 'https://ejemplo.test/',
      () => new Date('2026-07-18T15:00:00Z')
    );

    expect(await service.createOrganization(' Joyería Ejemplo ', defaultSettings())).toEqual({
      id: 'org-1',
      name: 'Joyería Ejemplo'
    });
    expect(client.rpc.mock.calls[0]).toEqual(['create_organization', { org_name: 'Joyería Ejemplo' }]);
    expect(client.rpc.mock.calls[1][0]).toBe('upsert_settings');
    expect(client.rpc.mock.calls[1][1]).toMatchObject({
      p_data: { jewelryName: 'Joyería Ejemplo' },
      p_updated_at: '2026-07-18T15:00:00.000Z'
    });
  });

  it('envía recuperación con un mensaje neutral para no revelar cuentas', async () => {
    const client = fakeClient();
    const service = createCloudAuthService(async () => client as never, () => 'https://ejemplo.test/app/');

    await service.sendPasswordReset(' CUENTA@EJEMPLO.COM ');
    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith('cuenta@ejemplo.com', {
      redirectTo: 'https://ejemplo.test/app/'
    });
  });
});
