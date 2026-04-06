import { Button } from '@/components/ui/button';
import { AuthCard } from '../shared/AuthCard';
import { BackButton } from '../shared/BackButton';

type Props = {
  maskedEmail: string;
  onContinue: () => void;
  onBack: () => void;
};

export function StepRecoverSuccess({ maskedEmail, onContinue, onBack }: Props) {
  return (
    <AuthCard
      variant="success"
      title="¡Contraseña enviada!"
      subtitle={
        <>
          Enviamos una contraseña temporal a:{' '}
          <strong className="font-semibold text-foreground">{maskedEmail}</strong>
        </>
      }
      belowHeader={<BackButton onBack={onBack} />}
    >
      <Button type="button" variant="login" size="touch" className="w-full" onClick={onContinue}>
        Continuar
      </Button>
    </AuthCard>
  );
}
