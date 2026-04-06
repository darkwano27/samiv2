import { PenLine } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (pngBase64: string) => void;
  /** Firma ya guardada (al reabrir se muestra en el lienzo). */
  initialDataUrl?: string | null;
  /** Título del diálogo (p. ej. “Firma del paciente” / “Firma del trabajador”). */
  title?: string;
  /** Texto de ayuda bajo el título. */
  subtitle?: string;
};

const W = 450;
const H = 200;

const DEFAULT_TITLE = 'Firma';
const DEFAULT_SUBTITLE = 'Firmá en el recuadro con el mouse o el dedo.';

export function SignaturePadModal({
  open,
  onClose,
  onConfirm,
  initialDataUrl = null,
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUBTITLE,
}: Props) {
  const headingId = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const clearCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    setHasInk(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const paintBlank = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      setHasInk(false);
    };

    if (initialDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(img, 0, 0, W, H);
        setHasInk(true);
      };
      img.onerror = () => {
        paintBlank();
      };
      img.src = initialDataUrl;
    } else {
      paintBlank();
    }
  }, [open, initialDataUrl]);

  function pos(e: React.MouseEvent | React.TouchEvent) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const scaleX = c.width / r.width;
    const scaleY = c.height / r.height;
    if ('touches' in e && e.touches[0]) {
      return {
        x: (e.touches[0].clientX - r.left) * scaleX,
        y: (e.touches[0].clientY - r.top) * scaleY,
      };
    }
    const me = e as React.MouseEvent;
    return {
      x: (me.clientX - r.left) * scaleX,
      y: (me.clientY - r.top) * scaleY,
    };
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  }

  function end() {
    drawing.current = false;
  }

  if (!open) return null;

  function confirm() {
    const c = canvasRef.current;
    if (!c || !hasInk) return;
    const data = c.toDataURL('image/png');
    onConfirm(data);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/45 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-labelledby={headingId}
        aria-modal="true"
        className="w-full max-w-lg rounded-xl border border-border bg-background p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <PenLine className="h-5 w-5 text-primary" aria-hidden />
          <h2 id={headingId} className="font-heading text-lg font-semibold">
            {title}
          </h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="mt-4 w-full max-w-full touch-none cursor-crosshair rounded-md border border-dashed border-muted-foreground/40 bg-white"
          onMouseDown={start}
          onMouseMove={draw}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={draw}
          onTouchEnd={end}
        />
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={clearCanvas}>
            Limpiar
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirm} disabled={!hasInk}>
            Guardar firma
          </Button>
        </div>
      </div>
    </div>
  );
}
