import { useEffect, useRef, useState } from 'react';
import { StoreProvider, useStore } from './store';
import type { Quote } from './types';
import { newId } from './utils/id';
import { todayISO, addDays } from './utils/dates';
import { HistoryView } from './components/HistoryView';
import { QuoteFormView } from './components/QuoteFormView';
import { PreviewView, type PreviewViewHandle } from './components/PreviewView';
import { WorkshopView } from './components/WorkshopView';
import { WorkshopJobView, type WorkshopJobViewHandle } from './components/WorkshopJobView';
import { AgendaView } from './components/AgendaView';
import { StonesView } from './components/StonesView';
import { DailyCloseView } from './components/DailyCloseView';
import { ClientsView } from './components/ClientsView';
import { SuppliersView } from './components/SuppliersView';
import { SettingsView } from './components/SettingsView';
import { Toast } from './components/ui';
import { runAfterSuccessfulFlush } from './services/quoteAutosave';
import { todaysPendingAppointments } from './services/agenda';
import {
  getBackupReminderSnoozedUntil,
  getBackupReminderState
} from './services/backupReminder';

type ViewName =
  | 'history'
  | 'form'
  | 'preview'
  | 'workshop'
  | 'workshopJob'
  | 'agenda'
  | 'stones'
  | 'more'
  | 'dailyClose'
  | 'clients'
  | 'suppliers'
  | 'settings';

const APP_URL = 'https://santismagico.github.io/emerald-dealer-quote/';

/**
 * Detecta navegadores internos (WhatsApp, Facebook, Instagram) donde la PWA
 * no puede instalarse y el almacenamiento puede fallar.
 */
function isInAppBrowser(): boolean {
  const ua = navigator.userAgent;
  return /; wv\)/.test(ua) || /FBAN|FB_IAB|Instagram|Line\//i.test(ua);
}

function emptyQuote(defaults: {
  validityDays: number;
  goldPricePerGram: number;
  marginPercent: number;
  taxEnabled: boolean;
  taxPercent: number;
}): Quote {
  const now = new Date().toISOString();
  return {
    id: newId(),
    number: '',
    clientId: null,
    clientSnapshot: null,
    date: todayISO(),
    validUntil: addDays(todayISO(), defaults.validityDays),
    status: 'borrador',
    approvedAt: '',
    deliveredAt: '',
    pieceType: 'anillo',
    pieceDescription: '',
    material: 'Oro',
    materialPricePerGram: defaults.goldPricePerGram,
    weightGrams: 0,
    stones: [],
    laborCost: 0,
    extraCosts: [],
    marginPercent: defaults.marginPercent,
    discountType: 'porcentaje',
    discountValue: 0,
    taxEnabled: defaults.taxEnabled,
    taxPercent: defaults.taxPercent,
    deposit: 0,
    depositDate: '',
    internalNotes: '',
    clientNotes: '',
    images: [],
    production: [],
    payments: [],
    createdAt: now,
    updatedAt: now
  };
}

