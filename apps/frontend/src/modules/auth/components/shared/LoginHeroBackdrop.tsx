import { LazyBackground } from '@/shared/ui/lazy-background';
import { cn } from '@/lib/utils';
import { LOGIN_HERO_SRC, LOGIN_HERO_WEBP_SRC } from '../../constants/login-assets';

type Props = {
  className?: string;
};

/**
 * Foto corporativa con desenfoque fuerte + velos teal/oscuro (aspecto “pro”).
 * Color sólido primero, imagen WebP/JPEG con fade-in (mejor LCP / sin flash blanco).
 */
export function LoginHeroBackdrop({ className }: Props) {
  return (
    <LazyBackground
      className={cn('pointer-events-none overflow-hidden', className)}
      src={LOGIN_HERO_SRC}
      webpSrc={LOGIN_HERO_WEBP_SRC}
      fallbackColor="#0d3d2e"
      imageClassName="absolute left-1/2 top-1/2 min-h-[115%] min-w-[115%] -translate-x-1/2 -translate-y-1/2 scale-105 object-cover object-center"
      overlay={
        <>
          <div className="absolute inset-0 bg-[#21A795]/45" />
          <div className="absolute inset-0 bg-slate-950/25" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/10 via-transparent to-slate-950/35 md:bg-gradient-to-br" />
        </>
      }
    />
  );
}
