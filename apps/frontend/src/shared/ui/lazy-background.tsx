import { type ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type LazyBackgroundProps = {
  /** URL principal (p. ej. JPEG como fallback). */
  src: string;
  /** Variante WebP opcional (mejor compresión). */
  webpSrc?: string;
  /** Color visible de inmediato bajo la foto (evita flash claro). */
  fallbackColor: string;
  className?: string;
  /** Contenido encima del fondo (velos, texto). */
  children?: ReactNode;
  /** Capas decorativas bajo `children` pero sobre la imagen (p. ej. gradientes). */
  overlay?: ReactNode;
  /** Clases del `<img>` / `<picture>` (posicionamiento, object-cover, etc.). */
  imageClassName?: string;
};

/**
 * Fondo fotográfico: color sólido al instante; la imagen se solicita al entrar
 * en vista (IntersectionObserver) y hace fade-in al cargar.
 */
export function LazyBackground({
  src,
  webpSrc,
  fallbackColor,
  className,
  children,
  overlay,
  imageClassName,
}: LazyBackgroundProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setShouldLoad(true);
      },
      { rootMargin: '120px', threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <div
        className="absolute inset-0 z-0"
        style={{ backgroundColor: fallbackColor }}
        aria-hidden
      />
      {shouldLoad ? (
        <picture
          className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
          aria-hidden
        >
          {webpSrc ? <source srcSet={webpSrc} type="image/webp" /> : null}
          <img
            src={src}
            alt=""
            decoding="async"
            fetchPriority="high"
            onLoad={() => setLoaded(true)}
            className={cn(
              'transition-opacity duration-500 ease-out',
              loaded ? 'opacity-100' : 'opacity-0',
              imageClassName,
            )}
          />
        </picture>
      ) : null}
      {overlay ? (
        <div className="pointer-events-none absolute inset-0 z-[2]" aria-hidden>
          {overlay}
        </div>
      ) : null}
      {children ? <div className="relative z-[3]">{children}</div> : null}
    </div>
  );
}
