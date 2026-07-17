// Configuración de la joyería, reglas internas de cálculo y respaldo de datos.

import { useRef, useState } from 'react';
import { useStore } from '../store';
import type { BackupFile, Settings } from '../types';
import { fileToCompressedDataUrl } from '../utils/images';
import { formatCOP } from '../utils/money';
import { formatDateCO } from '../utils/dates';
import { parseBackup, importBackup } from '../services/backup';
import { defaultSettings } from '../services/storage';
import {
  Button,
  Field,
  TextInput,
  MoneyInput,
  DecimalInput,
  TextArea,
  Toggle,
  SectionCard,
  ConfirmDialog
} from './ui';

type BackupRestoreResult = 'success' | 'restore-failed' | 'reload-failed';

export const BACKUP_RESTORE_WARNING =
  'Esto REEMPLAZARÁ los ajustes, clientes, cotizaciones (incluidos sus abonos y seguimiento del taller), agenda, lotes de piedras (incluidas sus ventas y pagos a proveedores) y proveedores actuales por los del archivo. Esta acción no se puede deshacer. ¿Deseas continuar?';

/** Orden comprobable del flujo: restaurar, sincronizar, recargar y recién entonces avisar éxito. */
export async function runBackupRestoreFlow(actions: {
  restore: () => Promise<void>;
  afterCommit: () => void;
  reloadAll: () => Promise<void>;
  showSuccess: () => void;
}): Promise<BackupRestoreResult> {
  try {
    await actions.restore();
  } catch {
    return 'restore-failed';
  }

  try {
    actions.afterCommit();
    await actions.reloadAll();
  } catch {
    return 'reload-failed';
  }

  actions.showSuccess();
  return 'success';
}

