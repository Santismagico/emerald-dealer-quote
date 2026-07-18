import { useState, type FormEvent, type ReactNode } from 'react';
import termsSource from '../../docs/legal/terminos-servicio.md?raw';
import privacySource from '../../docs/legal/politica-privacidad.md?raw';
import { defaultSettings } from '../services/storage';
import { useCloudAuth } from '../cloudAuthContext';
import { Button, Field, SectionCard, TextInput } from './ui';

type AuthMode = 'sign-in' | 'sign-up' | 'forgot' | 'terms' | 'privacy';

function BrandHeader({ subtitle }: { subtitle: string }) {
  return (
    <div className="text-center">
      <img
        src={`${import.meta.env.BASE_URL}pwa-192.png`}
        alt=""
        className="brand-icon mx-auto h-16 w-16"
      />
      <h1 className="font-display mt-4 text-2xl font-semibold text-stone-900">Emerald Dealer</h1>
      <p className="mt-1 text-sm text-stone-500">{subtitle}</p>
    </div>
  );
}

export function CloudLoadingView() {
  return (
    <div className="atelier flex min-h-dvh items-center justify-center px-4">
      <BrandHeader subtitle="Preparando tu cuenta…" />
    </div>
  );
}

function readableMarkdown(line: string): string {
  return line.replace(/^>\s*/, '').replace(/\*\*/g, '').replace(/`/g, '');
}

function LegalDocument({ source, onBack }: { source: string; onBack: () => void }) {
  const blocks: ReactNode[] = [];
  source.split(/\r?\n/).forEach((line, index) => {
    const text = readableMarkdown(line.trim());
    if (!text) return;
    if (line.startsWith('# ')) {
      blocks.push(<h1 key={index} className="font-display text-2xl font-semibold text-stone-900">{text.slice(2)}</h1>);
    } else if (line.startsWith('## ')) {
      blocks.push(<h2 key={index} className="pt-2 text-base font-semibold text-stone-900">{text.slice(3)}</h2>);
    } else if (line.startsWith('>')) {
      blocks.push(<p key={index} className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{text}</p>);
    } else if (line.startsWith('- ')) {
      blocks.push(<p key={index} className="pl-3 text-sm text-stone-600">• {text.slice(2)}</p>);
    } else {
      blocks.push(<p key={index} className="text-sm leading-6 text-stone-600">{text}</p>);
    }
  });

  return (
    <div className="atelier min-h-dvh px-4 py-6">
      <div className="mx-auto max-w-lg space-y-4">
        <Button variant="ghost" onClick={onBack}>← Volver al registro</Button>
        <SectionCard>{blocks}</SectionCard>
      </div>
    </div>
  );
}

export function CloudAccessView() {
  const auth = useCloudAuth();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (mode === 'terms') return <LegalDocument source={termsSource} onBack={() => setMode('sign-up')} />;
  if (mode === 'privacy') return <LegalDocument source={privacySource} onBack={() => setMode('sign-up')} />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    setMessage('');
    if (!email.trim()) {
      setError('Escribe tu correo.');
      return;
    }
    if (mode !== 'forgot' && !password) {
      setError('Escribe tu contraseña.');
      return;
    }
    if (mode === 'sign-up' && password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'sign-in') {
        await auth.signIn(email, password);
      } else if (mode === 'sign-up') {
        const result = await auth.signUp(email, password, acceptedLegal);
        if (result.needsEmailConfirmation) {
          setMessage('Cuenta creada. Revisa tu correo y confirma el enlace antes de iniciar sesión.');
          setMode('sign-in');
          setPassword('');
          setConfirmation('');
        }
      } else {
        await auth.sendPasswordReset(email);
        setMessage('Si ese correo tiene una cuenta, recibirás un enlace para cambiar la contraseña.');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo completar la acción.');
    } finally {
      setBusy(false);
    }
  };

  const changeMode = (next: AuthMode) => {
    setMode(next);
    setError('');
    setMessage('');
  };

  return (
    <div className="atelier flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-5">
        <BrandHeader subtitle="Tu joyería, protegida y disponible en tus dispositivos" />
        <SectionCard title={mode === 'sign-in' ? 'Iniciar sesión' : mode === 'sign-up' ? 'Crear cuenta' : 'Recuperar contraseña'}>
          <form className="space-y-4" onSubmit={(event) => void submit(event)}>
            <Field label="Correo">
              <TextInput value={email} onChange={setEmail} type="email" inputMode="email" />
            </Field>
            {mode !== 'forgot' ? (
              <Field label="Contraseña" hint={mode === 'sign-up' ? 'Mínimo 8 caracteres.' : undefined}>
                <TextInput value={password} onChange={setPassword} type="password" />
              </Field>
            ) : null}
            {mode === 'sign-up' ? (
              <>
                <Field label="Repite la contraseña">
                  <TextInput value={confirmation} onChange={setConfirmation} type="password" />
                </Field>
                <label className="flex min-h-12 items-start gap-3 text-sm text-stone-600">
                  <input
                    type="checkbox"
                    checked={acceptedLegal}
                    onChange={(event) => setAcceptedLegal(event.target.checked)}
                    className="mt-1 h-5 w-5 shrink-0"
                  />
                  <span>
                    Acepto los{' '}
                    <button type="button" className="min-h-11 font-semibold text-brand-800" onClick={() => setMode('terms')}>
                      términos
                    </button>{' '}
                    y la{' '}
                    <button type="button" className="min-h-11 font-semibold text-brand-800" onClick={() => setMode('privacy')}>
                      política de privacidad
                    </button>.
                  </span>
                </label>
              </>
            ) : null}
            {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
            {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}
            <Button full type="submit" disabled={busy}>
              {busy ? 'Espera…' : mode === 'sign-in' ? 'Iniciar sesión' : mode === 'sign-up' ? 'Crear cuenta' : 'Enviar enlace'}
            </Button>
          </form>
        </SectionCard>
        <div className="grid gap-2">
          {mode !== 'sign-in' ? <Button variant="ghost" full onClick={() => changeMode('sign-in')}>Ya tengo cuenta</Button> : null}
          {mode !== 'sign-up' ? <Button variant="ghost" full onClick={() => changeMode('sign-up')}>Crear cuenta</Button> : null}
          {mode !== 'forgot' ? <Button variant="ghost" full onClick={() => changeMode('forgot')}>Olvidé mi contraseña</Button> : null}
        </div>
      </div>
    </div>
  );
}

export function CreateOrganizationView() {
  const auth = useCloudAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await auth.createOrganization(name, defaultSettings());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo crear la joyería.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="atelier flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-5">
        <BrandHeader subtitle="Un último paso para preparar tu espacio" />
        <SectionCard title="Crea tu joyería" subtitle="Este nombre aparecerá dentro de tu cuenta.">
          <form className="space-y-4" onSubmit={(event) => void submit(event)}>
            <Field label="Nombre de la joyería">
              <TextInput value={name} onChange={setName} placeholder="Ej. Joyería Esmeralda" />
            </Field>
            {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
            <Button full type="submit" disabled={busy || !name.trim()}>
              {busy ? 'Creando…' : 'Crear mi joyería'}
            </Button>
          </form>
        </SectionCard>
        <Button variant="ghost" full disabled={busy} onClick={() => void auth.signOut()}>Cerrar sesión</Button>
      </div>
    </div>
  );
}

export function PasswordRecoveryView() {
  const auth = useCloudAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await auth.updatePassword(password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="atelier flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-5">
        <BrandHeader subtitle="Protege nuevamente tu cuenta" />
        <SectionCard title="Nueva contraseña">
          <form className="space-y-4" onSubmit={(event) => void submit(event)}>
            <Field label="Nueva contraseña" hint="Mínimo 8 caracteres.">
              <TextInput value={password} onChange={setPassword} type="password" />
            </Field>
            <Field label="Repite la contraseña">
              <TextInput value={confirmation} onChange={setConfirmation} type="password" />
            </Field>
            {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
            <Button full type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar contraseña'}</Button>
          </form>
        </SectionCard>
      </div>
    </div>
  );
}

export function AccountView({
  email,
  organizationName,
  onSignOut,
  onImport
}: {
  email: string;
  organizationName: string;
  onSignOut: () => Promise<void>;
  onImport: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="space-y-4">
      <SectionCard title="Cuenta">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Correo</p>
          <p className="mt-1 break-words text-sm text-stone-800">{email}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Joyería</p>
          <p className="mt-1 text-sm text-stone-800">{organizationName}</p>
        </div>
        {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <Button variant="secondary" full disabled={busy} onClick={onImport}>
          Importar datos de este dispositivo
        </Button>
        <Button
          variant="secondary"
          full
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError('');
            void onSignOut().catch((reason) => {
              setError(reason instanceof Error ? reason.message : 'No se pudo cerrar la sesión.');
              setBusy(false);
            });
          }}
        >
          {busy ? 'Cerrando…' : 'Cerrar sesión'}
        </Button>
      </SectionCard>
    </div>
  );
}
