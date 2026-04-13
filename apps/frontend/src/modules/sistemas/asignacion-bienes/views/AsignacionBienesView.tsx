import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  Laptop,
  Mail,
  PenLine,
  RefreshCw,
  Search,
  Share2,
  Upload,
  UserPlus,
  UserX,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { getRouteApi } from '@tanstack/react-router';
import { canDo } from '@/infrastructure/auth/permissions';
import { fetchMeSignature } from '@/modules/auth/repository/user-signature.api-repository';
import { SignaturePadModal } from '@/shared/components/SignaturePadModal';
import { useIsMdUp } from '@/shared/hooks/use-is-md-up';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  abAssetColHelper,
  abReadonlyAssetColumnDefs,
  AssetDescripcionBlock,
  formatDisplayDate,
} from '@/modules/sistemas/shared/ab-asset-columns';
import {
  abFetchAssets,
  abFetchGlpiUser,
  abFetchSapSearch,
  abFetchSapWorkerOrg,
  abPostActaEmail,
  abPostActaPdf,
  abPostActaSharepoint,
  readAbApiMessage,
  type AbActaBienesBody,
  type AbAssetRow,
  type AbSapWorkerHit,
} from '../repository/asignacion-bienes.api-repository';

/** Misma referencia cuando aún no hay `items`: evita bucles infinitos en TanStack Table (ver issue #4566). */
const EMPTY_ASSET_ROWS: AbAssetRow[] = [];

/** Valor para `input type="date"` en calendario local (no UTC). */
function localDateInputValue(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const MESES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

/** `YYYY-MM-DD` → `5 de abril, 2026` (zona local implícita en el valor elegido). */
function formatActaDateLabel(ymd: string): string {
  const [ys, ms, ds] = ymd.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!y || !m || !d || m < 1 || m > 12) return ymd;
  return `${d} de ${MESES_ES[m - 1]}, ${y}`;
}

/** Evita re-render del árbol al escribir: input no controlado + ref (para reporte / futuro guardado). */
function ComentarioInputField({
  assetId,
  remountKey,
  commentsRef,
  className,
}: {
  assetId: number;
  remountKey: string;
  commentsRef: MutableRefObject<Record<number, string>>;
  className?: string;
}) {
  return (
    <Input
      key={`${remountKey}-${assetId}`}
      aria-label={`Comentario activo ${assetId}`}
      className={cn('h-11 min-h-11 text-sm touch-manipulation', className)}
      defaultValue=""
      placeholder="Nota para el acta (opcional)"
      onChange={(e) => {
        commentsRef.current[assetId] = e.target.value;
      }}
    />
  );
}

/** Panel fijo encima del teclado virtual (iOS/Android). */
function useVisualViewportSheetInsets(active: boolean) {
  const [insets, setInsets] = useState({ bottom: 8, maxHeight: 320 });
  useEffect(() => {
    if (!active) return;
    const update = () => {
      const vv = window.visualViewport;
      if (vv) {
        const visibleBottomY = vv.offsetTop + vv.height;
        const fromLayoutBottom = Math.max(8, window.innerHeight - visibleBottomY + 8);
        setInsets({
          bottom: fromLayoutBottom,
          maxHeight: Math.min(Math.round(vv.height * 0.52), 400),
        });
      } else {
        setInsets({ bottom: 8, maxHeight: 320 });
      }
    };
    update();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [active]);
  return insets;
}

function sapSearchEnabledForQ(q: string): boolean {
  if (q.length === 0) return false;
  if (/^\d+$/.test(q)) return q.length >= 1;
  return q.length >= 2;
}

const ACTA_PHOTO_MAX_EDGE = 1920;
const ACTA_PHOTO_JPEG_QUALITY = 0.82;
/** Mismo límite que `asignacion-bienes-acta.schema.ts` en el backend. */
const ACTA_PHOTO_MAX_COUNT = 20;

/** Cámara en móvil suele dejar `type` vacío o `application/octet-stream`; hay que intentar decodificar igual. */
function blobMayBeImage(blob: Blob): boolean {
  const t = (blob.type || '').trim().toLowerCase();
  if (t === '' || t === 'application/octet-stream') return true;
  return t.startsWith('image/');
}

/**
 * Copia los bytes a `File` nuevos antes de vaciar el input.
 * Si vaciás `input.value` en el mismo tick que un trabajo async con `e.target.files`,
 * Safari/iOS (y a veces Android) invalidan el `FileList` y `preparePhotoForActaBlob` lee 0 bytes.
 */
async function cloneFilesFromFileList(list: FileList): Promise<File[]> {
  return Promise.all(
    Array.from(list).map(async (f) => {
      const buf = await f.arrayBuffer();
      const type = (f.type || 'image/jpeg').trim() || 'image/jpeg';
      return new File([buf], f.name?.trim() || 'foto.jpg', {
        type,
        lastModified: f.lastModified,
      });
    }),
  );
}

function loadHtmlImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error('No se pudo cargar la imagen.'));
    };
    img.src = objUrl;
  });
}

/** Base64 crudo para JPEG/PNG/WebP (sin recomprimir). */
async function blobToPhotoPartRawFromBlob(
  blob: Blob,
): Promise<{ mime: 'image/jpeg' | 'image/png' | 'image/webp'; base64: string } | null> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('No se pudo leer la foto.'));
    r.readAsDataURL(blob);
  });
  const comma = dataUrl.indexOf(',');
  const header = comma >= 0 ? dataUrl.slice(0, comma) : '';
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const m = /^data:([^;,]+)/i.exec(header);
  let mimeRaw = (m?.[1] ?? blob.type ?? '').trim().toLowerCase();
  if (mimeRaw.includes(';')) mimeRaw = mimeRaw.split(';')[0].trim();
  if (mimeRaw === '' || mimeRaw === 'application/octet-stream') mimeRaw = 'image/jpeg';
  if (mimeRaw !== 'image/jpeg' && mimeRaw !== 'image/png' && mimeRaw !== 'image/webp') {
    return null;
  }
  if (!base64) return null;
  return { mime: mimeRaw, base64 };
}

