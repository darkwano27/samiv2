import { cn } from '@/lib/utils';
import { LOGIN_ARIS_LOGO_SRC } from '../../constants/login-assets';

type Props = {
  variant: 'mobile' | 'desktop-panel';
  className?: string;
};

/**
 * Marca en panel izquierdo (desktop) o cabecera sobre el fondo (móvil), alineado a la plantilla ARIS / SAMI.
 */
export function LoginMarketingBlock({ variant, className }: Props) {
  if (variant === 'mobile') {
    return (
      <div
        className={cn(
          'flex flex-col items-center text-center text-white',
          className,
        )}
      >
        <img
          src={LOGIN_ARIS_LOGO_SRC}
          alt="ARIS"
          className="h-12 w-auto max-w-[min(100%,240px)] object-contain"
          width={220}
          height={52}
        />
        <h1 className="mt-4 font-heading text-[1.75rem] font-bold tracking-[0.12em]">
          SAMI
        </h1>
        <p className="mt-2 max-w-[19rem] text-[0.8125rem] font-medium leading-snug text-white/88">
          Sistema Administrativo Modular Integrado
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex max-w-lg flex-col text-white lg:max-w-md',
        className,
      )}
    >
      <img
        src={LOGIN_ARIS_LOGO_SRC}
        alt="ARIS"
        className="h-14 w-auto max-w-[min(100%,260px)] object-contain lg:h-16"
        width={260}
        height={56}
      />
      <p className="mt-8 text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-white/80">
        ARIS Industrial
      </p>
      <h2 className="mt-3 font-heading text-2xl font-bold leading-tight tracking-tight lg:text-[1.65rem] lg:leading-snug">
        Sistema Administrativo Modular Integrado
      </h2>
      <p className="mt-5 text-sm leading-relaxed text-white/78">
        Plataforma corporativa para gestionar procesos, datos y equipos en un solo entorno
        seguro, alineado a los estándares de tu organización.
      </p>
    </div>
  );
}
