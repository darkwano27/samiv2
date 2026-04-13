import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { buildPasteCodePreview } from '../utils/parse-pasted-sap-codes';

export interface PasteFromExcelModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (sapCodes: string[]) => void;
  existingCodes?: string[];
}

export function PasteFromExcelModal({
  open,
  onClose,
  onConfirm,
  existingCodes = [],
}: PasteFromExcelModalProps) {
  const [value, setValue] = useState('');
  const [debouncedValue, setDebouncedValue] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) {
      setValue('');
      setDebouncedValue('');
      return;
    }
    const t = window.setTimeout(() => taRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedValue(value), 300);
    return () => window.clearTimeout(t);
  }, [value]);

  const preview = useMemo(
    () => buildPasteCodePreview(debouncedValue, existingCodes),
    [debouncedValue, existingCodes],
  );

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text/plain');
    const el = e.currentTarget;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const merged = value.slice(0, start) + paste + value.slice(end);
    setValue(merged);
    setDebouncedValue(merged);
    queueMicrotask(() => {
      const pos = start + paste.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const showPreview = debouncedValue.trim().length > 0;

  if (!open) return null;

  const n = preview.codesToAdd.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-center sm:p-4"
      role="presentation"
      onClick={() => onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paste-excel-title"
        className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-background p-4 shadow-lg sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="paste-excel-title" className="font-heading text-lg font-semibold">
          Pegar desde Excel
        </h2>

        <div className="mt-3">
          <Textarea
            ref={taRef}
            rows={6}
            className="min-h-[140px] w-full resize-y text-sm"
            placeholder="Pegá aquí los códigos SAP (Ctrl+V)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onPaste={handlePaste}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {showPreview ? (
          <div className="mt-3 space-y-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
            <p className="text-muted-foreground">
              {preview.detectedValidShapeCount} códigos detectados
              {n > 0 ? (
                <span className="text-foreground">
                  {' '}
                  · se agregarán {n} nuevo{n === 1 ? '' : 's'}
                </span>
              ) : null}
            </p>
            <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
              {preview.items.map((it, idx) => (
                <li
                  key={`${it.raw}-${it.normalized ?? 'x'}-${idx}`}
                  className={
                    it.status === 'invalid'
                      ? 'text-destructive'
                      : it.status === 'dup_table' || it.status === 'dup_paste'
                        ? 'bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100'
                        : ''
                  }
                >
                  <span className="font-mono">{it.normalized ?? it.raw}</span>
                  {it.status === 'invalid' ? (
                    <span className="ml-2 text-destructive">inválido</span>
                  ) : null}
                  {it.status === 'dup_table' ? (
                    <span className="ml-2">ya existe</span>
                  ) : null}
                  {it.status === 'dup_paste' ? (
                    <span className="ml-2">duplicado en el pegado</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={n === 0}
            onClick={() => {
              onConfirm(preview.codesToAdd);
              setValue('');
              setDebouncedValue('');
              onClose();
            }}
          >
            Agregar {n} colaborador{n === 1 ? '' : 'es'}
          </Button>
        </div>

        <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
          En Excel, seleccioná las celdas de la columna Código SAP → Ctrl+C → volvé acá y Ctrl+V
        </p>
      </div>
    </div>
  );
}
