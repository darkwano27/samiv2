# Firma de usuario en perfil (SAMI)

## Objetivo

Centralizar la **firma dibujada** y/o una **imagen** (sello escaneado, firma en PNG/JPEG/WebP) por trabajador, para reutilizarla en PDFs donde el usuario actúa como **profesional / técnico** (no como paciente o titular del acta).

## Alcance actual

| Área | Comportamiento |
|------|----------------|
| **API** | `GET /api/auth/me/signature` y `PATCH /api/auth/me/signature` (cookie de sesión). |
| **UI** | Ruta **`/mi-firma`**: enlace **Mi firma** en el sidebar (junto a Inicio). |
| **Sistemas — Asignación de bienes** | Al generar el acta (PDF / correo / SharePoint), se envían `technician_name` (nombre del operador) y `technician_signature_png_base64` con la **data URL efectiva** del perfil, si existe. |
| **Salud ocupacional — Registro de consulta** | Al cargar el formulario, si hay firma en perfil, se **precarga** el campo de firma de la consulta (el usuario puede cambiarla antes de guardar). |

La firma del **paciente/trabajador** del acta o de la consulta sigue siendo independiente del perfil del operador.

## Modelo de datos

Tabla PostgreSQL **`worker_signatures`** (migración `0018_worker_signatures.sql`):

- `worker_id` (text, PK): código SAP / id de sesión (`session.sapCode`).
- `drawn_base64`: PNG en base64 **sin** prefijo `data:` (firma del pad).
- `uploaded_base64`: imagen en base64 **sin** prefijo `data:`.
- `uploaded_mime`: `image/png` \| `image/jpeg` \| `image/webp`.
- `preferred`: `drawn` \| `uploaded` — cuál usar cuando ambas existen.
- `updated_at`.

Antes del primer guardado se hace **upsert** en **`workers`** (misma fila que usa RBAC) para mantener coherencia de FK futura.

## API

### `GET /api/auth/me/signature`

Respuesta JSON:

- `worker_id`, `display_name`
- `preferred`, `has_drawn`, `has_uploaded`, `uploaded_mime`
- **`effective_data_url`**: `data:<mime>;base64,...` lista para `<img>` o para campos de PDF que aceptan data URL (p. ej. acta de bienes).

### `PATCH /api/auth/me/signature`

Body JSON (todos opcionales; se fusiona con lo guardado):

- `drawn_base64`: string \| null (acepta también string con prefijo `data:image/...;base64,`).
- `uploaded_base64`: string \| null
- `uploaded_mime`: `image/png` \| `image/jpeg` \| `image/webp` \| null
- `preferred`: `drawn` \| `uploaded` \| null

El servicio ajusta `preferred` si queda inconsistente (p. ej. preferir dibujada sin dibujo).

## Seguridad

- Solo el **usuario autenticado** puede leer/escribir **su** firma (clave = SAP de la sesión).
- Tamaño máximo por campo en validación Zod: **2_500_000** caracteres (backend `user-signature.schemas.ts`).

## Operación

1. Desplegar backend y ejecutar migraciones: `pnpm run db:migrate` en `apps/backend`.
2. Los usuarios que generen PDFs deberían cargar firma en **Mi firma** (dibujo o imagen con buen contraste; sellos en PNG transparente recomendado).

## Extensiones futuras (no implementadas)

- Exigir firma en perfil para ciertos roles antes de “cerrar” documentos.
- Redimensionar/compresión server-side de imágenes subidas.
- Historial de versiones de firma.
