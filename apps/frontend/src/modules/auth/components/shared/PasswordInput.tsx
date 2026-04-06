import { useId, useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Props = {
  id?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  disabled?: boolean;
  className?: string;
};

export function PasswordInput({
  id: idProp,
  label,
  value,
  onChange,
  autoComplete = 'current-password',
  disabled,
  className,
}: Props) {
  const genId = useId();
  const id = idProp ?? genId;
  const [show, setShow] = useState(false);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Lock
          className="pointer-events-none absolute left-3 top-1/2 size-[1.125rem] -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
          className="h-11 min-h-11 pr-11 pl-10"
        />
        <button
          type="button"
          className={cn(
            'absolute right-1 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors',
            'hover:bg-muted hover:text-foreground',
            'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
          )}
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {show ? <EyeOff className="size-[1.125rem]" /> : <Eye className="size-[1.125rem]" />}
        </button>
      </div>
    </div>
  );
}