/** iOS a veces devuelve data URL vacío con toDataURL; toBlob suele funcionar mejor. */
async function canvasToJpegBase64(canvas: HTMLCanvasElement): Promise<string | null> {
  const dataUrl = canvas.toDataURL('image/jpeg', ACTA_PHOTO_JPEG_QUALITY);
  const comma = dataUrl.indexOf(',');
  const fromData = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  if (fromData && fromData.length > 200) return fromData;

  return new Promise((resolve) => {
    canvas.toBlob(
      (out) => {
        if (!out) {
          resolve(null);
          return;
        }
        const r = new FileReader();
        r.onload = () => {
          const d = r.result as string;
          const i = d.indexOf(',');
          resolve(i >= 0 ? d.slice(i + 1) : null);
        };
        r.onerror = () => resolve(null);
        r.readAsDataURL(out);
      },
      'image/jpeg',
      ACTA_PHOTO_JPEG_QUALITY,
    );
  });
}

async function tryCompressPhotoToJpeg(blob: Blob): Promise<{ mime: 'image/jpeg'; base64: string } | null> {
  let src: ImageBitmap | HTMLImageElement;
  let closeBmp: (() => void) | null = null;
  try {
    src = await createImageBitmap(blob);
    closeBmp = () => (src as ImageBitmap).close();
  } catch {
    src = await loadHtmlImageFromBlob(blob);
  }

  const w0 = src instanceof ImageBitmap ? src.width : src.naturalWidth;
  const h0 = src instanceof ImageBitmap ? src.height : src.naturalHeight;
  if (w0 < 1 || h0 < 1) {
    closeBmp?.();
    return null;
  }

  let outW = w0;
  let outH = h0;
  const maxEdge = ACTA_PHOTO_MAX_EDGE;
  if (outW > maxEdge || outH > maxEdge) {
    const s = maxEdge / Math.max(outW, outH);
    outW = Math.round(outW * s);
    outH = Math.round(outH * s);
  }

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    closeBmp?.();
    return null;
  }
  ctx.drawImage(src, 0, 0, outW, outH);
  closeBmp?.();

  const base64 = await canvasToJpegBase64(canvas);
  if (!base64) return null;
  return { mime: 'image/jpeg', base64 };
}

/** HEIC / formatos raros: solo <img> + decode() + canvas (sin createImageBitmap). */
async function tryJpegFromImageDecodeOnly(blob: Blob): Promise<{ mime: 'image/jpeg'; base64: string } | null> {
  try {
    const img = await loadHtmlImageFromBlob(blob);
    if (typeof img.decode === 'function') {
      await img.decode();
    }
    const w0 = img.naturalWidth;
    const h0 = img.naturalHeight;
    if (w0 < 1 || h0 < 1) return null;
    let outW = w0;
    let outH = h0;
    const maxEdge = ACTA_PHOTO_MAX_EDGE;
    if (outW > maxEdge || outH > maxEdge) {
      const s = maxEdge / Math.max(outW, outH);
      outW = Math.round(outW * s);
      outH = Math.round(outH * s);
    }
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, outW, outH);
    const base64 = await canvasToJpegBase64(canvas);
    if (!base64) return null;
    return { mime: 'image/jpeg', base64 };
  } catch {
    return null;
  }
}

/**
 * Usa el `File`/`Blob` directo (evita fetch(blob:) en Safari iOS).
 * HEIC: si el raw MIME no pasa Zod, igual intentamos JPEG por canvas.
 */
async function preparePhotoForActaBlob(
  blob: Blob,
): Promise<{ mime: 'image/jpeg' | 'image/png' | 'image/webp'; base64: string } | null> {
  if (!blobMayBeImage(blob)) return null;

  try {
    const compressed = await tryCompressPhotoToJpeg(blob);
    if (compressed?.base64 && compressed.base64.length > 200) return compressed;
  } catch {
    /* seguir */
  }

  const raw = await blobToPhotoPartRawFromBlob(blob);
  if (raw) return raw;

  const decoded = await tryJpegFromImageDecodeOnly(blob);
  return decoded?.base64 && decoded.base64.length > 200 ? decoded : null;
}

const THUMB_DISPLAY_MAX = 200;

/** Miniatura JPEG en data URL (se ve bien en móvil); si falla, blob: para el <img>. */
async function fileToThumbnailPreviewUrl(file: File): Promise<string> {
  const blob = file;
  try {
    let src: ImageBitmap | HTMLImageElement;
    let closeBmp: (() => void) | null = null;
    try {
      src = await createImageBitmap(blob);
      closeBmp = () => (src as ImageBitmap).close();
    } catch {
      src = await loadHtmlImageFromBlob(blob);
      if (typeof (src as HTMLImageElement).decode === 'function') {
        await (src as HTMLImageElement).decode();
      }
    }
    const w0 = src instanceof ImageBitmap ? src.width : src.naturalWidth;
    const h0 = src instanceof ImageBitmap ? src.height : src.naturalHeight;
    if (w0 < 1 || h0 < 1) {
      closeBmp?.();
      return URL.createObjectURL(file);
    }
    let outW = w0;
    let outH = h0;
    if (outW > THUMB_DISPLAY_MAX || outH > THUMB_DISPLAY_MAX) {
      const s = THUMB_DISPLAY_MAX / Math.max(outW, outH);
      outW = Math.round(outW * s);
      outH = Math.round(outH * s);
    }
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      closeBmp?.();
      return URL.createObjectURL(file);
    }
    ctx.drawImage(src as CanvasImageSource, 0, 0, outW, outH);
    closeBmp?.();
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    if (dataUrl.length > 300) return dataUrl;
  } catch {
    /* blob URL abajo */
  }
  return URL.createObjectURL(file);
}

function revokePhotoPreviewUrl(previewUrl: string) {
  if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
}

type ReportKind = 'entrega' | 'devolucion';

