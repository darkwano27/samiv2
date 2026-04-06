import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthCard } from '../shared/AuthCard';
import { BackButton } from '../shared/BackButton';
import { useRegister } from '../../hooks/use-register';

type Props = {
  sapCode: string;
  workerName: string;
  onBack: () => void;
  onSuccess: (maskedEmail: string) => void;
};

export function StepRegister({
  sapCode,
  workerName,
  onBack,
  onSuccess,
}: Props) {
  const [dni, setDni] = useState('');
  const reg = useRegister();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (dni.length !== 8) return;
    reg.mutate(
      { sapCode, dni },
      {
        onSuccess: (data) => onSuccess(data.maskedEmail),
      },
    );
  };

  return (
    <AuthCard
      title="Primer acceso"
      subtitle={`${workerName} — verifica tu identidad con tu DNI (8 dígitos).`}
      belowHeader={<BackButton onBack={onBack} />}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="dni">DNI</Label>
          <Input
            id="dni"
            inputMode="numeric"
            maxLength={8}
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="12345678"
            aria-invalid={reg.isError}
          />
        </div>
        {reg.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {reg.error instanceof Error ? reg.error.message : 'Error en el registro'}
          </p>
        ) : null}
        <Button
          type="submit"
          variant="login"
          size="touch"
          className="w-full"
          disabled={reg.isPending || dni.length !== 8}
        >
          {reg.isPending ? 'Enviando…' : 'Registrar y enviar clave'}
        </Button>
      </form>
    </AuthCard>
  );
}
