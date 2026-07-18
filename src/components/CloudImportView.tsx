import { useEffect, useRef, useState } from 'react';
import type { BackupFile } from '../types';
import { downloadBackupFile } from '../services/backup';
import {
  countImportRecords,
  hasLocalDataToImport,
  importToCloud,
  readBackupImportSource,
  readLocalImportSource,
  type CloudImportProgress
} from '../services/cloud/importer';
import { Button, SectionCard } from './ui';

export function CloudImportView({
  initialSource,
  onDone,
  onCancel
}: {
  initialSource?: BackupFile | null;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [source, setSource] = useState<BackupFile | null>(initialSource ?? null);
  const [sourceName, setSourceName] = useState(initialSource ? 'Datos de este dispositivo' : '');
  const [loading, setLoading] = useState(!initialSource);
  const [busy, setBusy] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [progress, setProgress] = useState<CloudImportProgress | null>(null);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialSource) return;
    let mounted = true;
    void readLocalImportSource()
      .then((local) => {
        if (!mounted) return;
        setSource(local);
        setSourceName('Datos de este dispositivo');
      })
      .catch(() => {
        if (mounted) setError('No se pudieron leer los datos de este dispositivo. Puedes elegir un respaldo.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [initialSource]);

  const importNow = async () => {
    if (!source || busy) return;
    setBusy(true);
    setError('');
    setProgress(null);
    try {
      await importToCloud(source, { onProgress: setProgress });
      setCompleted(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo completar la importación.');
    } finally {
      setBusy(false);
    }
  };

  const records = source ? countImportRecords(source) : 0;
  const hasLocal = sourceName === 'Datos de este dispositivo' && source
    ? hasLocalDataToImport(source)
    : records > 0;

  return (
    <div className="atelier min-h-dvh px-4 py-6">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="text-center">
          <img src={`${import.meta.env.BASE_URL}pwa-192.png`} alt="" className="brand-icon mx-auto h-14 w-14" />
          <h1 className="font-display mt-3 text-2xl font-semibold text-stone-900">Subir mis datos locales</h1>
          <p className="mt-1 text-sm text-stone-500">Conserva tus identificadores y evita duplicados si repites el proceso.</p>
        </div>

        <SectionCard title="1. Guarda una copia" subtitle="Recomendado antes de subir información.">
          <Button
            variant="secondary"
            full
            disabled={busy || backingUp}
            onClick={() => {
              setBackingUp(true);
              setError('');
              void downloadBackupFile()
                .catch(() => setError('No se pudo descargar el respaldo. Intenta de nuevo.'))
                .finally(() => setBackingUp(false));
            }}
          >
            {backingUp ? 'Preparando respaldo…' : 'Descargar respaldo primero'}
          </Button>
        </SectionCard>

        <SectionCard title="2. Elige el origen">
          <div className="rounded-xl bg-stone-50 p-3">
            <p className="text-sm font-semibold text-stone-800">{loading ? 'Leyendo este dispositivo…' : sourceName || 'Sin origen elegido'}</p>
            {!loading ? (
              <p className="mt-1 text-xs text-stone-500">
                {hasLocal ? `${records} registros listos para subir.` : 'No se encontraron datos locales para subir.'}
              </p>
            ) : null}
          </div>
          <Button variant="secondary" full disabled={busy} onClick={() => fileInputRef.current?.click()}>
            Elegir un archivo de respaldo
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              setLoading(true);
              setError('');
              setSource(null);
              setSourceName('');
              void readBackupImportSource(file)
                .then((backup) => {
                  setSource(backup);
                  setSourceName(file.name);
                  setCompleted(false);
                  setProgress(null);
                })
                .catch((reason) => setError(
                  reason instanceof Error ? reason.message : 'No se pudo leer el respaldo.'
                ))
                .finally(() => setLoading(false));
            }}
          />
        </SectionCard>

        <SectionCard title="3. Sube la información">
          {progress ? (
            <div>
              <div className="mb-2 flex justify-between text-xs text-stone-500">
                <span>{progress.current || 'Preparando…'}</span>
                <span>{progress.completed} de {progress.total}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-brand-600" style={{ width: `${progress.percent}%` }} />
              </div>
            </div>
          ) : null}
          {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          {completed ? (
            <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Importación completada. Ya puedes continuar.</p>
          ) : null}
          {!completed ? (
            <Button full disabled={busy || loading || !source || !hasLocal} onClick={() => void importNow()}>
              {busy ? 'Subiendo…' : 'Subir a mi cuenta'}
            </Button>
          ) : (
            <Button full onClick={onDone}>Continuar</Button>
          )}
        </SectionCard>

        {onCancel && !busy ? (
          <div className="space-y-2 rounded-xl bg-amber-50 p-3">
            <p className="text-sm text-amber-900">
              Si continúas sin subirlos, estos datos seguirán guardados solamente en este dispositivo.
              No aparecerán en tus otros dispositivos hasta que vuelvas a Cuenta y los subas.
            </p>
            <Button variant="ghost" full onClick={onCancel}>Seguir sin subir estos datos</Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
