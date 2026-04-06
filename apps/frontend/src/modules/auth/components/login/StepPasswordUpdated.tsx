import { Button } from '@/components/ui/button';
import { AuthCard } from '../shared/AuthCard';

type Props = {
  workerName: string;
  onContinue: () => void;
};

export function StepPasswordUpdated({ workerName, onContinue }: Props) {
  return (
    <AuthCard
      variant="success"
      title="¡Contraseña actualizada!"
      subtitle={`${workerName}, tu nueva contraseña se guardó correctamente. Vuelvé a iniciar sesión con tu código de trabajador y la contraseña que acabás de definir.`}
    >
      <Button type="button" variant="login" size="touch" className="w-full" onClick={onContinue}>
        Iniciar sesión
      </Button>
    </AuthCard>
  );
}
