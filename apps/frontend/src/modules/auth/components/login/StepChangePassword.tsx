import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AuthCard } from '../shared/AuthCard';
import { BackButton } from '../shared/BackButton';
import { PasswordInput } from '../shared/PasswordInput';
import { PasswordRequirements } from '../shared/PasswordRequirements';
import { useChangePassword } from '../../hooks/use-change-password';

type Props = {
  tempToken: string;
  onBack: () => void;
  onDone: () => void;
};

export function StepChangePassword({ tempToken, onBack, onDone }: Props) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const ch = useChangePassword(tempToken);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    ch.mutate(
      { newPassword: a, confirmPassword: b },
      { onSuccess: () => onDone() },
    );
  };

  return (
    <AuthCard
      title="Actualizar contraseña"
      subtitle="Define tu nueva contraseña permanente."
      belowHeader={<BackButton onBack={onBack} />}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <PasswordInput
          label="Nueva contraseña"
          value={a}
          onChange={setA}
          autoComplete="new-password"
          disabled={ch.isPending}
        />
        <PasswordRequirements />
        <PasswordInput
          label="Confirmar nueva contraseña"
          value={b}
          onChange={setB}
          autoComplete="new-password"
          disabled={ch.isPending}
        />
        {ch.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {ch.error instanceof Error ? ch.error.message : 'Error al cambiar contraseña'}
          </p>
        ) : null}
        <Button type="submit" variant="login" size="touch" className="w-full" disabled={ch.isPending}>
          {ch.isPending ? 'Guardando…' : 'Actualizar'}
        </Button>
      </form>
    </AuthCard>
  );
}
