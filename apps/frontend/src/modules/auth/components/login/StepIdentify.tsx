import { useState } from 'react';
import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthCard } from '../shared/AuthCard';
import { LoginIconInput } from '../shared/LoginIconInput';
import { useIdentify } from '../../hooks/use-identify';
import type { AuthType } from '../../types/auth.types';

type Props = {
  onIdentified: (p: {
    sapCode: string;
    authType: AuthType;
    workerName: string;
  }) => void;
};

/**
 * Paso 1 (spec): solo código SAP → POST identify → siguiente paso según auth_type.
 */
export function StepIdentify({ onIdentified }: Props) {
  const [sap, setSap] = useState('');
  const [notFoundMessage, setNotFoundMessage] = useState<string | null>(null);
  const identify = useIdentify();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = sap.trim();
    if (!code) return;
    setNotFoundMessage(null);
    identify.mutate(code, {
      onSuccess: (data) => {
        if (data.found && data.authType && data.workerName) {
          onIdentified({
            sapCode: code,
            authType: data.authType,
            workerName: data.workerName,
          });
          return;
        }
        setNotFoundMessage(
          data.message ?? 'Código no registrado o no disponible para acceso.',
        );
      },
    });
  };

  return (
    <AuthCard
      title="Iniciar sesión"
      subtitle="Ingresa tu código de trabajador."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <LoginIconInput
          id="sap"
          label="Código de trabajador"
          icon={User}
          value={sap}
          onChange={(v) => {
            setNotFoundMessage(null);
            setSap(v.replace(/\D/g, ''));
          }}
          placeholder="Ej: 64721"
          autoComplete="username"
          inputMode="numeric"
          disabled={identify.isPending}
          aria-invalid={identify.isError || !!notFoundMessage}
        />
        {notFoundMessage ? (
          <p className="text-sm text-destructive" role="alert">
            {notFoundMessage}
          </p>
        ) : null}
        {identify.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {identify.error instanceof Error
              ? identify.error.message
              : 'No se pudo identificar el código'}
          </p>
        ) : null}
        <Button
          type="submit"
          variant="login"
          size="touch"
          className="w-full"
          disabled={identify.isPending || !sap.trim()}
        >
          {identify.isPending ? 'Consultando…' : 'Continuar'}
        </Button>
      </form>
    </AuthCard>
  );
}