export function SettingsView() {
  const store = useStore();
  const [form, setForm] = useState<Settings>(store.settings);
  const [dirty, setDirty] = useState(false);
  const [importPending, setImportPending] = useState<BackupFile | null>(null);
  const [importError, setImportError] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const importBusyRef = useRef(false);
  const [goldBusy, setGoldBusy] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  // Valor del oro que tenía el formulario al abrirse: permite saber si el
  // usuario lo editó a mano o si debe conservarse el auto-actualizado.
  const initialGoldRef = useRef({
    price: store.settings.goldPricePerGram,
    updatedAt: store.settings.goldPriceUpdatedAt
  });

  const patch = (partial: Partial<Settings>) => {
    setForm((f) => ({ ...f, ...partial }));
    setDirty(true);
  };

  const handleSave = async () => {
    const next = { ...form };
    const goldPriceWasEdited = form.goldPricePerGram !== initialGoldRef.current.price;
    // Si el precio del oro se auto-actualizó en segundo plano y el usuario NO
    // tocó el campo manual, guardar el formulario no debe revertirlo
    // (carrera detectada en auditoría).
    if (!goldPriceWasEdited) {
      next.goldPricePerGram = store.settings.goldPricePerGram;
      next.goldPriceUpdatedAt = store.settings.goldPriceUpdatedAt;
    }
    // Estos controles no se editan en el formulario. Se conservan desde el
    // estado actual para que un guardado pendiente no borre un respaldo o una
    // posposición que acabó de registrarse desde el banner.
    next.lastBackupExportedAt = store.settings.lastBackupExportedAt;
    next.backupReminderSnoozedUntil = store.settings.backupReminderSnoozedUntil;
    next.backupReminderFirstDataAt = store.settings.backupReminderFirstDataAt;
    const saved = await store.updateSettings(next, goldPriceWasEdited);
    setForm(saved);
    initialGoldRef.current = { price: saved.goldPricePerGram, updatedAt: saved.goldPriceUpdatedAt };
    setDirty(false);
    store.showToast('Ajustes guardados');
  };

  const handleExport = async () => {
    try {
      const exported = await store.exportBackup();
      if (exported) store.showToast('Respaldo exportado');
    } catch {
      store.showToast('No se pudo completar el respaldo. Intenta de nuevo.');
    }
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    setImportError('');
    let text: string;
    try {
      text = await file.text();
    } catch {
      setImportError('No se pudo leer el archivo de respaldo.');
      return;
    }
    try {
      // Conserva el objeto ya validado; importBackup lo vuelve a validar como
      // defensa antes de iniciar la escritura atómica.
      setImportPending(parseBackup(text));
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Archivo de respaldo inválido.');
    }
  };

  const confirmImport = async () => {
    if (!importPending || importBusyRef.current) return;
    importBusyRef.current = true;
    setImportBusy(true);
    const pending = importPending;
    try {
      const restoredSettings = pending.settings ?? defaultSettings();
      const result = await runBackupRestoreFlow({
        restore: () => importBackup(pending),
        afterCommit: () => {
          // Evita que un formulario anterior vuelva a sobrescribir los ajustes
          // restaurados mientras React actualiza el resto de la aplicación.
          setForm(restoredSettings);
          initialGoldRef.current = {
            price: restoredSettings.goldPricePerGram,
            updatedAt: restoredSettings.goldPriceUpdatedAt
          };
          setDirty(false);
        },
        // Solo se recarga la memoria de React después del commit real.
        reloadAll: store.reloadAll,
        showSuccess: () => store.showToast('Respaldo restaurado')
      });

      if (result === 'restore-failed') {
        setImportError(
          'No se pudo restaurar el respaldo. Tus datos anteriores se conservaron.'
        );
      } else if (result === 'reload-failed') {
        setImportError(
          'El respaldo se restauró, pero no se pudo actualizar la pantalla. Cierra y vuelve a abrir la aplicación.'
        );
      }
    } catch {
      setImportError(
        'El respaldo se restauró, pero no se pudo actualizar la pantalla. Cierra y vuelve a abrir la aplicación.'
      );
    } finally {
      importBusyRef.current = false;
      setImportBusy(false);
      setImportPending(null);
    }
  };

  return (
    <div className="space-y-4">
      <SectionCard title="Datos de la joyería" subtitle="Aparecen en el PDF que recibe el cliente.">
        <Field label="Nombre de la joyería">
          <TextInput value={form.jewelryName} onChange={(jewelryName) => patch({ jewelryName })} />
        </Field>
        <div>
          <span className="mb-1 block text-sm font-medium text-stone-700">Logo</span>
          <div className="flex items-center gap-3">
            {form.logoDataUrl ? (
              <img src={form.logoDataUrl} alt="Logo" className="h-14 w-14 rounded-xl border border-stone-200 object-contain" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-stone-300 text-stone-400">
                —
              </div>
            )}
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl px-2 text-sm font-medium text-brand-800">
              {form.logoDataUrl ? 'Cambiar logo' : 'Subir logo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      patch({ logoDataUrl: await fileToCompressedDataUrl(file) });
                    } catch {
                      store.showToast('No se pudo cargar el logo.');
                    }
                  }
                  e.target.value = '';
                }}
              />
            </label>
            {form.logoDataUrl ? (
              <button type="button" className="min-h-11 rounded-xl px-2 text-sm text-red-600" onClick={() => patch({ logoDataUrl: '' })}>
                Quitar
              </button>
            ) : null}
          </div>
        </div>
        <Field label="NIT o identificación (opcional)">
          <TextInput value={form.nit} onChange={(nit) => patch({ nit })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Teléfono">
            <TextInput value={form.phone} onChange={(phone) => patch({ phone })} inputMode="tel" />
          </Field>
          <Field label="WhatsApp">
            <TextInput value={form.whatsapp} onChange={(whatsapp) => patch({ whatsapp })} inputMode="tel" placeholder="57300…" />
          </Field>
        </div>
        <Field label="Dirección">
          <TextInput value={form.address} onChange={(address) => patch({ address })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Ciudad">
            <TextInput value={form.city} onChange={(city) => patch({ city })} />
          </Field>
          <Field label="Email">
            <TextInput value={form.email} onChange={(email) => patch({ email })} inputMode="email" type="email" />
          </Field>
        </div>
        <Field label="Mensaje comercial" hint="Cierre del PDF, ej: Gracias por su confianza.">
          <TextArea value={form.commercialMessage} onChange={(commercialMessage) => patch({ commercialMessage })} rows={2} />
        </Field>
        <Field label="Condiciones comerciales" hint="Se imprimen en el PDF del cliente.">
          <TextArea value={form.conditions} onChange={(conditions) => patch({ conditions })} rows={3} />
        </Field>
      </SectionCard>

      <SectionCard title="Cotizaciones">
        <Field label="Validez por defecto (días)">
          <DecimalInput
            value={form.defaultValidityDays}
            onValue={(v) => patch({ defaultValidityDays: Math.max(1, Math.round(v)) })}
            suffix="días"
          />
        </Field>
        <p className="text-sm text-stone-500">Moneda: COP (peso colombiano)</p>
      </SectionCard>

      <SectionCard
        title="Cálculo interno"
        subtitle="Confidencial. Nada de esta sección aparece en el PDF del cliente."
      >
        <div className="rounded-xl bg-brand-50 p-3">
          <p className="text-sm font-medium text-brand-900">Precio del oro por gramo (automático)</p>
          <p className="mt-1 text-2xl font-bold text-brand-900">{formatCOP(form.goldPricePerGram)}</p>
          <p className="mt-1 text-xs text-stone-600">
            = precio internacional 24K del día + {formatCOP(form.goldMarkupPerGram)} de recargo por gramo.
          </p>
          <p className="text-xs text-stone-500">
            {form.goldPriceUpdatedAt
              ? `Última actualización: ${formatDateCO(form.goldPriceUpdatedAt.slice(0, 10))}`
              : 'Aún no se ha actualizado. Se actualiza solo al abrir la app con internet.'}
          </p>
          <div className="mt-2">
            <Button
              variant="secondary"
              full
              disabled={goldBusy}
              onClick={async () => {
                setGoldBusy(true);
                try {
                  const goldPriceWasEdited = form.goldPricePerGram !== initialGoldRef.current.price;
                  const saved = await store.updateSettings(form, goldPriceWasEdited);
                  setForm(saved);
                  initialGoldRef.current = {
                    price: saved.goldPricePerGram,
                    updatedAt: saved.goldPriceUpdatedAt
                  };
                  setDirty(false);
                  const info = await store.refreshGoldPrice();
                  setForm((f) => ({
                    ...f,
                    goldPricePerGram: info.totalCopPerGram,
                    goldPriceUpdatedAt: info.fetchedAt
                  }));
                  initialGoldRef.current = { price: info.totalCopPerGram, updatedAt: info.fetchedAt };
                  setDirty(false);
                  store.showToast('Precio del oro actualizado');
                } catch {
                  store.showToast('Sin conexión: se conserva el último precio guardado.');
                } finally {
                  setGoldBusy(false);
                }
              }}
            >
              {goldBusy ? 'Consultando precio…' : '↻ Actualizar precio ahora'}
            </Button>
          </div>
        </div>
        <Field label="Recargo por gramo" hint="Se suma al precio internacional. Regla del negocio: $100.000.">
          <MoneyInput value={form.goldMarkupPerGram} onValue={(goldMarkupPerGram) => patch({ goldMarkupPerGram })} />
        </Field>
        <Field
          label="Precio manual (respaldo sin internet)"
          hint="Si no hay conexión, puedes fijar el precio a mano. Se reemplaza en la próxima actualización automática."
        >
          <MoneyInput value={form.goldPricePerGram} onValue={(goldPricePerGram) => patch({ goldPricePerGram })} />
        </Field>
        {form.goldPricePerGram === 0 && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            El precio del oro está en $0. Conéctate a internet y toca “Actualizar precio ahora”, o fija un precio manual.
          </p>
        )}
        <Field label="Margen por defecto">
          <DecimalInput value={form.defaultMarginPercent} onValue={(defaultMarginPercent) => patch({ defaultMarginPercent })} suffix="%" />
        </Field>
        <Toggle
          checked={form.taxEnabledByDefault}
          onChange={(taxEnabledByDefault) => patch({ taxEnabledByDefault })}
          label="Aplicar impuesto por defecto"
        />
        <Field label="Impuesto por defecto">
          <DecimalInput value={form.defaultTaxPercent} onValue={(defaultTaxPercent) => patch({ defaultTaxPercent })} suffix="%" />
        </Field>
      </SectionCard>

      <SectionCard
        title="Respaldo de datos"
        subtitle="Tus datos viven solo en este dispositivo. Exporta un respaldo con frecuencia."
      >
        <Button variant="secondary" full disabled={store.backupExporting} onClick={handleExport}>
          {store.backupExporting ? 'Preparando respaldo…' : '⬇ Exportar respaldo (JSON)'}
        </Button>
        <Button
          variant="secondary"
          full
          onClick={() => importInputRef.current?.click()}
        >
          ⬆ Importar respaldo
        </Button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            void handleImportFile(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />
        {importError ? <p className="text-sm text-red-600">{importError}</p> : null}
      </SectionCard>

      <SectionCard title="Instalar la app" subtitle="Emerald Dealer Quote funciona sin internet una vez instalada.">
        <p className="text-sm text-stone-600">
          <strong>iPhone:</strong> abre esta página en Safari → botón Compartir → “Añadir a pantalla de inicio”.
        </p>
        <p className="text-sm text-stone-600">
          <strong>Android:</strong> abre en Chrome → menú ⋮ → “Instalar aplicación”.
        </p>
      </SectionCard>

      <div className="sticky bottom-24 z-30">
        <Button full onClick={handleSave} disabled={!dirty}>
          {dirty ? 'Guardar ajustes' : 'Ajustes guardados ✓'}
        </Button>
      </div>

      <p className="pb-2 text-center text-xs text-stone-400">Emerald Dealer Quote v{__APP_VERSION__}</p>

      <ConfirmDialog
        open={importPending !== null}
        title="Restaurar respaldo"
        message={BACKUP_RESTORE_WARNING}
        confirmLabel={importBusy ? 'Restaurando…' : 'Reemplazar todo'}
        danger
        busy={importBusy}
        onCancel={() => setImportPending(null)}
        onConfirm={() => void confirmImport()}
      />
    </div>
  );
}
