import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  SO_MEDICINE_ADMIN_ROUTES,
  SO_MEDICINE_INVENTORY_UNITS,
  SO_MEDICINE_PRESENTATIONS,
} from '../types/so-medicine-form.constants';
import { readApiMessage } from '../repository/so-consultations.api-repository';
import { useSoCreateMedicine } from '../hooks/use-so-registro-mutations';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
};

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';

export function AddMedicineDialog({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [concentration, setConcentration] = useState('');
  const [presentation, setPresentation] = useState<string>(SO_MEDICINE_PRESENTATIONS[0]);
  const [administrationRoute, setAdministrationRoute] = useState<string>(
    SO_MEDICINE_ADMIN_ROUTES[0],
  );
  const [inventoryUnit, setInventoryUnit] = useState<string>(SO_MEDICINE_INVENTORY_UNITS[0]);
  const [error, setError] = useState<string | null>(null);
  const m = useSoCreateMedicine();

  if (!open) return null;

  function submit() {
    setError(null);
    const n = name.trim();
    const c = concentration.trim();
    if (!n || !c) {
      setError('Nombre y concentración son obligatorios.');
      return;
    }
    m.mutate(
      {
        name: n,
        concentration: c,
        presentation: presentation as (typeof SO_MEDICINE_PRESENTATIONS)[number],
        administrationRoute: administrationRoute as (typeof SO_MEDICINE_ADMIN_ROUTES)[number],
        inventoryUnit: inventoryUnit as (typeof SO_MEDICINE_INVENTORY_UNITS)[number],
      },
      {
        onSuccess: (row) => {
          setName('');
          setConcentration('');
          onCreated(row.id);
          onClose();
        },
        onError: async (e) => {
          setError((await readApiMessage(e)) ?? 'No se pudo crear el medicamento.');
        },
      },
    );
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex min-h-[100dvh] items-center justify-center bg-black/45 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      role="presentation"
      onClick={() => !m.isPending && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="so-add-med-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-background p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="so-add-med-title" className="font-heading text-lg font-semibold">
          Nuevo medicamento (catálogo)
        </h2>
        <div className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="so-med-name">Nombre</Label>
            <Input
              id="so-med-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={m.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="so-med-pres">Presentación</Label>
            <select
              id="so-med-pres"
              className={selectClass}
              value={presentation}
              onChange={(e) => setPresentation(e.target.value)}
              disabled={m.isPending}
            >
              {SO_MEDICINE_PRESENTATIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="so-med-conc">Concentración</Label>
            <Input
              id="so-med-conc"
              value={concentration}
              onChange={(e) => setConcentration(e.target.value)}
              disabled={m.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="so-med-route">Vía de administración</Label>
            <select
              id="so-med-route"
              className={selectClass}
              value={administrationRoute}
              onChange={(e) => setAdministrationRoute(e.target.value)}
              disabled={m.isPending}
            >
              {SO_MEDICINE_ADMIN_ROUTES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="so-med-unit">Unidad de inventario</Label>
            <select
              id="so-med-unit"
              className={selectClass}
              value={inventoryUnit}
              onChange={(e) => setInventoryUnit(e.target.value)}
              disabled={m.isPending}
            >
              {SO_MEDICINE_INVENTORY_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={m.isPending} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={m.isPending} onClick={() => void submit()}>
            {m.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
