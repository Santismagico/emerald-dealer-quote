import { useMemo, useRef, useState } from 'react';
import type { Settings, StockJewel } from '../types';
import {
  selectCatalogJewels,
  type CatalogOptions,
  type CatalogStoneFilter
} from '../services/catalog';
import {
  CatalogPdfTooLargeError,
  CatalogPrivacyError,
  createCatalogPdfFile,
  downloadPdfFile
} from '../services/pdf';
import { clientPdfShareMessage, shareCatalogPdfFile } from '../services/pdfShare';
import { Button, SegmentedControl, SectionCard, Toggle } from './ui';

export function StockJewelCatalogView({
  jewels,
  settings,
  generatedDate,
  onClose
}: {
  jewels: readonly StockJewel[];
  settings: Settings;
  generatedDate: string;
  onClose: () => void;
}) {
  const [stoneFilter, setStoneFilter] = useState<CatalogStoneFilter>('todas');
  const [includePrices, setIncludePrices] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    kind: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const runningRef = useRef(false);
  const options: CatalogOptions = { stoneFilter, includePrices };
  const selected = useMemo(
    () => selectCatalogJewels(jewels, { stoneFilter, includePrices }),
    [jewels, stoneFilter, includePrices]
  );

  const run = async (action: 'download' | 'share') => {
    if (runningRef.current || selected.length === 0) return;
    runningRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const file = await createCatalogPdfFile(jewels, settings, options, generatedDate);
      if (action === 'download') {
        downloadPdfFile(file);
        setMessage({ kind: 'success', text: 'Catálogo descargado.' });
        return;
      }
      const result = await shareCatalogPdfFile(file);
      setMessage({
        kind: result.status === 'error' ? 'error' : 'info',
        text: clientPdfShareMessage(result)
      });
    } catch (problem) {
      if (problem instanceof CatalogPrivacyError) {
        setMessage({
          kind: 'error',
          text: `Salida bloqueada. Revisa el nombre, material y datos de la joyería: ${problem.words.join(', ')}.`
        });
      } else if (problem instanceof CatalogPdfTooLargeError) {
        setMessage({ kind: 'error', text: problem.message });
      } else {
        setMessage({
          kind: 'error',
          text: problem instanceof Error ? problem.message : 'No se pudo crear el catálogo.'
        });
      }
    } finally {
      runningRef.current = false;
      setBusy(false);
    }
  };

  const messageClass = message?.kind === 'error'
    ? 'bg-red-50 text-red-700'
    : message?.kind === 'success'
      ? 'bg-emerald-50 text-emerald-800'
      : 'bg-stone-100 text-stone-700';

  return (
    <div className="space-y-4">
      <SectionCard title="Catálogo para clientes">
        <div className="space-y-4">
          <p className="text-sm text-stone-600">
            Solo incluye piezas disponibles. Las vendidas y apartadas quedan fuera.
          </p>

          <SegmentedControl
            label="Clase de piedra"
            value={stoneFilter}
            options={[
              { value: 'todas', label: 'Todas' },
              { value: 'naturales', label: 'Naturales' },
              { value: 'fantasia', label: 'Fantasía' }
            ]}
            onChange={(value) => {
              setStoneFilter(value as CatalogStoneFilter);
              setMessage(null);
            }}
          />

          <Toggle
            checked={includePrices}
            label="Incluir precios en este catálogo"
            disabled={busy}
            onChange={(value) => {
              setIncludePrices(value);
              setMessage(null);
            }}
          />

          <div className="rounded-xl bg-stone-50 p-3">
            <p className="text-sm font-semibold text-stone-800">
              {selected.length} {selected.length === 1 ? 'pieza disponible' : 'piezas disponibles'}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              {includePrices
                ? 'El PDF mostrará el precio comercial de cada pieza.'
                : 'El PDF no llevará precios.'}
            </p>
          </div>

          {selected.length === 0 ? (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              No hay piezas disponibles con este filtro.
            </p>
          ) : null}

          {message ? (
            <p role="status" className={`break-words rounded-xl p-3 text-sm ${messageClass}`}>
              {message.text}
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button
              variant="secondary"
              full
              disabled={busy || selected.length === 0}
              onClick={() => void run('download')}
            >
              {busy ? 'Preparando…' : 'Descargar PDF'}
            </Button>
            <Button
              full
              disabled={busy || selected.length === 0}
              onClick={() => void run('share')}
            >
              {busy ? 'Preparando…' : 'Compartir PDF'}
            </Button>
          </div>

          <Button variant="ghost" full disabled={busy} onClick={onClose}>
            Volver a Joyas
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
