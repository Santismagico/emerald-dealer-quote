import { useState } from 'react';
import { StoreProvider, useStore } from './store';
import type { Quote } from './types';
import { newId } from './utils/id';
import { todayISO, addDays } from './utils/dates';
import { HistoryView } from './components/HistoryView';
import { QuoteFormView } from './components/QuoteFormView';
import { PreviewView } from './components/PreviewView';
import { ClientsView } from './components/ClientsView';
import { SettingsView } from './components/SettingsView';
import { Toast } from './components/ui';

type ViewName = 'history' | 'form' | 'preview' | 'clients' | 'settings';

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
      date: todayISO(),
      validUntil: addDays(todayISO(), store.settings.defaultValidityDays),
      // La copia es una pieza nueva: el avance de taller y los abonos no se heredan.
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

  const openPreview = (quote: Quote, tab: 'cliente' | 'interno' = 'cliente') => {
    setDraft(quote);
    setPreviewTab(tab);
    setView('preview');
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
        {view === 'history' && (
          <HistoryView
            onNew={startNewQuote}
            onOpen={(q) => openPreview(q)}
            onOpenInternal={(q) => openPreview(q, 'interno')}
            onEdit={editQuote}
            onDuplicate={duplicateQuote}
          />
        )}
        {view === 'form' && draft && (
          <QuoteFormView
            initial={draft}
            onPreview={(quote) => {
              setDraft(quote);
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
            key={`${draft.id}-${previewTab}`}
            initialTab={previewTab}
            quote={draft}
            onEdit={() => setView('form')}
            onSaved={(quote) => setDraft(quote)}
            onClose={() => {
              setDraft(null);
              setView('history');
            }}
          />
        )}
        {view === 'clients' && <ClientsView />}
        {view === 'settings' && <SettingsView />}
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg border-t border-stone-200 bg-white">
        <div className="grid grid-cols-4">
          <NavButton label="Cotizaciones" icon="🗂" active={view === 'history' || view === 'preview'} onClick={() => setView('history')} />
          <NavButton label="Nueva" icon="＋" active={view === 'form'} onClick={startNewQuote} />
          <NavButton label="Clientes" icon="👤" active={view === 'clients'} onClick={() => setView('clients')} />
          <NavButton label="Ajustes" icon="⚙" active={view === 'settings'} onClick={() => setView('settings')} />
        </div>
      </nav>

      <Toast message={store.toast} />
    </div>
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
        className="mt-2 rounded-lg bg-amber-200 px-3 py-2 text-sm font-medium text-amber-900"
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

function NavButton({
  label,
  icon,
  active,
  onClick
}: {
  label: string;
  icon: string;
  active: boolean;
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
      <span className="text-lg leading-none" aria-hidden>
        {icon}
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
