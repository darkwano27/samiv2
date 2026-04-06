import type { LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
  id: string;
  label: string;
  icon: LucideIcon;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  'aria-invalid'?: boolean;
};

export function LoginIconInput({
  id,
  label,
  icon: Icon,
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
  inputMode,
  'aria-invalid': ariaInvalid,
}: Props) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon
          className="pointer-events-none absolute left-3 top-1/2 size-[1.125rem] -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={id}
          className="h-11 min-h-11 pl-10"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          inputMode={inputMode}
          aria-invalid={ariaInvalid}
        />
      </div>
    </div>
  );
}