function AppShell() {
  const store = useStore();
  const [view, setView] = useState<ViewName>('history');
  const [draft, setDraft] = useState<Quote | null>(null);
  const [previewTab, setPreviewTab] = useState<'cliente' | 'interno'>('cliente');
  // Desde dónde se abrió la vista previa, para que "Volver" regrese al lugar correcto.
  const [previewFrom, setPreviewFrom] = useState<'history' | 'workshop'>('history');
  const [reminderNow, setReminderNow] = useState(() => new Date());
  const [snoozingReminder, setSnoozingReminder] = useState(false);
  const previewRef = useRef<PreviewViewHandle>(null);
  const workshopJobRef = useRef<WorkshopJobViewHandle>(null);
  const reminderAnchorRef = useRef(false);
  const snoozeRef = useRef(false);

  const backupReminder = getBackupReminderState({
    settings: store.settings,
    clients: store.clients,
    quotes: store.quotes,
    appointments: store.appointments,
    now: reminderNow
  });

  // Aviso visual local: cuántas citas programadas hay hoy (D-020, sin notificaciones).
  const todayAppointments = todaysPendingAppointments(store.appointments, todayISO()).length;

  useEffect(() => {
    const refresh = () => setReminderNow(new Date());
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    const interval = window.setInterval(refresh, 60 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!store.ready || !backupReminder.needsFirstDataAnchor || reminderAnchorRef.current) return;
    reminderAnchorRef.current = true;
    void store.ensureBackupReminderFirstDataAt(reminderNow.toISOString()).catch(() => {
      // Si IndexedDB no está disponible, el aviso se mantiene oculto en vez de insistir en cada apertura.
    });
  }, [
    backupReminder.needsFirstDataAnchor,
    reminderNow,
    store.ready,
    store.ensureBackupReminderFirstDataAt
  ]);

  const exportBackupFromReminder = async () => {
    try {
      const exported = await store.exportBackup();
      if (exported) {
        setReminderNow(new Date());
        store.showToast('Respaldo exportado');
      }
    } catch {
      store.showToast('No se pudo completar el respaldo. Intenta de nuevo.');
    }
  };

  const snoozeBackupReminder = async () => {
    if (snoozeRef.current || store.backupExporting) return;
    snoozeRef.current = true;
    setSnoozingReminder(true);
    const now = new Date();
    try {
      await store.snoozeBackupReminder(getBackupReminderSnoozedUntil(now));
      setReminderNow(now);
      store.showToast('Te lo recordaremos mañana.');
    } catch {
      store.showToast('No se pudo posponer el recordatorio. Intenta de nuevo.');
    } finally {
      snoozeRef.current = false;
      setSnoozingReminder(false);
    }
  };

  if (!store.ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-stone-100">
        <p className="text-stone-500">Cargando…</p>
      </div>
    );
  }

  const startNewQuote = () => {
    setDraft(
      emptyQuote({
        validityDays: store.settings.defaultValidityDays,
        goldPricePerGram: store.settings.goldPricePerGram,
        marginPercent: store.settings.defaultMarginPercent,
        taxEnabled: store.settings.taxEnabledByDefault,
        taxPercent: store.settings.defaultTaxPercent
      })
    );
    setView('form');
  };

  const editQuote = (quote: Quote) => {
    setDraft(quote);
    setView('form');
  };

  const duplicateQuote = async (quote: Quote) => {
    const now = new Date().toISOString();
    const copy: Quote = {
      ...quote,
      id: newId(),
      number: await store.nextQuoteNumber(),
      status: 'borrador',
      // La copia es una pieza nueva: aprobación, entrega, taller y abonos no se heredan.
      approvedAt: '',
      deliveredAt: '',
      date: todayISO(),
      validUntil: addDays(todayISO(), store.settings.defaultValidityDays),
      deposit: 0,
      depositDate: '',
      production: [],
      payments: [],
      createdAt: now,
      updatedAt: now
    };
    await store.upsertQuote(copy);
    store.showToast(`Copia creada: ${copy.number}`);
    setDraft(copy);
    setView('form');
  };

  const openPreview = (
    quote: Quote,
    tab: 'cliente' | 'interno' = 'cliente',
    from: 'history' | 'workshop' = 'history'
  ) => {
    setDraft(quote);
    setPreviewTab(tab);
    setPreviewFrom(from);
    setView('preview');
  };

  const openWorkshopJob = (quote: Quote) => {
    setDraft(quote);
    setView('workshopJob');
  };

  const closePreview = () => {
    if (previewFrom === 'workshop' && draft?.status === 'aprobada') {
      setView('workshopJob');
      return;
    }
    setDraft(null);
    setView(previewFrom === 'workshop' ? 'workshop' : 'history');
  };

  /** Las vistas con guardado diferido deben confirmar su escritura antes de navegar. */
  const runAfterViewFlush = async (action: () => void) => {
    const flush =
      view === 'preview'
        ? () => previewRef.current?.flushPending()
        : view === 'workshopJob'
          ? () => workshopJobRef.current?.flushPending()
          : null;
    if (flush) {
      const saved = await runAfterSuccessfulFlush(async () => {
        await flush();
      }, action);
      if (!saved) {
        store.showToast('No se pudo guardar. Reintenta antes de salir.');
      }
      return;
    }
    action();
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-stone-100">
      <header className="safe-top sticky top-0 z-40 bg-brand-900 text-white shadow">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold leading-tight">{store.settings.jewelryName}</h1>
            <p className="text-xs text-brand-100/80">Cotizaciones de joyería</p>
          </div>
          <span className="text-gold-400 text-2xl" aria-hidden>
            ◆
          </span>
        </div>
      </header>

      {isInAppBrowser() && <InAppBrowserBanner />}

      <main className="flex-1 px-4 pb-28 pt-4">
        {backupReminder.shouldShow && !store.backupExporting ? (
          <BackupReminderBanner
            busy={snoozingReminder}
            onExport={() => void exportBackupFromReminder()}
            onSnooze={() => void snoozeBackupReminder()}
          />
        ) : null}
        {view === 'history' && (
          <HistoryView
            onNew={startNewQuote}
            onOpen={(q) => openPreview(q)}
            onOpenWorkshop={openWorkshopJob}
            onEdit={editQuote}
            onDuplicate={duplicateQuote}
          />
        )}
        {view === 'form' && draft && (
          <QuoteFormView
            initial={draft}
            onPreview={(quote) => {
              setDraft(quote);
              setPreviewFrom('history');
              setView('preview');
            }}
            onCancel={() => {
              setDraft(null);
              setView('history');
            }}
          />
        )}
        {view === 'preview' && draft && (
          <PreviewView
            ref={previewRef}
            key={`${draft.id}-${previewTab}`}
            initialTab={previewTab}
            quote={draft}
            onEdit={() => setView('form')}
            onSaved={(quote) => setDraft(quote)}
            onOpenWorkshop={() => setView('workshopJob')}
            onClose={closePreview}
          />
        )}
        {view === 'workshop' && <WorkshopView onOpenJob={openWorkshopJob} />}
        {view === 'agenda' && <AgendaView />}
        {view === 'stones' && <StonesView />}
        {view === 'workshopJob' && draft && (
          <WorkshopJobView
            ref={workshopJobRef}
            key={draft.id}
            quote={draft}
            onSaved={(quote) => setDraft(quote)}
            onBack={() => {
              setDraft(null);
              setView('workshop');
            }}
            onOpenQuote={(quote) => openPreview(quote, 'interno', 'workshop')}
          />
        )}
        {view === 'more' && (
          <MoreView
            onDailyClose={() => setView('dailyClose')}
            onClients={() => setView('clients')}
            onSuppliers={() => setView('suppliers')}
            onSettings={() => setView('settings')}
          />
        )}
        {view === 'dailyClose' && (
          <div className="space-y-4">
            <BackRow label="← Más" onClick={() => setView('more')} />
            <DailyCloseView />
          </div>
        )}
        {view === 'clients' && (
          <div className="space-y-4">
            <BackRow label="← Más" onClick={() => setView('more')} />
            <ClientsView />
          </div>
        )}
        {view === 'suppliers' && (
          <div className="space-y-4">
            <BackRow label="← Más" onClick={() => setView('more')} />
            <SuppliersView />
          </div>
        )}
        {view === 'settings' && (
          <div className="space-y-4">
            <BackRow label="← Más" onClick={() => setView('more')} />
            <SettingsView />
          </div>
        )}
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg border-t border-stone-200 bg-white">
        <div className="grid grid-cols-5">
          <NavButton
            label="Cotizador"
            icon="🗂"
            active={view === 'history' || view === 'form' || view === 'preview'}
            onClick={() => void runAfterViewFlush(() => setView('history'))}
          />
          <NavButton
            label="Taller"
            icon="🛠"
            active={view === 'workshop' || view === 'workshopJob'}
            onClick={() => void runAfterViewFlush(() => setView('workshop'))}
          />
          <NavButton
            label="Agenda"
            icon="📅"
            badge={todayAppointments}
            active={view === 'agenda'}
            onClick={() => void runAfterViewFlush(() => setView('agenda'))}
          />
          <NavButton
            label="Piedras"
            icon="💎"
            active={view === 'stones'}
            onClick={() => void runAfterViewFlush(() => setView('stones'))}
          />
          <NavButton
            label="Más"
            icon="☰"
            active={
              view === 'more' ||
              view === 'dailyClose' ||
              view === 'clients' ||
              view === 'suppliers' ||
              view === 'settings'
            }
            onClick={() => void runAfterViewFlush(() => setView('more'))}
          />
        </div>
      </nav>

      <Toast message={store.toast} />
    </div>
  );
}

