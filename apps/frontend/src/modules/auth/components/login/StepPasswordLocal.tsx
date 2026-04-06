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
  onForgot: () => void;
  onSessionOk: () => void;
  onTempPassword: (tempToken: string) => void;
  /**
   * Tras enviar clave por correo: el usuario aún no tiene contraseña permanente SAMI.
   * No mostramos "olvidé" y aclaramos que debe usar la temporal del mail.
   */
  useEmailTemporaryPassword?: boolean;
};

export function StepPasswordLocal({
  sapCode,
  workerName,
  onBack,
  onForgot,
  onSessionOk,
  onTempPassword,
  useEmailTemporaryPassword = false,
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

  const title = useEmailTemporaryPassword
    ? 'Ingresa tu contraseña temporal'
    : 'Ingresa tu contraseña';

  const subtitle = useEmailTemporaryPassword
    ? `Hola, ${workerName}. Copiá aquí la contraseña temporal del correo que te enviamos. Es tu primer ingreso, después definirás una contraseña permanente.`
    : `Hola, ${workerName}. Ingresa tu contraseña SAMI.`;

  return (
    <AuthCard title={title} subtitle={subtitle} belowHeader={<BackButton onBack={onBack} />}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <PasswordInput
          label={useEmailTemporaryPassword ? 'Contraseña temporal' : 'Contraseña'}
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
        {!useEmailTemporaryPassword ? (
          <div className="text-center">
            <Button
              type="button"
              variant="link"
              className="h-auto min-h-11 px-2 text-sm font-medium text-primary"
              onClick={onForgot}
            >
              ¿Olvidaste tu contraseña?
            </Button>
          </div>
        ) : null}
      </form>
    </AuthCard>
  );
}
