import { describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../storage';
import {
  NOTICE_VERSION,
  PRIVACY_VERSION,
  TERMS_VERSION,
  authErrorInSpanish,
  createCloudAuthService,
  legalAcceptanceRequirements,
  mustAcceptLegal,
  mustSetOwnPassword,
  type CloudSession
} from './auth';

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

  it('no crea una cuenta si falta una de las dos aceptaciones', async () => {
    const client = fakeClient();
    const service = createCloudAuthService(async () => client as never);

    await expect(service.signUp('joyeria@ejemplo.com', 'segura123', {
      acceptedTerms: false,
      acceptedPrivacy: true
    })).rejects.toThrow('términos');
    await expect(service.signUp('joyeria@ejemplo.com', 'segura123', {
      acceptedTerms: true,
      acceptedPrivacy: false
    })).rejects.toThrow('tratamiento de datos');
    expect(client.auth.signUp).not.toHaveBeenCalled();
  });

  it('normaliza el correo y registra la aceptación al crear la cuenta', async () => {
    const client = fakeClient();
    const service = createCloudAuthService(
      async () => client as never,
      () => 'https://ejemplo.test/app/',
      () => new Date('2026-07-18T15:00:00Z')
    );

    expect(await service.signUp(' JOYERIA@EJEMPLO.COM ', 'segura123', {
      acceptedTerms: true,
      acceptedPrivacy: true
    })).toEqual({
      needsEmailConfirmation: true
    });
    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: 'joyeria@ejemplo.com',
      password: 'segura123',
      options: {
        emailRedirectTo: 'https://ejemplo.test/app/',
        data: {
          password_set_by_user: true,
          accepted_terms_at: '2026-07-18T15:00:00.000Z',
          accepted_privacy_at: '2026-07-18T15:00:00.000Z',
          accepted_notice_at: '2026-07-18T15:00:00.000Z',
          terms_version: TERMS_VERSION,
          privacy_version: PRIVACY_VERSION,
          notice_version: NOTICE_VERSION
        }
      }
    });
  });

  it('el primer acceso fija contraseña propia y registra la aceptación con versión', async () => {
    const client = fakeClient();
    const service = createCloudAuthService(
      async () => client as never,
      () => 'https://ejemplo.test/app/',
      () => new Date('2026-07-18T15:00:00Z')
    );

    await service.completeFirstAccess({
      password: 'miClaveNueva',
      acceptedTerms: true,
      acceptedPrivacy: true
    });
    expect(client.auth.updateUser).toHaveBeenCalledWith({
      password: 'miClaveNueva',
      data: {
        password_set_by_user: true,
        accepted_terms_at: '2026-07-18T15:00:00.000Z',
        accepted_privacy_at: '2026-07-18T15:00:00.000Z',
        accepted_notice_at: '2026-07-18T15:00:00.000Z',
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
        notice_version: NOTICE_VERSION
      }
    });
  });

  it('cambiar solo la contraseña no sobrescribe la aceptación anterior', async () => {
    const client = fakeClient();
    const service = createCloudAuthService(async () => client as never);

    await service.completeFirstAccess({
      password: 'miClaveNueva',
      acceptedTerms: false,
      acceptedPrivacy: false
    });
    expect(client.auth.updateUser).toHaveBeenCalledWith({
      password: 'miClaveNueva',
      data: { password_set_by_user: true }
    });
  });

  it('aceptar solo los términos no obliga a cambiar la contraseña ni sobrescribe privacidad', async () => {
    const client = fakeClient();
    const service = createCloudAuthService(
      async () => client as never,
      () => 'https://ejemplo.test/app/',
      () => new Date('2026-07-18T15:00:00Z')
    );

    await service.completeFirstAccess({ acceptedTerms: true, acceptedPrivacy: false });
    expect(client.auth.updateUser).toHaveBeenCalledWith({
      data: {
        accepted_terms_at: '2026-07-18T15:00:00.000Z',
        terms_version: TERMS_VERSION
      }
    });
  });

  it('aceptar privacidad y aviso no sobrescribe la aceptación de términos', async () => {
    const client = fakeClient();
    const service = createCloudAuthService(
      async () => client as never,
      () => 'https://ejemplo.test/app/',
      () => new Date('2026-07-18T15:00:00Z')
    );

    await service.completeFirstAccess({ acceptedTerms: false, acceptedPrivacy: true });
    expect(client.auth.updateUser).toHaveBeenCalledWith({
      data: {
        accepted_privacy_at: '2026-07-18T15:00:00.000Z',
        accepted_notice_at: '2026-07-18T15:00:00.000Z',
        privacy_version: PRIVACY_VERSION,
        notice_version: NOTICE_VERSION
      }
    });
  });

  it('el primer acceso valida una contraseña nueva de 8+ y exige algún cambio', async () => {
    const client = fakeClient();
    const service = createCloudAuthService(async () => client as never);

    await expect(service.completeFirstAccess({
      acceptedTerms: false,
      acceptedPrivacy: false
    })).rejects.toThrow('No hay cambios');
    await expect(service.completeFirstAccess({
      password: 'corta',
      acceptedTerms: true,
      acceptedPrivacy: true
    }))
      .rejects.toThrow('8 caracteres');
    expect(client.auth.updateUser).not.toHaveBeenCalled();
  });

  it('protege cuentas antiguas y exige la versión vigente completa', () => {
    const session = (metadata: Record<string, unknown> | null): CloudSession =>
      ({ user: { id: 'u-1', email: 'a@b.co', user_metadata: metadata } });
    const currentLegal = {
      accepted_terms_at: '2026-07-18T00:00:00Z',
      accepted_privacy_at: '2026-07-18T00:00:00Z',
      accepted_notice_at: '2026-07-18T00:00:00Z',
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
      notice_version: NOTICE_VERSION
    };

    expect(mustSetOwnPassword(null)).toBe(false);
    expect(mustSetOwnPassword(session(null))).toBe(true);
    expect(mustSetOwnPassword(session({ password_set_by_user: false }))).toBe(true);
    expect(mustSetOwnPassword(session({ password_set_by_user: true }))).toBe(false);
    expect(mustSetOwnPassword(session({
      accepted_terms_at: '2026-07-18T00:00:00Z',
      accepted_privacy_at: '2026-07-18T00:00:00Z',
      legal_draft_date: '2026-07-17'
    }))).toBe(false);
    expect(mustSetOwnPassword(session({
      accepted_terms_at: '2026-07-18T00:00:00Z',
      legal_draft_date: '2026-07-17'
    }))).toBe(true);

    expect(mustAcceptLegal(session(currentLegal))).toBe(false);
    expect(mustAcceptLegal(session({ ...currentLegal, accepted_privacy_at: undefined }))).toBe(true);
    expect(mustAcceptLegal(session({ ...currentLegal, terms_version: 'draft-anterior' }))).toBe(true);
    expect(legalAcceptanceRequirements(session({
      ...currentLegal,
      terms_version: 'draft-anterior'
    }))).toEqual({ needsTermsAcceptance: true, needsPrivacyAcceptance: false });
    expect(legalAcceptanceRequirements(session({
      ...currentLegal,
      notice_version: 'draft-anterior'
    }))).toEqual({ needsTermsAcceptance: false, needsPrivacyAcceptance: true });
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