export function AsignacionBienesView() {
  const queryClient = useQueryClient();
  const { session } = getRouteApi('/_authenticated').useRouteContext();
  const canOperarCreate = canDo(session, 'asignacion-bienes', 'operar', 'create');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [lookupOpen, setLookupOpen] = useState(false);
  const [selectedSap, setSelectedSap] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const commentsRef = useRef<Record<number, string>>({});
  const [sorting, setSorting] = useState<SortingState>([{ id: 'fecha_asignacion', desc: true }]);
  const [pageError, setPageError] = useState<string | null>(null);
  /** Correo destino del PDF: default desde SAP (corporativo → personal); editable. */
  const [reportRecipientEmail, setReportRecipientEmail] = useState('');
  const [reportKind, setReportKind] = useState<ReportKind>('entrega');
  const [reportActDate, setReportActDate] = useState(() => localDateInputValue());
  const [additionalSignerHit, setAdditionalSignerHit] = useState<AbSapWorkerHit | null>(null);
  const [addSignerInput, setAddSignerInput] = useState('');
  const [addSignerDebouncedQ, setAddSignerDebouncedQ] = useState('');
  const [addSignerOpen, setAddSignerOpen] = useState(false);
  const [reportPhotos, setReportPhotos] = useState<
    { id: string; fileName: string; previewUrl: string; file: File }[]
  >([]);
  const [workerSignatureDataUrl, setWorkerSignatureDataUrl] = useState<string | null>(null);
  const [sigModalOpen, setSigModalOpen] = useState(false);
  const [distributeModalOpen, setDistributeModalOpen] = useState(false);
  const [distributeBusy, setDistributeBusy] = useState<'email' | 'sharepoint' | 'download' | null>(
    null,
  );
  const [distributeFeedback, setDistributeFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [generarActaError, setGenerarActaError] = useState<string | null>(null);
  const lookupBlurTimeoutRef = useRef<number | null>(null);
  const addSignerBlurTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(searchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const t = window.setTimeout(() => setAddSignerDebouncedQ(addSignerInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [addSignerInput]);

  useEffect(() => {
    setReportActDate(localDateInputValue());
    setReportKind('entrega');
    setAdditionalSignerHit(null);
    setAddSignerInput('');
    setAddSignerDebouncedQ('');
    setAddSignerOpen(false);
    setWorkerSignatureDataUrl(null);
    setSigModalOpen(false);
    setDistributeModalOpen(false);
    setGenerarActaError(null);
    setReportPhotos((prev) => {
      prev.forEach((p) => revokePhotoPreviewUrl(p.previewUrl));
      return [];
    });
  }, [selectedSap]);

  const sapSearchEnabled = sapSearchEnabledForQ(debouncedQ);

  const sapQ = useQuery({
    queryKey: ['sistemas', 'asignacion-bienes', 'sap-search', debouncedQ],
    queryFn: () => abFetchSapSearch(debouncedQ),
    enabled: sapSearchEnabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const addSignerSapEnabled = sapSearchEnabledForQ(addSignerDebouncedQ);
  const sapAddSignerQ = useQuery({
    queryKey: ['sistemas', 'asignacion-bienes', 'sap-search-signer', addSignerDebouncedQ],
    queryFn: () => abFetchSapSearch(addSignerDebouncedQ),
    enabled: addSignerSapEnabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const glpiUserQ = useQuery({
    queryKey: ['sistemas', 'asignacion-bienes', 'glpi-user', selectedSap ?? ''],
    queryFn: () => abFetchGlpiUser(selectedSap!),
    enabled: Boolean(selectedSap),
  });

  const sapOrgQ = useQuery({
    queryKey: ['sistemas', 'asignacion-bienes', 'sap-org', selectedSap ?? ''],
    queryFn: () => abFetchSapWorkerOrg(selectedSap!),
    enabled: Boolean(selectedSap),
    staleTime: 60_000,
  });

  const assetsQ = useQuery({
    queryKey: ['sistemas', 'asignacion-bienes', 'assets', selectedSap ?? ''],
    queryFn: () => abFetchAssets(selectedSap!),
    enabled: Boolean(selectedSap),
  });

  useLayoutEffect(() => {
    commentsRef.current = {};
  }, [selectedSap]);

  useEffect(() => {
    if (!assetsQ.isError) {
      setPageError(null);
      return;
    }
    const err = assetsQ.error;
    if (err == null) {
      setPageError('No se pudieron cargar los activos.');
      return;
    }
    let cancelled = false;
    void (async () => {
      const msg = (await readAbApiMessage(err)) ?? 'No se pudieron cargar los activos.';
      if (!cancelled) setPageError(msg);
    })();
    return () => {
      cancelled = true;
    };
    // `error` suele cambiar de referencia en cada render; `errorUpdatedAt` es estable por fallo.
  }, [assetsQ.isError, assetsQ.errorUpdatedAt]);

  const isMdUp = useIsMdUp();

  const columns = useMemo(
    () => [
      ...abReadonlyAssetColumnDefs(),
      ...(canOperarCreate
        ? [
            abAssetColHelper.display({
              id: 'comentario',
              header: 'Comentario',
              cell: ({ row }) => (
                <ComentarioInputField
                  assetId={row.original.id}
                  remountKey={selectedSap ?? ''}
                  commentsRef={commentsRef}
                  className="min-w-0 w-full max-w-[min(100%,16rem)]"
                />
              ),
            }),
          ]
        : []),
    ],
    [selectedSap, canOperarCreate],
  );

  const tableData = useMemo(
    () => assetsQ.data?.items ?? EMPTY_ASSET_ROWS,
    [assetsQ.data?.items],
  );

  const table = useReactTable({
    data: tableData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const cancelLookupBlurClose = useCallback(() => {
    const id = lookupBlurTimeoutRef.current;
    if (id != null) window.clearTimeout(id);
    lookupBlurTimeoutRef.current = null;
  }, []);

  const scheduleLookupClose = useCallback(() => {
    cancelLookupBlurClose();
    lookupBlurTimeoutRef.current = window.setTimeout(() => {
      lookupBlurTimeoutRef.current = null;
      setLookupOpen(false);
    }, 200);
  }, [cancelLookupBlurClose]);

  useEffect(() => () => cancelLookupBlurClose(), [cancelLookupBlurClose]);

  const cancelAddSignerBlurClose = useCallback(() => {
    const id = addSignerBlurTimeoutRef.current;
    if (id != null) window.clearTimeout(id);
    addSignerBlurTimeoutRef.current = null;
  }, []);

  const scheduleAddSignerClose = useCallback(() => {
    cancelAddSignerBlurClose();
    addSignerBlurTimeoutRef.current = window.setTimeout(() => {
      addSignerBlurTimeoutRef.current = null;
      setAddSignerOpen(false);
    }, 200);
  }, [cancelAddSignerBlurClose]);

  useEffect(() => () => cancelAddSignerBlurClose(), [cancelAddSignerBlurClose]);

  function removeReportPhoto(index: number) {
    setReportPhotos((prev) => {
      const p = prev[index];
      if (p) revokePhotoPreviewUrl(p.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function appendReportPhotosFromFiles(files: File[]) {
    if (!files.length) return;
    void (async () => {
      const items = await Promise.all(
        files.map(async (f) => ({
          id:
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `ph-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          fileName: f.name?.trim() || 'foto.jpg',
          previewUrl: await fileToThumbnailPreviewUrl(f),
          file: f,
        })),
      );
      setReportPhotos((prev) => {
        const room = Math.max(0, ACTA_PHOTO_MAX_COUNT - prev.length);
        const next = items.slice(0, room);
        if (next.length < items.length) {
          window.alert(
            `El acta admite como máximo ${ACTA_PHOTO_MAX_COUNT} fotos. Se agregaron ${next.length} y se omitieron el resto.`,
          );
        }
        return [...prev, ...next];
      });
    })();
  }

  function cancelActaDraft() {
    setWorkerSignatureDataUrl(null);
    setSigModalOpen(false);
    setReportPhotos((prev) => {
      prev.forEach((p) => revokePhotoPreviewUrl(p.previewUrl));
      return [];
    });
    setAdditionalSignerHit(null);
    setAddSignerInput('');
    setAddSignerDebouncedQ('');
    setReportKind('entrega');
    setReportActDate(localDateInputValue());
    setDistributeModalOpen(false);
    setDistributeBusy(null);
    setDistributeFeedback(null);
    setGenerarActaError(null);
  }

  function refreshAssets() {
    if (!selectedSap) return;
    void queryClient.invalidateQueries({
      queryKey: ['sistemas', 'asignacion-bienes', 'assets', selectedSap],
    });
  }

  function selectWorker(hit: AbSapWorkerHit) {
    cancelLookupBlurClose();
    setSelectedSap(hit.sap_code);
    setSelectedName(hit.name);
    setSearchInput(hit.sap_code);
    setReportRecipientEmail(hit.suggested_email?.trim() ?? '');
    setLookupOpen(false);
    setPageError(null);
  }

  function clearWorker() {
    setSelectedSap(null);
    setSelectedName(null);
    setSearchInput('');
    setReportRecipientEmail('');
    setWorkerSignatureDataUrl(null);
    setDistributeModalOpen(false);
    setDistributeBusy(null);
    setDistributeFeedback(null);
    setGenerarActaError(null);
    commentsRef.current = {};
    setPageError(null);
  }

  const glpiLinked = glpiUserQ.data != null;
  const glpiLabel =
    glpiUserQ.data?.realname?.trim() ||
    [glpiUserQ.data?.firstname, glpiUserQ.data?.name].filter(Boolean).join(' ').trim() ||
    (glpiUserQ.data ? `ID ${glpiUserQ.data.id}` : null);

  const hasAssetsForActa = tableData.length > 0;
  const meSigQ = useQuery({
    queryKey: ['auth', 'me-signature'],
    queryFn: fetchMeSignature,
    enabled: Boolean(selectedSap && hasAssetsForActa && glpiLinked && canOperarCreate),
    staleTime: 120_000,
  });

  const collectActaBody = useCallback(async (): Promise<AbActaBienesBody> => {
    if (!selectedSap) {
      throw new Error('Faltan datos obligatorios del acta.');
    }
    const photos: AbActaBienesBody['photos'] = [];
    for (const p of reportPhotos) {
      const part = await preparePhotoForActaBlob(p.file);
      if (part) photos.push(part);
    }
    return {
      report_kind: reportKind,
      act_date: reportActDate,
      worker_sap: selectedSap,
      worker_name: selectedName ?? '',
      glpi_user_label: glpiLabel ?? null,
      oracle_user:
        sapOrgQ.data != null
          ? {
              subdivision: sapOrgQ.data.subdivision,
              division: sapOrgQ.data.division,
              cargo: sapOrgQ.data.cargo,
              jefe: sapOrgQ.data.jefe,
              jefe_nombre: sapOrgQ.data.jefe_nombre,
            }
          : null,
      glpi_registration_number: glpiUserQ.data?.registration_number ?? null,
      glpi_firstname: glpiUserQ.data?.firstname ?? null,
      glpi_realname: glpiUserQ.data?.realname ?? null,
      technician_name: session.workerName?.trim() || null,
      technician_signature_png_base64: meSigQ.data?.effective_data_url ?? null,
      additional_signer: additionalSignerHit
        ? { sap_code: additionalSignerHit.sap_code, name: additionalSignerHit.name }
        : null,
      signature_png_base64: workerSignatureDataUrl ?? '',
      assets: tableData.map((a) => ({
        id: a.id,
        name: a.name,
        serial: a.serial,
        categoria: a.categoria,
        tipo: a.tipo,
        marca: a.marca,
        modelo: a.modelo,
        fecha_asignacion: a.fecha_asignacion,
        comentario: commentsRef.current[a.id]?.trim() ?? '',
      })),
      photos,
    };
  }, [
    selectedSap,
    workerSignatureDataUrl,
    reportPhotos,
    reportKind,
    reportActDate,
    selectedName,
    glpiLabel,
    glpiUserQ.data,
    sapOrgQ.data,
    additionalSignerHit,
    tableData,
    session.workerName,
    meSigQ.data?.effective_data_url,
  ]);

  function onGenerarActa() {
    setGenerarActaError(null);
    setDistributeFeedback(null);
    setDistributeModalOpen(true);
  }

  const handleDownloadPdf = useCallback(async () => {
    setDistributeFeedback(null);
    setDistributeBusy('download');
    try {
      const body = await collectActaBody();
      const { pdf_base64, file_name } = await abPostActaPdf(body);
      const bytes = Uint8Array.from(atob(pdf_base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file_name;
      a.click();
      URL.revokeObjectURL(url);
      setDistributeFeedback({ type: 'ok', text: 'Se descargó el PDF.' });
    } catch (e) {
      setDistributeFeedback({
        type: 'err',
        text: (await readAbApiMessage(e)) ?? 'No se pudo generar el PDF.',
      });
    } finally {
      setDistributeBusy(null);
    }
  }, [collectActaBody]);

  const handleEmailPdf = useCallback(async () => {
    const to = reportRecipientEmail.trim();
    if (!to) {
      setDistributeFeedback({
        type: 'err',
        text: 'Completá el correo en el paso 3 antes de enviar.',
      });
      return;
    }
    if (!window.confirm(`¿Enviar el PDF a ${to}?`)) return;
    setDistributeFeedback(null);
    setDistributeBusy('email');
    try {
      const body = await collectActaBody();
      await abPostActaEmail({ ...body, to });
      setDistributeFeedback({ type: 'ok', text: 'Correo enviado.' });
    } catch (e) {
      setDistributeFeedback({
        type: 'err',
        text:
          (await readAbApiMessage(e)) ??
          'No se pudo enviar. Revisá el correo SMTP del módulo Sistemas (Ajustes).',
      });
    } finally {
      setDistributeBusy(null);
    }
  }, [collectActaBody, reportRecipientEmail]);

  const handleSharepointUpload = useCallback(async () => {
    if (!window.confirm('¿Subir el acta a la carpeta compartida de la empresa?')) return;
    setDistributeFeedback(null);
    setDistributeBusy('sharepoint');
    try {
      const body = await collectActaBody();
      const { webUrl } = await abPostActaSharepoint(body);
      setDistributeFeedback({
        type: 'ok',
        text: `Archivo subido. Podés abrirlo desde: ${webUrl}`,
      });
    } catch (e) {
      setDistributeFeedback({
        type: 'err',
        text: (await readAbApiMessage(e)) ?? 'No se pudo subir a la carpeta compartida.',
      });
    } finally {
      setDistributeBusy(null);
    }
  }, [collectActaBody]);

  const assetRows = table.getRowModel().rows;
  const hasAssets = tableData.length > 0;

  const qLive = searchInput.trim();
  const debouncePending = qLive !== debouncedQ;
  const showSapLookupPanel = !selectedSap && lookupOpen && qLive.length > 0;
  const mobileSapLookupSheetOpen = showSapLookupPanel && !isMdUp;
  const sapLookupSheetInsets = useVisualViewportSheetInsets(mobileSapLookupSheetOpen);

  useEffect(() => {
    if (!mobileSapLookupSheetOpen) return;
    const id = requestAnimationFrame(() => {
      document.getElementById('ab-search')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [mobileSapLookupSheetOpen]);

  function renderSapLookupListBody() {
    if (!sapSearchEnabledForQ(qLive)) {
      return (
        <li className="px-3 py-2 text-muted-foreground">
          {/^\d+$/.test(qLive)
            ? 'Escribí al menos un número del código SAP.'
            : 'Escribí al menos dos letras del apellido.'}
        </li>
      );
    }
    if (debouncePending) {
      return <li className="px-3 py-2 text-muted-foreground">Un momento…</li>;
    }
    if (sapQ.isFetching) {
      return <li className="px-3 py-2 text-muted-foreground">Buscando…</li>;
    }
    if (sapQ.isError) {
      return (
        <li className="px-3 py-2 text-xs text-destructive">
          Ahora no pudimos buscar en la lista de personas. Probá de nuevo en un rato.
        </li>
      );
    }
    if (!sapQ.isSuccess) {
      return <li className="px-3 py-2 text-muted-foreground">Buscando…</li>;
    }
    if ((sapQ.data?.results?.length ?? 0) === 0) {
      return <li className="px-3 py-2 text-muted-foreground">No encontramos coincidencias.</li>;
    }
    return (
      <>
        {(sapQ.data?.results ?? []).map((s) => (
          <li key={s.sap_code} role="option">
            <button
              type="button"
              className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-base hover:bg-muted active:bg-muted sm:py-2 sm:text-sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectWorker(s)}
            >
              <span className="font-medium">{s.name}</span>
              <span className="text-xs text-muted-foreground">SAP {s.sap_code}</span>
            </button>
          </li>
        ))}
      </>
    );
  }

  const reportKindLabel = reportKind === 'entrega' ? 'Entrega de bienes' : 'Devolución de bienes';
  const pdfSuggestedName = `${selectedSap ?? 'acta'}_${reportActDate}.pdf`;
  const showActaActions = Boolean(selectedSap && hasAssets && glpiLinked && canOperarCreate);

  return (
    <div
      className={cn(
        'mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4 p-3 sm:gap-6 sm:p-4 md:p-6',
        showActaActions ? 'pb-28 sm:pb-32' : 'pb-8',
      )}
    >
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Laptop className="h-7 w-7 text-primary" aria-hidden />
          <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
            Asignación de bienes
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Busca la persona por su codigo SAP o por el apellido.
        </p>
      </header>

      <Card className="overflow-visible">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">1. ¿Quién es la persona?</CardTitle>
          <CardDescription>
            Escribí el código SAP o varias letras del apellido. Si buscás por nombre, usá al menos dos
            letras.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 overflow-visible">
          <div className="relative z-10 max-w-xl space-y-2">
            <Label htmlFor="ab-search">Código SAP o apellido</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="ab-search"
                className="min-h-11 pl-9"
                autoComplete="off"
                enterKeyHint="search"
                inputMode="search"
                placeholder="Ej. 63139 o apellido"
                value={searchInput}
                disabled={Boolean(selectedSap)}
                onChange={(e) => setSearchInput(e.target.value)}
                onFocus={() => {
                  if (!selectedSap) {
                    cancelLookupBlurClose();
                    setLookupOpen(true);
                  }
                }}
                onBlur={scheduleLookupClose}
              />
            </div>
            {showSapLookupPanel && isMdUp ? (
              <ul
                className="absolute z-20 mt-1 max-h-52 w-full max-w-xl overflow-auto rounded-md border border-border bg-popover py-1 text-sm shadow-md"
                role="listbox"
              >
                {renderSapLookupListBody()}
              </ul>
            ) : null}
          </div>

          {selectedSap ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{selectedName ?? selectedSap}</p>
                <p className="text-xs text-muted-foreground">SAP {selectedSap}</p>
                {glpiUserQ.isLoading ? (
                  <p className="mt-1 text-xs text-muted-foreground">Buscando sus equipos en el inventario…</p>
                ) : glpiLinked ? (
                  <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">
                    Equipos encontrados para: {glpiLabel}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                    No encontramos a esta persona en el inventario de equipos con ese código. No podemos
                    mostrar la lista.
                  </p>
                )}
              </div>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={clearWorker}>
                <UserX className="h-4 w-4" aria-hidden />
                Elegir otra persona
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {mobileSapLookupSheetOpen && typeof document !== 'undefined'
        ? createPortal(
            <>
              <div
                className="fixed inset-0 z-[100] touch-none bg-black/40"
                aria-hidden
                onPointerDown={(e) => {
                  e.preventDefault();
                  cancelLookupBlurClose();
                  document.getElementById('ab-search')?.blur();
                  setLookupOpen(false);
                }}
              />
              <div
                className="fixed left-2 right-2 z-[101] flex flex-col overflow-hidden rounded-xl border border-border bg-popover pb-[env(safe-area-inset-bottom,0px)] shadow-2xl"
                style={{
                  bottom: sapLookupSheetInsets.bottom,
                  maxHeight: sapLookupSheetInsets.maxHeight,
                }}
              >
                <p className="shrink-0 border-b border-border px-3 py-2 text-sm font-semibold text-foreground">
                  Elegí una persona
                </p>
                <ul
                  className="min-h-0 flex-1 list-none overflow-y-auto overscroll-y-contain py-1"
                  role="listbox"
                  aria-label="Personas encontradas"
                >
                  {renderSapLookupListBody()}
                </ul>
              </div>
            </>,
            document.body,
          )
        : null}

      {selectedSap ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-base">2. Equipos que tiene</CardTitle>
                <CardDescription>
                  Lista de equipos
                </CardDescription>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {glpiLinked && !assetsQ.isLoading ? (
                  <span className="text-sm text-muted-foreground">
                    ({tableData.length} {tableData.length === 1 ? 'bien' : 'bienes'})
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-10 gap-1.5 touch-manipulation"
                  disabled={!glpiLinked || assetsQ.isFetching}
                  onClick={() => refreshAssets()}
                >
                  <RefreshCw
                    className={cn('h-4 w-4', assetsQ.isFetching && 'animate-spin')}
                    aria-hidden
                  />
                  Actualizar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {pageError ? (
              <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {pageError}
              </p>
            ) : null}
            {assetsQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando la lista de equipos…</p>
            ) : tableData.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Esta persona no tiene equipos cargados a su nombre en el inventario.
              </p>
            ) : isMdUp ? (
              <div className="md:-mx-1 md:max-w-full md:overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                  <thead>
                    {table.getHeaderGroups().map((hg) => (
                      <tr
                        key={hg.id}
                        className="border-b border-border text-xs uppercase text-muted-foreground"
                      >
                        {hg.headers.map((h) => (
                          <th key={h.id} className="px-2 py-2 font-medium sm:px-3">
                            {h.isPlaceholder ? null : (
                              <button
                                type="button"
                                className={cn(
                                  'inline-flex min-h-10 touch-manipulation items-center gap-1 rounded-md px-1 py-1',
                                  h.column.getCanSort() &&
                                    'cursor-pointer select-none hover:text-foreground',
                                )}
                                onClick={h.column.getToggleSortingHandler()}
                              >
                                {flexRender(h.column.columnDef.header, h.getContext())}
                                {h.column.getIsSorted() === 'asc'
                                  ? ' ↑'
                                  : h.column.getIsSorted() === 'desc'
                                    ? ' ↓'
                                    : null}
                              </button>
                            )}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {assetRows.map((row) => (
                      <tr key={row.id} className="border-b border-border/80">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-2 py-3 align-top sm:px-3">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-3">
                {assetRows.map((row) => {
                  const a = row.original;
                  return (
                    <Card key={row.id} className="border-border/80 shadow-none">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Fecha asignación
                          </span>
                          <span className="tabular-nums text-sm">
                            {formatDisplayDate(a.fecha_asignacion)}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Categoría
                          </p>
                          <p className="mt-0.5 break-words text-sm font-medium">
                            {a.categoria ?? '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Descripción
                          </p>
                          <div className="mt-1">
                            <AssetDescripcionBlock row={a} />
                          </div>
                        </div>
                        {canOperarCreate ? (
                          <div className="space-y-1.5">
                            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                              Comentario
                            </Label>
                            <ComentarioInputField
                              assetId={a.id}
                              remountKey={selectedSap ?? ''}
                              commentsRef={commentsRef}
                              className="w-full"
                            />
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {selectedSap && hasAssets && glpiLinked && !canOperarCreate ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Tu rol permite solo consultar la lista de equipos. Para generar actas necesitás permiso de
          operación (crear) en Asignación de bienes.
        </p>
      ) : null}

      {selectedSap && hasAssets && glpiLinked && canOperarCreate ? (
        <>
          <Card className="relative z-10 overflow-visible border-primary/20 bg-primary/[0.03] dark:bg-primary/10">
            <CardHeader className="pb-2">
              <div className="flex gap-2">
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                <div>
                  <CardTitle className="text-base">3. Datos del acta</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 overflow-visible border-t border-border/60 pt-4 text-sm">
              <div className="space-y-2">
                <Label htmlFor="ab-report-kind">¿Entrega o devolución?</Label>
                <select
                  id="ab-report-kind"
                  className="flex h-11 min-h-11 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 md:text-sm touch-manipulation"
                  value={reportKind}
                  onChange={(e) => setReportKind(e.target.value as ReportKind)}
                >
                  <option value="entrega">Entrega de bienes</option>
                  <option value="devolucion">Devolución de bienes</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ab-report-date">Fecha del trámite</Label>
                <Input
                  id="ab-report-date"
                  type="date"
                  className="min-h-11 max-w-xs touch-manipulation"
                  value={reportActDate}
                  onChange={(e) => setReportActDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ab-report-email">Correo para enviar el documento</Label>
                <Input
                  id="ab-report-email"
                  type="email"
                  autoComplete="email"
                  className="min-h-11 max-w-xl"
                  placeholder="ejemplo@empresa.com"
                  value={reportRecipientEmail}
                  onChange={(e) => setReportRecipientEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Si ya tenemos un correo de la empresa para esa persona, lo sugerimos acá; si no, el
                  personal. Podés cambiarlo cuando quieras.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <Label
                    htmlFor="ab-add-signer-search"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    ¿Firma otra persona por él o ella? (opcional)
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Por ejemplo el jefe o quien firme en representación. En el PDF se verá el nombre de
                  la persona y, entre paréntesis, quien firmó por ella.
                </p>
                {additionalSignerHit ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
                    <span className="text-sm">
                      {additionalSignerHit.name}{' '}
                      <span className="text-muted-foreground">SAP {additionalSignerHit.sap_code}</span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="min-h-9"
                      onClick={() => {
                        setAdditionalSignerHit(null);
                        setAddSignerInput('');
                        setAddSignerDebouncedQ('');
                      }}
                    >
                      Sacar
                    </Button>
                  </div>
                ) : (
                  <div className="relative z-10 max-w-xl space-y-1">
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                      />
                      <Input
                        id="ab-add-signer-search"
                        className="min-h-11 pl-9"
                        autoComplete="off"
                        placeholder="Nombre o SAP de quien firma…"
                        value={addSignerInput}
                        onChange={(e) => setAddSignerInput(e.target.value)}
                        onFocus={() => {
                          cancelAddSignerBlurClose();
                          setAddSignerOpen(true);
                        }}
                        onBlur={scheduleAddSignerClose}
                      />
                    </div>
                    {addSignerOpen && addSignerInput.trim().length > 0 ? (
                      <ul
                        className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-popover py-1 text-sm shadow-md"
                        role="listbox"
                      >
                        {!sapSearchEnabledForQ(addSignerInput.trim()) ? (
                          <li className="px-3 py-2 text-muted-foreground">
                            {/^\d+$/.test(addSignerInput.trim())
                              ? 'Escribí al menos un número del SAP.'
                              : 'Escribí al menos dos letras del apellido.'}
                          </li>
                        ) : addSignerInput.trim() !== addSignerDebouncedQ ? (
                          <li className="px-3 py-2 text-muted-foreground">Un momento…</li>
                        ) : sapAddSignerQ.isFetching ? (
                          <li className="px-3 py-2 text-muted-foreground">Buscando…</li>
                        ) : sapAddSignerQ.isError ? (
                          <li className="px-3 py-2 text-xs text-destructive">
                            No pudimos buscar ahora. Probá otra vez en un rato.
                          </li>
                        ) : sapAddSignerQ.isSuccess ? (
                          (sapAddSignerQ.data?.results?.length ?? 0) === 0 ? (
                            <li className="px-3 py-2 text-muted-foreground">Nadie coincide con esa búsqueda.</li>
                          ) : (
                            (sapAddSignerQ.data?.results ?? []).map((s) => (
                              <li key={`signer-${s.sap_code}`} role="option">
                                <button
                                  type="button"
                                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-muted"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    if (s.sap_code === selectedSap) return;
                                    cancelAddSignerBlurClose();
                                    setAdditionalSignerHit(s);
                                    setAddSignerInput('');
                                    setAddSignerDebouncedQ('');
                                    setAddSignerOpen(false);
                                  }}
                                >
                                  <span className="font-medium">{s.name}</span>
                                  <span className="text-xs text-muted-foreground">SAP {s.sap_code}</span>
                                </button>
                              </li>
                            ))
                          )
                        ) : (
                          <li className="px-3 py-2 text-muted-foreground">Buscando…</li>
                        )}
                      </ul>
                    ) : null}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">4. Firma (opcional)</CardTitle>
              <CardDescription>
                Si querés, firmá quien recibe o entrega. El acta se puede generar y enviar sin firma.
              </CardDescription>
            </CardHeader>
            <CardContent className="border-t border-border/60 pt-4">
              <button
                type="button"
                onClick={() => setSigModalOpen(true)}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/35 py-10 text-center transition-colors hover:border-primary/40 hover:bg-muted/20 touch-manipulation"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-300">
                  <PenLine className="h-6 w-6" aria-hidden />
                </div>
                <span className="font-medium text-sky-900 dark:text-sky-100">
                  {workerSignatureDataUrl
                    ? 'Firma lista — tocá para cambiarla'
                    : 'Tocá para firmar (opcional)'}
                </span>
                <span className="text-xs text-muted-foreground">
                  Con el dedo o el mouse; podés dejarlo vacío.
                </span>
              </button>
            </CardContent>
          </Card>

          <Card className="overflow-visible">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">5. Fotos de los equipos</CardTitle>
              <CardDescription>
                Podés usar la cámara o elegir archivos; solo van en el PDF del acta. Máximo{' '}
                {ACTA_PHOTO_MAX_COUNT} fotos. En el celular, si la pestaña se recarga al sacar la foto,
                suele ser por memoria del navegador: probá una foto a la vez o cerrar otras apps.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 border-t border-border/60 pt-4">
              <input
                id="ab-acta-camera"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
                capture="environment"
                className="sr-only"
                tabIndex={-1}
                onChange={async (e) => {
                  const el = e.target;
                  const list = el.files;
                  if (!list?.length) return;
                  try {
                    const stable = await cloneFilesFromFileList(list);
                    appendReportPhotosFromFiles(stable);
                  } catch {
                    window.alert(
                      'No se pudo leer la foto (memoria o permisos). Probá de nuevo o con otra imagen.',
                    );
                  } finally {
                    el.value = '';
                  }
                }}
              />
              <input
                id="ab-acta-gallery"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                tabIndex={-1}
                onChange={async (e) => {
                  const el = e.target;
                  const list = el.files;
                  if (!list?.length) return;
                  try {
                    const stable = await cloneFilesFromFileList(list);
                    appendReportPhotosFromFiles(stable);
                  } catch {
                    window.alert(
                      'No se pudieron leer las imágenes. Probá de nuevo o con otros archivos.',
                    );
                  } finally {
                    el.value = '';
                  }
                }}
              />
              <div className="grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
                <label
                  htmlFor="ab-acta-camera"
                  className="flex min-h-[5.5rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 p-4 text-center text-sm touch-manipulation hover:bg-muted/40 active:bg-muted/50"
                >
                  <Camera className="h-8 w-8 text-primary" aria-hidden />
                  <span className="font-medium">Tomar foto</span>
                  <span className="text-xs text-muted-foreground">Cámara del dispositivo</span>
                </label>
                <label
                  htmlFor="ab-acta-gallery"
                  className="flex min-h-[5.5rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 p-4 text-center text-sm touch-manipulation hover:bg-muted/40 active:bg-muted/50"
                >
                  <Upload className="h-8 w-8 text-primary" aria-hidden />
                  <span className="font-medium">Subir archivo</span>
                  <span className="text-xs text-muted-foreground">JPG, PNG, WebP</span>
                </label>
              </div>
              {reportPhotos.length > 0 ? (
                <ul className="flex flex-wrap gap-3">
                  {reportPhotos.map((p, i) => (
                    <li key={p.id} className="relative">
                      <img
                        src={p.previewUrl}
                        alt=""
                        className="h-20 w-20 min-h-[5rem] min-w-[5rem] rounded-md border border-border object-cover"
                        loading="eager"
                        decoding="async"
                      />
                      <button
                        type="button"
                        className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-xs shadow"
                        aria-label={`Quitar ${p.fileName}`}
                        onClick={() => removeReportPhoto(i)}
                      >
                        ×
                      </button>
                      <span className="mt-1 block max-w-[5rem] truncate text-[10px] text-muted-foreground">
                        {p.fileName}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}

      <SignaturePadModal
        open={sigModalOpen}
        onClose={() => setSigModalOpen(false)}
        onConfirm={(png) => setWorkerSignatureDataUrl(png)}
        initialDataUrl={workerSignatureDataUrl}
        title="Firma de la persona"
        subtitle="Firmá en el recuadro con el dedo o el mouse, igual que en un papel."
      />

      {showActaActions ? (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 px-3 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur supports-[backdrop-filter]:bg-background/90 md:sticky md:bottom-0 md:left-auto md:right-auto md:z-0 md:rounded-lg md:border md:shadow-none">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
            {generarActaError ? (
              <p className="text-sm text-destructive sm:mr-auto sm:self-center">{generarActaError}</p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full touch-manipulation sm:w-auto"
              onClick={cancelActaDraft}
            >
              Descartar y empezar de nuevo
            </Button>
            <Button
              type="button"
              className="min-h-11 w-full touch-manipulation sm:w-auto"
              onClick={onGenerarActa}
            >
              Listo, generar acta
            </Button>
          </div>
        </div>
      ) : null}

      {distributeModalOpen && selectedSap ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ab-distribute-title"
        >
          <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg">
            <button
              type="button"
              className="absolute right-3 top-3 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Cerrar"
              onClick={() => setDistributeModalOpen(false)}
            >
              ×
            </button>
            <div className="mb-4 flex justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-8 w-8" aria-hidden />
              </span>
            </div>
            <h2 id="ab-distribute-title" className="text-center text-lg font-semibold">
              El acta quedó lista
            </h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {reportKindLabel} · {selectedName ?? 'Persona seleccionada'} · SAP {selectedSap}
            </p>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Fecha del trámite: {formatActaDateLabel(reportActDate)} · Incluye {tableData.length}{' '}
              {tableData.length === 1 ? 'equipo' : 'equipos'}
            </p>

            {distributeFeedback ? (
              <p
                className={cn(
                  'mt-4 rounded-md border px-3 py-2 text-sm',
                  distributeFeedback.type === 'ok'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
                    : 'border-destructive/40 bg-destructive/10 text-destructive',
                )}
              >
                {distributeFeedback.text}
              </p>
            ) : null}

            <p className="mb-3 mt-6 text-sm font-medium text-foreground">¿Qué querés hacer ahora?</p>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  disabled={Boolean(distributeBusy)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50 touch-manipulation disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => void handleEmailPdf()}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-400">
                    <Mail className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {distributeBusy === 'email' ? 'Enviando…' : 'Mandar por correo'}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      A {reportRecipientEmail || '…'}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
              <li>
                <button
                  type="button"
                  disabled={Boolean(distributeBusy)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50 touch-manipulation disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => void handleSharepointUpload()}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                    <Share2 className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {distributeBusy === 'sharepoint' ? 'Subiendo…' : 'Guardar en la carpeta compartida'}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Requiere Microsoft 365 configurado en el servidor
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
              <li>
                <button
                  type="button"
                  disabled={Boolean(distributeBusy)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50 touch-manipulation disabled:pointer-events-none disabled:opacity-50"
                  onClick={() => void handleDownloadPdf()}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-400">
                    <Download className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {distributeBusy === 'download' ? 'Generando…' : 'Bajar el PDF'}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {pdfSuggestedName}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            </ul>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 flex-1"
                onClick={() => {
                  setDistributeModalOpen(false);
                  clearWorker();
                }}
              >
                Hacer otra acta
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 flex-1"
                onClick={() =>
                  window.alert('El historial de actas estará disponible más adelante.')
                }
              >
                Ver actas anteriores
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