function BackupReminderBanner({
  busy,
  onExport,
  onSnooze
}: {
  busy: boolean;
  onExport: () => void;
  onSnooze: () => void;
}) {
  return (
    <section className="mb-4 rounded-2xl border border-brand-200 bg-brand-50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-brand-900">Respaldo recomendado</h2>
          <p className="mt-1 text-sm text-brand-800">
            Protege tu información. Han pasado varios días desde el último respaldo.
          </p>
        </div>
        <button
          type="button"
          aria-label="Cerrar y recordar mañana"
          disabled={busy}
          className="min-h-11 min-w-11 rounded-lg text-xl text-brand-800 disabled:text-stone-400"
          onClick={onSnooze}
        >
          ×
        </button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          className="min-h-12 rounded-xl bg-brand-800 px-4 font-medium text-white disabled:bg-stone-300"
          disabled={busy}
          onClick={onExport}
        >
          Exportar respaldo
        </button>
        <button
          type="button"
          className="min-h-12 rounded-xl border border-brand-700 bg-white px-4 font-medium text-brand-800 disabled:border-stone-300 disabled:text-stone-400"
          disabled={busy}
          onClick={onSnooze}
        >
          {busy ? 'Posponiendo…' : 'Recordar mañana'}
        </button>
      </div>
    </section>
  );
}

