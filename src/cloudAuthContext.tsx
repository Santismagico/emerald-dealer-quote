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

  const applySession = useCallback(async (
    nextSession: CloudSession | null,
    event?: CloudAuthEvent
  ) => {
    const revision = ++revisionRef.current;
    setSession(nextSession);
    if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
    if (!nextSession) {
      setOrganization(null);
      setAccountState({ status: 'activa', paidThrough: null, readOnlySince: null });
      setPasswordRecovery(false);
      setReady(true);
      return;
    }
    try {
      const nextOrganization = await service.getOrganization();
      if (revision !== revisionRef.current) return;
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
      stop();
    };
  }, [applySession, enabled, service]);

  const refreshOrganization = useCallback(async () => {
    setOrganization(await service.getOrganization());
  }, [service]);

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
        await service.signOut();
        await applySession(null, 'SIGNED_OUT');
      },
      async createOrganization(name, settings) {
        const created = await service.createOrganization(name, settings);
        setOrganization(created);
      },
      async deleteMyOrganization(confirmation) {
        const receipt = await service.deleteMyOrganization(confirmation);
        // Ya no hay joyería a la que volver: se cierra la sesión de inmediato
        // para no dejar la app mostrando datos que el servidor acaba de borrar.
        setOrganization(null);
        await service.signOut();
        await applySession(null, 'SIGNED_OUT');
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
