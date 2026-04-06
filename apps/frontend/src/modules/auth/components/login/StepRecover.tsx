import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthCard } from '../shared/AuthCard';
import { BackButton } from '../shared/BackButton';
import { useRecover } from '../../hooks/use-recover';

type Props = {
  sapCode: string;
  workerName: string;
  onBack: () => void;
  onSuccess: (maskedEmail: string) => void;
};

export function StepRecover({
  sapCode,
  workerName,
  onBack,
  onSuccess,
}: Props) {
  const [dni, setDni] = useState('');
  const rec = useRecover();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (dni.length !== 8) return;
    rec.mutate(
      { sapCode, dni },
      {
        onSuccess: (data) => onSuccess(data.maskedEmail),
      },
    );
  };

  return (
    <AuthCard
      title="Recuperar contraseña"
      subtitle={`${workerName} — confirma tu DNI para enviarte una clave temporal.`}
      belowHeader={<BackButton onBack={onBack} />}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="dni-rec">DNI</Label>
          <Input
            id="dni-rec"
            inputMode="numeric"
            maxLength={8}
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
            aria-invalid={rec.isError}
          />
        </div>
        {rec.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {rec.error instanceof Error ? rec.error.message : 'No se pudo recuperar'}
          </p>
        ) : null}
        <Button
          type="submit"
          variant="login"
          size="touch"
          className="w-full"
          disabled={rec.isPending || dni.length !== 8}
        >
          {rec.isPending ? 'Enviando…' : 'Enviar clave temporal'}
        </Button>
      </form>
    </AuthCard>
  );
}
