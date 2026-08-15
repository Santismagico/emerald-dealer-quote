import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from 'react';
import type { Settings } from './types';
import { cloudEnabled } from './services/cloud/config';
import {
  readAccountState,
  registerDevice,
  type AccountState
} from './services/cloud/accountStatus';
import {
  cloudAuth,
  legalAcceptanceRequirements,
  mustSetOwnPassword,
  type CloudAuthEvent,
  type CloudAuthService,
  type CloudOrganization,
  type CloudSession,
  type DeletionReceipt,
  type LegalAcceptance
} from './services/cloud/auth';
import { setActiveCloudScope } from './services/cloud/scope';
import { deleteCloudDatabaseScope, setCloudDatabaseScope } from './services/db';

interface CloudAuthContextValue {
  ready: boolean;
  session: CloudSession | null;
  organization: CloudOrganization | null;
  /** Estado de la cuenta. Es cortesía para explicar; el candado está en la base. */
  accountState: AccountState;
  passwordRecovery: boolean;
  /** Cuenta que aún debe fijar su contraseña propia o aceptar los documentos legales. */
  needsFirstAccess: boolean;
  needsPasswordSetup: boolean;
  needsLegalAcceptance: boolean;
  needsTermsAcceptance: boolean;
  needsPrivacyAcceptance: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, acceptance: LegalAcceptance) => Promise<{
    needsEmailConfirmation: boolean;
  }>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  completeFirstAccess: (options: {
    password?: string;
    acceptedTerms: boolean;
    acceptedPrivacy: boolean;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  createOrganization: (name: string, settings: Settings) => Promise<void>;
  /** Borra la joyería y todos sus datos. Exige el nombre exacto como confirmación. */
  deleteMyOrganization: (confirmation: string) => Promise<DeletionReceipt>;
  refreshOrganization: () => Promise<void>;
}

const CloudAuthContext = createContext<CloudAuthContextValue | null>(null);

export function CloudAuthProvider({
  children,
  service = cloudAuth,
  enabled = cloudEnabled()
}: {
  children: ReactNode;
  service?: CloudAuthService;
  enabled?: boolean;
}) {
  const [ready, setReady] = useState(!enabled);
  const [session, setSession] = useState<CloudSession | null>(null);
  const [organization, setOrganization] = useState<CloudOrganization | null>(null);
  const [accountState, setAccountState] = useState<AccountState>({
    status: 'activa', paidThrough: null, readOnlySince: null
  });
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const revisionRef = useRef(0);
  const userIdRef = useRef<string | null>(null);

  const applySession = useCallback(async (
    nextSession: CloudSession | null,
    event?: CloudAuthEvent
  ) => {
    const revision = ++revisionRef.current;
    const nextUserId = nextSession?.user.id ?? null;
    const identityChanged = userIdRef.current !== nextUserId;
    userIdRef.current = nextUserId;
    // Cerrar primero evita que una cola de la identidad anterior continúe
    // mientras se resuelve la membresía de la sesión nueva.
    setActiveCloudScope(null);
    if (identityChanged) {
      setOrganization(null);
      setCloudDatabaseScope(null);
      if (nextSession) setReady(false);
    }
    setSession(nextSession);
    if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
    if (!nextSession) {
      setOrganization(null);
      setCloudDatabaseScope(null);
      setAccountState({ status: 'activa', paidThrough: null, readOnlySince: null });
      setPasswordRecovery(false);
      setReady(true);
      return;
    }
    try {
      const nextOrganization = await service.getOrganization();
      if (revision !== revisionRef.current) return;
      setActiveCloudScope(nextOrganization ? {
        userId: nextSession.user.id,
        organizationId: nextOrganization.id
      } : null);
      setOrganization(nextOrganization);
      if (nextOrganization) {
        // Ninguna de las dos puede impedir trabajar si falla.
        void registerDevice();
        const estado = await readAccountState();
        if (revision === revisionRef.current) setAccountState(estado);
      }
    } finally {
      if (revision === revisionRef.current) setReady(true);
    }
  }, [service]);

  useEffect(() => {
    setActiveCloudScope(null);
    setCloudDatabaseScope(null);
    if (!enabled) return;
    let mounted = true;
    const stop = service.subscribe((event, nextSession) => {
      if (mounted) void applySession(nextSession, event);
    });
    void service.getSession()
      .then((current) => {
        if (mounted) return applySession(current);
      })
      .catch(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
      setActiveCloudScope(null);
      setCloudDatabaseScope(null);
      stop();
    };
  }, [applySession, enabled, service]);

  const refreshOrganization = useCallback(async () => {
    const refreshed = await service.getOrganization();
    setActiveCloudScope(session && refreshed ? {
      userId: session.user.id,
      organizationId: refreshed.id
    } : null);
    setOrganization(refreshed);
  }, [service, session]);

  const needsPasswordSetup = mustSetOwnPassword(session);
  const { needsTermsAcceptance, needsPrivacyAcceptance } =
    legalAcceptanceRequirements(session);
  const needsLegalAcceptance = needsTermsAcceptance || needsPrivacyAcceptance;
  const needsFirstAccess = needsPasswordSetup || needsLegalAcceptance;

  return (
    <CloudAuthContext.Provider value={{
      ready,
      session,
      organization,
      accountState,
      passwordRecovery,
      needsFirstAccess,
      needsPasswordSetup,
      needsLegalAcceptance,
      needsTermsAcceptance,
      needsPrivacyAcceptance,
      async signIn(email, password) {
        await service.signIn(email, password);
        await applySession(await service.getSession(), 'SIGNED_IN');
      },
      signUp: service.signUp,
      sendPasswordReset: service.sendPasswordReset,
      async updatePassword(password) {
        await service.updatePassword(password);
        setPasswordRecovery(false);
      },
      async completeFirstAccess(options) {
        await service.completeFirstAccess(options);
        // Releer la sesión trae la metadata actualizada y apaga el primer acceso.
        await applySession(await service.getSession(), 'SIGNED_IN');
      },
      async signOut() {
        setActiveCloudScope(null);
        await service.signOut();
        await applySession(null, 'SIGNED_OUT');
      },
      async createOrganization(name, settings) {
        const created = await service.createOrganization(name, settings);
        if (!session) throw new Error('No hay una sesión activa para abrir la joyería.');
        setActiveCloudScope({ userId: session.user.id, organizationId: created.id });
        setOrganization(created);
      },
      async deleteMyOrganization(confirmation) {
        const deletingUserId = session?.user.id ?? null;
        const receipt = await service.deleteMyOrganization(confirmation);
        // Ya no hay joyería a la que volver: se cierra la sesión de inmediato
        // para no dejar la app mostrando datos que el servidor acaba de borrar.
        setActiveCloudScope(null);
        setOrganization(null);
        await service.signOut();
        await applySession(null, 'SIGNED_OUT');
        if (deletingUserId) {
          try {
            await deleteCloudDatabaseScope({
              userId: deletingUserId,
              organizationId: receipt.organizationId
            });
          } catch {
            // La identidad ya quedó cerrada y esta base no volverá a abrirse.
            // Otra pestaña actualizada la cerrará mediante `onversionchange`.
          }
        }
        return receipt;
      },
      refreshOrganization
    }}>
      {children}
    </CloudAuthContext.Provider>
  );
}

export function useCloudAuth(): CloudAuthContextValue {
  const value = useContext(CloudAuthContext);
  if (!value) throw new Error('useCloudAuth debe usarse dentro de CloudAuthProvider');
  return value;
}
