import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  onBack: () => void;
  label?: string;
  /** Arriba del título: área táctil más compacta. */
  variant?: 'default' | 'compact';
};

export function BackButton({ onBack, label = 'Atrás', variant = 'compact' }: Props) {
  const compact = variant === 'compact';
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        'gap-0.5 px-2 text-foreground hover:bg-muted/80 hover:text-foreground',
        compact
          ? 'h-9 min-h-9 w-9 shrink-0 p-0'
          : '-ml-2 h-11 min-h-11',
      )}
      onClick={onBack}
    >
      <ChevronLeft className="size-5 shrink-0" aria-hidden />
      <span className="sr-only">{label}</span>
    </Button>
  );
}
