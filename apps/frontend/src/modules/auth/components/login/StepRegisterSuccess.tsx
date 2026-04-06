import { Button } from '@/components/ui/button';
import { AuthCard } from '../shared/AuthCard';
import { BackButton } from '../shared/BackButton';

type Props = {
  maskedEmail: string;
  onContinue: () => void;
  onBack: () => void;
};

export function StepRegisterSuccess({ maskedEmail, onContinue, onBack }: Props) {
  return (
    <AuthCard
      variant="success"
      title="¡Contraseña enviada!"
      subtitle={
        <>
          Hemos enviado una contraseña temporal a tu correo personal. Duración de la contraseña: 48 horas.{' '}
          <strong className="font-semibold text-foreground">{maskedEmail}</strong>
        </>
      }
      belowHeader={<BackButton onBack={onBack} />}
    >
      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
        Revisa tu bandeja y cuando tengas la contraseña temporal, continúa para cambiar la contraseña temporal por una permanente.
      </p>
      <Button type="button" variant="login" size="touch" className="w-full" onClick={onContinue}>
        Continuar
      </Button>
    </AuthCard>
  );
}
