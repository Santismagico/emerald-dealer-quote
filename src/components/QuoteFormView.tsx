// Formulario de cotización en 4 pasos, pensado para celular.
// Paso 1: cliente y fechas · Paso 2: pieza y material · Paso 3: piedras · Paso 4: costos.

import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { Quote, Stone, Client } from '../types';
import { PIECE_TYPES } from '../types';
import { newId } from '../utils/id';
import { calculateQuote, validateCalcInput, quoteToCalcInput, stoneSubtotal } from '../calc/engine';
import { formatCOP } from '../utils/money';
import { fileToCompressedDataUrl } from '../utils/images';
import { patchById } from '../utils/collections';
import { getEffectiveQuoteStatus } from '../services/quoteStatus';
import { todayISO } from '../utils/dates';
import {
  Button,
  Field,
  TextInput,
  MoneyInput,
  DecimalInput,
  Select,
  TextArea,
  Toggle,
  SectionCard
} from './ui';

const STEPS = ['Cliente', 'Pieza', 'Piedras', 'Costos'] as const;
const MAX_IMAGES = 4;

function emptyStone(): Stone {
  return {
    id: newId(),
    type: 'Esmeralda',
    cut: '',
    size: '',
    carats: 0,
    quantity: 1,
    priceMode: 'porPiedra',
    unitPrice: 0,
    treatment: '',
    quality: '',
    notes: ''
  };
}

