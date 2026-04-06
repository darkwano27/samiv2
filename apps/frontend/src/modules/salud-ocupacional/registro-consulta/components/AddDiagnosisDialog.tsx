import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { readApiMessage } from '../repository/so-consultations.api-repository';
import { useSoCreateDiagnosis } from '../hooks/use-so-registro-mutations';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
};

export function AddDiagnosisDialog({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const m = useSoCreateDiagnosis();

  if (!open) return null;

  function submit() {
    setError(null);
    const n = name.trim();
    if (!n) {
      setError('El nombre es obligatorio.');
      return;
    }
    m.mutate(
      { name: n, code: code.trim() || undefined },
      {
        onSuccess: (row) => {
          setName('');
          setCode('');
          onCreated(row.id);
          onClose();
        },
        onError: async (e) => {
          setError((await readApiMessage(e)) ?? 'No se pudo crear el diagnóstico.');
        },
      },
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="presentation"
      onClick={() => !m.isPending && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="so-add-dx-title"
        className="w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="so-add-dx-title" className="font-heading text-lg font-semibold">
          Nuevo diagnóstico
        </h2>
        <div className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="so-dx-name">Nombre</Label>
            <Input
              id="so-dx-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={m.isPending}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="so-dx-code">Código CIE-10 (opcional)</Label>
            <Input
              id="so-dx-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={m.isPending}
              autoComplete="off"
            />
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
