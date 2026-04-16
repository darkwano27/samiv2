import { Pill, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SO_RX_FREQUENCY_OPTIONS } from '../constants/so-rx-frequencies';
import { useSoMedicineSearch } from '../hooks/use-so-medicine-search';
import type { SoMedicine } from '../types/so-consultation.types';
import type { SoPrescriptionDraft } from '../types/so-consultation.types';

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';

const textareaClass =
  'flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';

type Props = {
  open: boolean;
  onClose: () => void;
  onAdd: (draft: Omit<SoPrescriptionDraft, 'localKey'>) => void;
  onOpenCatalog: () => void;
};

export function AddPrescriptionModal({ open, onClose, onAdd, onOpenCatalog }: Props) {
  const [medSearch, setMedSearch] = useState('');
  const [picked, setPicked] = useState<SoMedicine | null>(null);
  const [frequency, setFrequency] = useState<string>('');
  const [duration, setDuration] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [instructions, setInstructions] = useState('');

  const medQ = useSoMedicineSearch(medSearch);

  if (!open) return null;

  function reset() {
    setMedSearch('');
    setPicked(null);
    setFrequency('');
    setDuration('');
    setQuantity(1);
    setInstructions('');
  }

  function handleAdd() {
    const q = Math.floor(Number(quantity));
    if (!picked || !Number.isFinite(q) || q < 0) return;
    onAdd({
      medicineId: picked.id,
      medicineLabel: picked.name,
      concentration: picked.concentration,
      presentation: picked.presentation,
      administrationRoute: picked.administrationRoute,
      quantity: q,
      frequency: frequency.trim() || undefined,
      duration: duration.trim() || undefined,
      instructions: instructions.trim() || undefined,
    });
    reset();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex min-h-[100dvh] items-center justify-center bg-black/45 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      role="presentation"
      onClick={() => onClose()}
    >
      <div
        role="dialog"
        aria-labelledby="so-add-rx-title"
        aria-modal="true"
        className="max-h-[min(90dvh,640px)] w-full max-w-lg overflow-visible rounded-xl border border-border bg-background p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Pill className="h-5 w-5 text-primary" aria-hidden />
          <h2 id="so-add-rx-title" className="font-heading text-lg font-semibold">
            Agregar fármaco
          </h2>
        </div>

        <div className="mt-4 max-h-[min(70dvh,520px)] space-y-4 overflow-y-auto overflow-x-hidden pr-0.5">
          <div className="space-y-2">
            <Label>Medicamento *</Label>
            <div className="flex gap-2">
              <div className="relative z-10 min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  className="h-10 border-primary/40 pl-9 focus-visible:border-primary"
                  value={medSearch}
                  onChange={(e) => {
                    setMedSearch(e.target.value);
                    setPicked(null);
                  }}
                  placeholder="Buscar medicamento por nombre…"
                  autoComplete="off"
                />
                {medQ.data && medQ.data.length > 0 && !picked ? (
                  <ul
                    className="absolute left-0 right-0 top-full z-20 mt-1 max-h-36 overflow-y-auto rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-md"
                    role="listbox"
                  >
                    {medQ.data.map((m) => (
                      <li key={m.id} role="option">
                        <button
                          type="button"
                          className="w-full px-3 py-2.5 text-left text-sm hover:bg-muted/60"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setPicked(m)}
                        >
                          <span className="font-medium">{m.name}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {m.presentation} · {m.administrationRoute}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0 border-primary/50 text-primary"
                title="Nuevo medicamento en catálogo"
                onClick={() => {
                  onOpenCatalog();
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {picked ? (
              <p className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                <span className="font-medium">{picked.name}</span>
                <button
                  type="button"
                  className="ml-2 text-xs text-primary underline"
                  onClick={() => setPicked(null)}
                >
                  Cambiar
                </button>
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="so-rx-freq">Frecuencia</Label>
              <select
                id="so-rx-freq"
                className={selectClass}
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              >
                <option value="">Seleccionar…</option>
                {SO_RX_FREQUENCY_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="so-rx-dur">Duración</Label>
              <Input
                id="so-rx-dur"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="Ej: 3 días, 7 días"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="so-rx-qty">Cantidad *</Label>
              <Input
                id="so-rx-qty"
                type="number"
                min={0}
                value={quantity}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setQuantity(0);
                    return;
                  }
                  const v = Number(raw);
                  setQuantity(Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
                }}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="so-rx-inst">Instrucciones</Label>
              <textarea
                id="so-rx-inst"
                className={textareaClass}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Observaciones (opcional)"
                rows={4}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-between gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={!picked || !Number.isFinite(quantity) || quantity < 0}
          >
            Agregar
          </Button>
        </div>
      </div>
    </div>
  );
}
