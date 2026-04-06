export type AuthType = 'ad' | 'local' | 'new-local';

export type IdentifyResult = {
  found: boolean;
  authType?: AuthType;
  workerName?: string;
  message?: string;
};

export type LoginResult = {
  requiresPasswordChange: boolean;
  token?: string;
  tempToken?: string;
};

export type RegisterResult = {
  maskedEmail: string;
  message: string;
};

export type RecoverResult = RegisterResult;

export type LoginStep =
  | { step: 'identify' }
  | { step: 'password-ad'; sapCode: string; workerName: string }
  | {
      step: 'password-local';
      sapCode: string;
      workerName: string;
      /** Tras registro/recuperación (correo con clave temporal) o al volver desde cambio de clave. */
      useEmailTemporaryPassword?: boolean;
    }
  | { step: 'register'; sapCode: string; workerName: string }
  | { step: 'register-success'; maskedEmail: string; sapCode: string; workerName: string }
  | { step: 'recover'; sapCode: string; workerName: string }
  | { step: 'recover-success'; maskedEmail: string; sapCode: string; workerName: string }
  | {
      step: 'change-password';
      tempToken: string;
      sapCode: string;
      workerName: string;
      from: 'ad' | 'local';
    }
  | { step: 'password-updated'; sapCode: string; workerName: string };
