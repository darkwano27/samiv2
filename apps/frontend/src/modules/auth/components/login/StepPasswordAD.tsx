import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AuthCard } from '../shared/AuthCard';
import { BackButton } from '../shared/BackButton';
import { PasswordInput } from '../shared/PasswordInput';
import { useAuthLogin } from '../../hooks/use-auth';

type Props = {
  sapCode: string;
  workerName: string;
  onBack: () => void;
  onSessionOk: () => void;
  onTempPassword: (tempToken: string) => void;
};

export function StepPasswordAD({
  sapCode,
  workerName,
  onBack,
  onSessionOk,
  onTempPassword,
}: Props) {
  const [password, setPassword] = useState('');
  const login = useAuthLogin();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate(
      { sapCode, password },
      {
        onSuccess: (res) => {
          if (res.requiresPasswordChange && res.tempToken) {
            onTempPassword(res.tempToken);
            return;
          }
          if (!res.requiresPasswordChange) {
            onSessionOk();
          }
        },
      },
    );
  };

  return (
    <AuthCard
      title="Ingresa tu contraseña"
      subtitle={`Hola ${workerName} Usá la contraseña de la cuenta de correo corporativo.`}
      belowHeader={<BackButton onBack={onBack} />}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <PasswordInput
          label="Contraseña"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          disabled={login.isPending}
        />
        {login.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {login.error instanceof Error
              ? login.error.message
              : 'Credenciales incorrectas'}
          </p>
        ) : null}
        <Button
          type="submit"
          variant="login"
          size="touch"
          className="w-full"
          disabled={login.isPending}
        >
          {login.isPending ? 'Validando…' : 'Ingresar'}
        </Button>
      </form>
    </AuthCard>
  );
}
