import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  subtitle?: ReactNode;
  /**
   * Retroceso: arriba del título (patrón habitual en flujos por pasos).
   * En variant success queda esquina superior izquierda junto al ícono centrado.
   */
  belowHeader?: ReactNode;
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'success';
};

/**
 * Contenedor de pasos de login: header con divisor; cuerpo sin flecha suelta a mitad de tarjeta.
 */
export function AuthCard({
  title,
  subtitle,
  belowHeader,
  children,
  className,
  variant = 'default',
}: Props) {
  const success = variant === 'success';
  return (
    <Card
      className={cn(
        'w-full max-w-md rounded-xl border-border bg-card/95 shadow-lg ring-1 ring-black/[0.06] backdrop-blur-sm supports-[backdrop-filter]:bg-card/[0.97] md:bg-card md:backdrop-blur-none',
        '[&_input]:border-border/90 [&_input]:bg-muted/50',
        className,
      )}
    >
      <CardHeader
        className={cn(
          'relative space-y-0 border-b border-border/80 pb-4',
          success ? 'pt-2' : 'pt-1',
        )}
      >
        {success && belowHeader ? (
          <div className="absolute top-2 left-3 z-10 md:left-4">{belowHeader}</div>
        ) : null}
        {!success && belowHeader ? (
          <div className="mb-3 flex justify-start">{belowHeader}</div>
        ) : null}
        {success ? (
          <div
            className={cn(
              'mb-3 flex justify-center',
              belowHeader && 'mt-5',
            )}
          >
            <CheckCircle2
              className="size-14 text-primary"
              strokeWidth={1.75}
              aria-hidden
            />
          </div>
        ) : null}
        <CardTitle
          className={cn(
            'text-lg font-semibold tracking-tight text-foreground',
            success ? 'text-center' : 'text-left',
          )}
        >
          {title}
        </CardTitle>
        {subtitle ? (
          <CardDescription
            className={cn(
              'pt-1.5 text-muted-foreground',
              success ? 'text-center' : 'text-left',
            )}
          >
            {subtitle}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}