function InAppBrowserBanner() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="bg-amber-100 px-4 py-3">
      <p className="text-sm text-amber-900">
        Parece que abriste la app dentro de otra aplicación (WhatsApp, Instagram…). Para que funcione bien y puedas
        instalarla, ábrela en <strong>Chrome</strong> o <strong>Safari</strong>.
      </p>
      <button
        type="button"
        className="mt-2 min-h-11 rounded-lg bg-amber-200 px-4 py-2 text-sm font-medium text-amber-900"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(APP_URL);
            setCopied(true);
          } catch {
            // Si el portapapeles falla, el usuario puede copiar la URL de la barra.
          }
        }}
      >
        {copied ? 'Enlace copiado ✓' : 'Copiar enlace de la app'}
      </button>
    </div>
  );
}

function MoreView({
  onDailyClose,
  onClients,
  onSuppliers,
  onSettings
}: {
  onDailyClose: () => void;
  onClients: () => void;
  onSuppliers: () => void;
  onSettings: () => void;
}) {
  return (
    <div className="space-y-3">
      <MoreItem
        icon="📊"
        title="Cierre del día"
        subtitle="PDF interno con todos los movimientos del negocio"
        onClick={onDailyClose}
      />
      <MoreItem
        icon="👤"
        title="Clientes"
        subtitle="Datos de contacto y notas de tus clientes"
        onClick={onClients}
      />
      <MoreItem
        icon="🤝"
        title="Proveedores"
        subtitle="A quiénes les compras piedras y servicios"
        onClick={onSuppliers}
      />
      <MoreItem
        icon="⚙"
        title="Ajustes"
        subtitle="Datos de la joyería, precio del oro y respaldos"
        onClick={onSettings}
      />
    </div>
  );
}

function MoreItem({
  icon,
  title,
  subtitle,
  onClick
}: {
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm active:bg-stone-50"
    >
      <span className="text-2xl" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-stone-900">{title}</span>
        <span className="block truncate text-xs text-stone-500">{subtitle}</span>
      </span>
      <span className="text-stone-400" aria-hidden>
        ›
      </span>
    </button>
  );
}

function BackRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="min-h-11 text-sm font-medium text-brand-800" onClick={onClick}>
      {label}
    </button>
  );
}

function NavButton({
  label,
  icon,
  active,
  badge = 0,
  onClick
}: {
  label: string;
  icon: string;
  active: boolean;
  /** Número pequeño sobre el ícono (0 lo oculta). Aviso local, sin notificaciones. */
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
        active ? 'text-brand-800' : 'text-stone-500'
      }`}
    >
      <span className="relative text-lg leading-none" aria-hidden>
        {icon}
        {badge > 0 ? (
          <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
            {badge > 9 ? '9+' : badge}
          </span>
        ) : null}
      </span>
      {label}
    </button>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppShell />
    </StoreProvider>
  );
}
