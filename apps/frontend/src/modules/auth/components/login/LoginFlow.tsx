import { useState } from 'react';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { authRepository } from '../../repository/auth.api-repository';
import type { AuthType } from '../../types/auth.types';
import type { LoginStep } from '../../types/auth.types';
import { StepChangePassword } from './StepChangePassword';
import { StepIdentify } from './StepIdentify';
import { StepPasswordAD } from './StepPasswordAD';
import { StepPasswordLocal } from './StepPasswordLocal';
import { StepRecover } from './StepRecover';
import { StepRecoverSuccess } from './StepRecoverSuccess';
import { StepRegister } from './StepRegister';
import { StepRegisterSuccess } from './StepRegisterSuccess';
import { StepPasswordUpdated } from './StepPasswordUpdated';

export function LoginFlow() {
  const navigate = useNavigate();
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>({ step: 'identify' });

  const goHome = () => {
    void router.invalidate().then(() => {
      void navigate({ to: '/dashboard' });
    });
  };

  /** Tras cambiar contraseña: cerrar sesión y volver al paso código (iniciar sesión de nuevo). */
  const returnToIdentify = () => {
    void (async () => {
      try {
        await authRepository.logout();
      } catch {
        /* cookie ya inválida o red */
      }
      await router.invalidate();
      setStep({ step: 'identify' });
    })();
  };

  const onIdentified = (p: {
    sapCode: string;
    authType: AuthType;
    workerName: string;
  }) => {
    if (p.authType === 'ad') {
      setStep({
        step: 'password-ad',
        sapCode: p.sapCode,
        workerName: p.workerName,
      });
      return;
    }
    if (p.authType === 'local') {
      setStep({
        step: 'password-local',
        sapCode: p.sapCode,
        workerName: p.workerName,
      });
      return;
    }
    setStep({
      step: 'register',
      sapCode: p.sapCode,
      workerName: p.workerName,
    });
  };

  return (
    <div
      className="w-full max-w-md animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none md:max-w-lg"
      key={JSON.stringify(step)}
    >
      {step.step === 'identify' ? (
        <StepIdentify onIdentified={onIdentified} />
      ) : null}

      {step.step === 'password-ad' ? (
        <StepPasswordAD
          sapCode={step.sapCode}
          workerName={step.workerName}
          onBack={() => setStep({ step: 'identify' })}
          onSessionOk={goHome}
          onTempPassword={(tempToken) =>
            setStep({
              step: 'change-password',
              tempToken,
              sapCode: step.sapCode,
              workerName: step.workerName,
              from: 'ad',
            })
          }
        />
      ) : null}

      {step.step === 'password-local' ? (
        <StepPasswordLocal
          sapCode={step.sapCode}
          workerName={step.workerName}
          useEmailTemporaryPassword={step.useEmailTemporaryPassword === true}
          onBack={() => setStep({ step: 'identify' })}
          onForgot={() =>
            setStep({
              step: 'recover',
              sapCode: step.sapCode,
              workerName: step.workerName,
            })
          }
          onSessionOk={goHome}
          onTempPassword={(tempToken) =>
            setStep({
              step: 'change-password',
              tempToken,
              sapCode: step.sapCode,
              workerName: step.workerName,
              from: 'local',
            })
          }
        />
      ) : null}

      {step.step === 'register' ? (
        <StepRegister
          sapCode={step.sapCode}
          workerName={step.workerName}
          onBack={() => setStep({ step: 'identify' })}
          onSuccess={(maskedEmail) =>
            setStep({
              step: 'register-success',
              maskedEmail,
              sapCode: step.sapCode,
              workerName: step.workerName,
            })
          }
        />
      ) : null}

      {step.step === 'register-success' ? (
        <StepRegisterSuccess
          maskedEmail={step.maskedEmail}
          onBack={() =>
            setStep({
              step: 'register',
              sapCode: step.sapCode,
              workerName: step.workerName,
            })
          }
          onContinue={() =>
            setStep({
              step: 'password-local',
              sapCode: step.sapCode,
              workerName: step.workerName,
              useEmailTemporaryPassword: true,
            })
          }
        />
      ) : null}

      {step.step === 'recover' ? (
        <StepRecover
          sapCode={step.sapCode}
          workerName={step.workerName}
          onBack={() =>
            setStep({
              step: 'password-local',
              sapCode: step.sapCode,
              workerName: step.workerName,
            })
          }
          onSuccess={(maskedEmail) =>
            setStep({
              step: 'recover-success',
              maskedEmail,
              sapCode: step.sapCode,
              workerName: step.workerName,
            })
          }
        />
      ) : null}

      {step.step === 'recover-success' ? (
        <StepRecoverSuccess
          maskedEmail={step.maskedEmail}
          onBack={() =>
            setStep({
              step: 'recover',
              sapCode: step.sapCode,
              workerName: step.workerName,
            })
          }
          onContinue={() =>
            setStep({
              step: 'password-local',
              sapCode: step.sapCode,
              workerName: step.workerName,
              useEmailTemporaryPassword: true,
            })
          }
        />
      ) : null}

      {step.step === 'change-password' ? (
        <StepChangePassword
          tempToken={step.tempToken}
          onBack={() =>
            setStep(
              step.from === 'ad'
                ? {
                    step: 'password-ad',
                    sapCode: step.sapCode,
                    workerName: step.workerName,
                  }
                : {
                    step: 'password-local',
                    sapCode: step.sapCode,
                    workerName: step.workerName,
                    useEmailTemporaryPassword: true,
                  },
            )
          }
          onDone={() =>
            setStep({
              step: 'password-updated',
              sapCode: step.sapCode,
              workerName: step.workerName,
            })
          }
        />
      ) : null}

      {step.step === 'password-updated' ? (
        <StepPasswordUpdated
          workerName={step.workerName}
          onContinue={returnToIdentify}
        />
      ) : null}
    </div>
  );
}
