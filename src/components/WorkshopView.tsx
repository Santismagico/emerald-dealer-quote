// Área Taller: lista de trabajos (cotizaciones aprobadas) con avance de
// producción y saldo de abonos, organizados fuera del flujo de cotización.

import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { Quote } from '../types';
import {
  countWorkshopJobs,
  filterWorkshopJobs,
  workshopJobsFromQuotes,
  type WorkshopFilter,
  type WorkshopJob
} from '../services/workshop';
import { formatCOP } from '../utils/money';
import { EmptyState, TextInput } from './ui';

const FILTERS: Array<{ value: WorkshopFilter; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'enTaller', label: 'En taller' },
  { value: 'listos', label: 'Listos' }
];

export function WorkshopView({ onOpenJob }: { onOpenJob: (quote: Quote) => void }) {
  const store = useStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<WorkshopFilter>('todos');

  const jobs = useMemo(() => workshopJobsFromQuotes(store.quotes), [store.quotes]);
  const filtered = useMemo(() => filterWorkshopJobs(jobs, search, filter), [jobs, search, filter]);
  const counts = useMemo(() => countWorkshopJobs(jobs, search), [jobs, search]);

  return (
    <div className="space-y-4">
      <TextInput value={search} onChange={setSearch} placeholder="Buscar trabajo por cliente o número…" />

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-2 pb-1">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm ${
                filter === value ? 'bg-brand-800 text-white' : 'bg-white text-stone-600'
              }`}
            >
              {label} ({counts[value]})
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Sin trabajos en el taller"
          message={
            jobs.length === 0
              ? 'Cuando apruebes una cotización, aparecerá aquí como trabajo del taller.'
              : 'Ningún trabajo coincide con la búsqueda o el filtro.'
          }
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((job) => (
            <li key={job.quote.id}>
              <JobCard job={job} onOpen={() => onOpenJob(job.quote)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function JobCard({ job, onOpen }: { job: WorkshopJob; onOpen: () => void }) {
  const { quote } = job;
  const progressPercent = job.stagesTotal > 0 ? Math.round((job.stagesDone / job.stagesTotal) * 100) : 0;

  return (
    <button type="button" className="block w-full rounded-2xl bg-white p-4 text-left shadow-sm" onClick={onOpen}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-stone-900">{quote.clientSnapshot?.name || 'Sin cliente'}</p>
          <p className="truncate text-xs text-stone-500">
            {quote.number || 'Sin número'} · <span className="capitalize">{quote.pieceType}</span>
            {quote.pieceDescription ? ` · ${quote.pieceDescription}` : ''}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            job.ready ? 'bg-brand-100 text-brand-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {job.ready ? 'Listo ✓' : 'En taller'}
        </span>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-stone-500">
          <span>
            {job.stagesTotal > 0
              ? `${job.stagesDone}/${job.stagesTotal} etapas listas`
              : 'Sin etapas creadas todavía'}
          </span>
          <span>
            Saldo: <span className={`font-semibold ${job.balance > 0 ? 'text-stone-800' : 'text-brand-800'}`}>
              {formatCOP(job.balance)}
            </span>
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-200">
          <div
            className={`h-full rounded-full ${job.ready ? 'bg-brand-600' : 'bg-amber-500'}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </button>
  );
}