export function QuoteFormView({
  initial,
  onPreview,
  onCancel
}: {
  initial: Quote;
  onPreview: (quote: Quote) => void;
  onCancel: () => void;
}) {
  const store = useStore();
  const [quote, setQuote] = useState<Quote>(initial);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [imageError, setImageError] = useState('');

  const calc = useMemo(() => calculateQuote(quoteToCalcInput(quote)), [quote]);
  const effectiveStatus = getEffectiveQuoteStatus(quote, todayISO());

  const patch = (partial: Partial<Quote>) => setQuote((q) => ({ ...q, ...partial }));

  const selectClient = (clientId: string) => {
    if (!clientId) {
      patch({ clientId: null, clientSnapshot: null });
      return;
    }
    const client = store.clients.find((c) => c.id === clientId) ?? null;
    patch({ clientId: client?.id ?? null, clientSnapshot: client ? { ...client } : null });
  };

  const goPreview = () => {
    const validation = validateCalcInput(quoteToCalcInput(quote));
    if (quote.weightGrams === 0 && quote.stones.length === 0 && quote.laborCost === 0) {
      validation.push('La cotización está vacía: agrega peso, piedras o mano de obra.');
    }
    setErrors(validation);
    if (validation.length === 0) {
      onPreview({ ...quote, updatedAt: new Date().toISOString() });
    }
  };

  const addImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setImageError('');
    const remaining = MAX_IMAGES - quote.images.length;
    if (remaining <= 0) {
      setImageError(`Máximo ${MAX_IMAGES} imágenes por cotización.`);
      return;
    }
    try {
      const selected = Array.from(files).slice(0, remaining);
      const dataUrls = await Promise.all(selected.map(fileToCompressedDataUrl));
      patch({ images: [...quote.images, ...dataUrls] });
    } catch {
      setImageError('No se pudo procesar una de las imágenes.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Indicador de pasos */}
      <div className="flex items-center gap-1.5">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={`flex-1 rounded-full py-2 text-xs font-medium ${
              i === step ? 'bg-brand-800 text-white' : i < step ? 'bg-brand-100 text-brand-800' : 'bg-white text-stone-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <SectionCard title="Cliente y fechas">
          <Field label="Cliente" hint="Crea clientes en la pestaña Clientes.">
            <Select
              value={quote.clientId ?? ''}
              onChange={selectClient}
              options={[
                { value: '', label: 'Sin cliente' },
                ...store.clients.map((c: Client) => ({ value: c.id, label: c.name }))
              ]}
            />
          </Field>
          <Field label="Fecha de la cotización">
            <TextInput type="date" value={quote.date} onChange={(date) => patch({ date })} />
          </Field>
          <Field label="Válida hasta">
            <TextInput type="date" value={quote.validUntil} onChange={(validUntil) => patch({ validUntil })} />
          </Field>
          {effectiveStatus !== quote.status ? (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              Esta cotización se muestra como vencida porque su fecha ya pasó. Cambiar la fecha aquí no modifica el
              estado guardado automáticamente.
            </p>
          ) : null}
          {quote.number ? (
            <p className="text-sm text-stone-500">Número: {quote.number}</p>
          ) : (
            <p className="text-sm text-stone-500">El número se asigna al guardar.</p>
          )}
        </SectionCard>
      )}

      {step === 1 && (
        <SectionCard title="Pieza y material">
          <Field label="Tipo de pieza">
            <Select
              value={quote.pieceType}
              onChange={(v) => patch({ pieceType: v as Quote['pieceType'] })}
              options={PIECE_TYPES.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
            />
          </Field>
          <Field label="Descripción" hint="Visible para el cliente en el PDF.">
            <TextArea
              value={quote.pieceDescription}
              onChange={(pieceDescription) => patch({ pieceDescription })}
              placeholder="Ej: Anillo de compromiso con esmeralda central"
              rows={2}
            />
          </Field>
          <Field label="Material">
            <Select
              value={['Oro', 'Plata'].includes(quote.material) ? quote.material : 'Otro'}
              onChange={(v) => {
                if (v === 'Oro') {
                  patch({ material: 'Oro', materialPricePerGram: store.settings.goldPricePerGram });
                } else if (v === 'Plata') {
                  patch({ material: 'Plata', materialPricePerGram: 0 });
                } else {
                  patch({ material: '' });
                }
              }}
              options={[
                { value: 'Oro', label: 'Oro' },
                { value: 'Plata', label: 'Plata' },
                { value: 'Otro', label: 'Otro' }
              ]}
            />
          </Field>
          {!['Oro', 'Plata'].includes(quote.material) && (
            <Field label="Nombre del material">
              <TextInput value={quote.material} onChange={(material) => patch({ material })} placeholder="Ej: Platino" />
            </Field>
          )}
          <Field label="Peso">
            <DecimalInput value={quote.weightGrams} onValue={(weightGrams) => patch({ weightGrams })} suffix="g" />
          </Field>
          <Field label="Precio del material por gramo" hint="Dato interno: no aparece en el PDF del cliente.">
            <MoneyInput value={quote.materialPricePerGram} onValue={(materialPricePerGram) => patch({ materialPricePerGram })} />
          </Field>
          {/* Solo en borradores: repreciar una cotización ya enviada/aprobada no debe ser un toque accidental. */}
          {quote.material === 'Oro' &&
            quote.status === 'borrador' &&
            store.settings.goldPricePerGram > 0 &&
            quote.materialPricePerGram !== store.settings.goldPricePerGram && (
              <button
                type="button"
                className="w-full rounded-xl bg-brand-50 p-3 text-left text-sm text-brand-900"
                onClick={() => patch({ materialPricePerGram: store.settings.goldPricePerGram })}
              >
                Precio del oro del día: <strong>{formatCOP(store.settings.goldPricePerGram)}</strong>/g. Toca para
                aplicarlo.
              </button>
            )}
          {quote.material === 'Oro' && quote.materialPricePerGram === 0 && store.settings.goldPricePerGram === 0 && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              El precio del oro está en $0. Conéctate a internet para actualizarlo en Ajustes o escríbelo aquí.
            </p>
          )}
          <p className="text-sm text-stone-500">Subtotal material: {formatCOP(calc.materialSubtotal)}</p>
        </SectionCard>
      )}

      {step === 2 && (
        <StonesStep
          stones={quote.stones}
          onChange={(stones) => patch({ stones })}
          subtotal={calc.stonesSubtotal}
        />
      )}

      {step === 3 && (
        <div className="space-y-4">
          <SectionCard title="Costos">
            <Field label="Mano de obra">
              <MoneyInput value={quote.laborCost} onValue={(laborCost) => patch({ laborCost })} />
            </Field>

            <div>
              <span className="mb-1 block text-sm font-medium text-stone-700">Costos adicionales</span>
              <div className="space-y-2">
                {quote.extraCosts.map((cost) => (
                  <div key={cost.id} className="flex gap-2">
                    <div className="flex-1">
                      <TextInput
                        value={cost.label}
                        placeholder="Concepto"
                        onChange={(label) =>
                          patch({ extraCosts: quote.extraCosts.map((c) => (c.id === cost.id ? { ...c, label } : c)) })
                        }
                      />
                    </div>
                    <div className="w-36">
                      <MoneyInput
                        value={cost.amount}
                        onValue={(amount) =>
                          patch({ extraCosts: quote.extraCosts.map((c) => (c.id === cost.id ? { ...c, amount } : c)) })
                        }
                      />
                    </div>
                    <button
                      type="button"
                      aria-label="Quitar costo"
                      className="min-h-12 w-10 rounded-xl text-red-500 active:bg-red-50"
                      onClick={() => patch({ extraCosts: quote.extraCosts.filter((c) => c.id !== cost.id) })}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="mt-2 text-sm font-medium text-brand-800"
                onClick={() => patch({ extraCosts: [...quote.extraCosts, { id: newId(), label: '', amount: 0 }] })}
              >
                ＋ Agregar costo
              </button>
            </div>

            <Field label="Margen interno" hint="Confidencial: nunca se muestra al cliente.">
              <DecimalInput value={quote.marginPercent} onValue={(marginPercent) => patch({ marginPercent })} suffix="%" />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Tipo de descuento">
                <Select
                  value={quote.discountType}
                  onChange={(v) => patch({ discountType: v as Quote['discountType'] })}
                  options={[
                    { value: 'porcentaje', label: 'Porcentaje' },
                    { value: 'valor', label: 'Valor fijo' }
                  ]}
                />
              </Field>
              <Field label="Descuento">
                {quote.discountType === 'porcentaje' ? (
                  <DecimalInput value={quote.discountValue} onValue={(discountValue) => patch({ discountValue })} suffix="%" />
                ) : (
                  <MoneyInput value={quote.discountValue} onValue={(discountValue) => patch({ discountValue })} />
                )}
              </Field>
            </div>

            <Toggle
              checked={quote.taxEnabled}
              onChange={(taxEnabled) => patch({ taxEnabled })}
              label="Aplicar impuesto"
            />
            {quote.taxEnabled && (
              <Field label="Impuesto">
                <DecimalInput value={quote.taxPercent} onValue={(taxPercent) => patch({ taxPercent })} suffix="%" />
              </Field>
            )}

            <Field label="Anticipo (opcional)">
              <MoneyInput value={quote.deposit} onValue={(deposit) => patch({ deposit })} />
            </Field>
          </SectionCard>

          <SectionCard title="Observaciones e imágenes">
            <Field label="Observaciones para el cliente" hint="Aparecen en el PDF del cliente.">
              <TextArea value={quote.clientNotes} onChange={(clientNotes) => patch({ clientNotes })} rows={2} />
            </Field>
            <Field label="Observaciones internas" hint="Solo para ti. Nunca llegan al cliente.">
              <TextArea value={quote.internalNotes} onChange={(internalNotes) => patch({ internalNotes })} rows={2} />
            </Field>

            <div>
              <span className="mb-1 block text-sm font-medium text-stone-700">
                Imágenes de referencia ({quote.images.length}/{MAX_IMAGES})
              </span>
              <div className="flex flex-wrap gap-2">
                {quote.images.map((img, i) => (
                  <div key={i} className="relative">
                    <img src={img} alt={`Referencia ${i + 1}`} className="h-20 w-20 rounded-xl object-cover" />
                    <button
                      type="button"
                      aria-label="Quitar imagen"
                      className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs text-white"
                      onClick={() => patch({ images: quote.images.filter((_, idx) => idx !== i) })}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {quote.images.length < MAX_IMAGES && (
                  <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border border-dashed border-stone-300 text-2xl text-stone-400">
                    ＋
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        void addImages(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
              {imageError ? <p className="mt-1 text-sm text-red-600">{imageError}</p> : null}
            </div>
          </SectionCard>
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded-xl bg-red-50 p-3">
          {errors.map((e) => (
            <p key={e} className="text-sm text-red-700">
              • {e}
            </p>
          ))}
        </div>
      )}

      {/* Barra inferior con total en vivo y navegación */}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-stone-500">Total estimado</span>
          <span className="text-lg font-bold text-brand-900">{formatCOP(calc.total)}</span>
        </div>
        <div className="flex gap-2">
          {step === 0 ? (
            <div className="flex-1">
              <Button variant="ghost" full onClick={onCancel}>
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="flex-1">
              <Button variant="secondary" full onClick={() => setStep(step - 1)}>
                Anterior
              </Button>
            </div>
          )}
          {step < STEPS.length - 1 ? (
            <div className="flex-1">
              <Button full onClick={() => setStep(step + 1)}>
                Siguiente
              </Button>
            </div>
          ) : (
            <div className="flex-1">
              <Button full onClick={goPreview}>
                Vista previa
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StonesStep({
  stones,
  onChange,
  subtotal
}: {
  stones: Stone[];
  onChange: (stones: Stone[]) => void;
  subtotal: number;
}) {
  const patchStone = (id: string, partial: Partial<Stone>) => onChange(patchById(stones, id, partial));

  return (
    <div className="space-y-4">
      {stones.length === 0 && (
        <p className="rounded-2xl bg-white p-4 text-sm text-stone-500 shadow-sm">
          Esta pieza no tiene piedras. Puedes agregar una o continuar al siguiente paso.
        </p>
      )}

      {stones.map((stone, index) => (
        <SectionCard key={stone.id} title={`Piedra ${index + 1}`} subtitle={`Subtotal: ${formatCOP(stoneSubtotal(stone))}`}>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tipo">
              <TextInput value={stone.type} onChange={(type) => patchStone(stone.id, { type })} placeholder="Esmeralda" />
            </Field>
            <Field label="Talla / forma">
              <TextInput value={stone.cut} onChange={(cut) => patchStone(stone.id, { cut })} placeholder="Esmeralda, oval…" />
            </Field>
            <Field label="Medida">
              <TextInput value={stone.size} onChange={(size) => patchStone(stone.id, { size })} placeholder="7x5 mm" />
            </Field>
            <Field label="Peso (ct por piedra)">
              <DecimalInput value={stone.carats} onValue={(carats) => patchStone(stone.id, { carats })} suffix="ct" />
            </Field>
            <Field label="Cantidad">
              <DecimalInput value={stone.quantity} onValue={(quantity) => patchStone(stone.id, { quantity: Math.max(0, Math.round(quantity)) })} />
            </Field>
            <Field label="Precio">
              <Select
                value={stone.priceMode}
                onChange={(v) => patchStone(stone.id, { priceMode: v as Stone['priceMode'] })}
                options={[
                  { value: 'porPiedra', label: 'Por piedra' },
                  { value: 'porQuilate', label: 'Por quilate' }
                ]}
              />
            </Field>
          </div>
          <Field label={stone.priceMode === 'porQuilate' ? 'Precio por quilate' : 'Precio por piedra'}>
            <MoneyInput value={stone.unitPrice} onValue={(unitPrice) => patchStone(stone.id, { unitPrice })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tratamiento (opcional)">
              <TextInput value={stone.treatment} onChange={(treatment) => patchStone(stone.id, { treatment })} />
            </Field>
            <Field label="Calidad (opcional)">
              <TextInput value={stone.quality} onChange={(quality) => patchStone(stone.id, { quality })} />
            </Field>
          </div>
          <Field label="Observación interna" hint="No aparece en el PDF del cliente.">
            <TextInput value={stone.notes} onChange={(notes) => patchStone(stone.id, { notes })} />
          </Field>
          <Button variant="danger" full onClick={() => onChange(stones.filter((s) => s.id !== stone.id))}>
            Quitar piedra
          </Button>
        </SectionCard>
      ))}

      <Button variant="secondary" full onClick={() => onChange([...stones, emptyStone()])}>
        ＋ Agregar piedra
      </Button>
      <p className="text-center text-sm text-stone-500">Subtotal piedras: {formatCOP(subtotal)}</p>
    </div>
  );
}
