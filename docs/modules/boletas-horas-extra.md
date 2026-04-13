# Boletas Horas Extra

Aplicación SAMI (`registro-horas-extra` en RBAC): pantalla para que un supervisor cargue **boletas de horas extra** por subdivisión asignada.

## Nombre en producto

En menú, migas y cabecera de página el texto visible es **Boletas Horas Extra**. El slug de ruta y permisos sigue siendo `registro-horas-extra` por compatibilidad con datos y seeds.

## Flujo

1. **Configuración:** fechas, división/subdivisión (códigos mostrados como `(código) nombre`, mismo color para código y nombre), y motivo **opcional** (cabecera y líneas pueden persistirse sin motivo).
2. **Colaboradores:** grilla de filas con SAP, fechas, horas, motivo por fila y observaciones. La búsqueda SAP considera solo personal **activo** en el alcance de subdivisión.

## Pegado masivo de códigos SAP (paso 2)

El botón **«Pegar desde Excel»** abre un modal (`PasteFromExcelModal`) con un **textarea**: el usuario pega con **Ctrl+V** (evento `paste` / contenido del textarea). **No** se usa `navigator.clipboard.readText()`, así el flujo funciona en HTTP y sin permiso global de portapapeles.

- **Columna:** muchas filas en Excel → una fila por código (primera columna por línea).
- **Fila horizontal:** una sola fila con varias celdas separadas por tabulador → se trata cada celda como un código.
- Normalización: se quitan puntos de miles y espacios; se aceptan códigos numéricos de **5 a 11** dígitos.
- Vista previa: inválidos en rojo, duplicados (ya en tabla o en el pegado) en amarillo; al confirmar solo se agregan códigos **nuevos** no duplicados.

Parser: `apps/frontend/src/modules/horas-extra/registro/utils/parse-pasted-sap-codes.ts`.  
Componente: `apps/frontend/src/modules/horas-extra/registro/components/PasteFromExcelModal.tsx`.

El util `registro-he-excel-paste.ts` conserva lógica TSV de tabla completa por si se reutiliza en otro flujo; el botón principal del paso 2 usa solo el modal.

## Tabla (paso 2) y TanStack Table

La grilla es **HTML `<table>`** con estado en React, no `@tanstack/react-table`. Motivos: menos dependencias, formulario tipo “hoja” con foco en pegado y resolución SAP; si en el futuro hiciera falta ordenar, filtrar o virtualizar miles de filas, se podría evaluar TanStack Table.

## Responsive

- **≥ md:** tabla ancha con `overflow-x` y desplazamiento táctil.
- **< md:** misma información en **tarjetas** apiladas (una por colaborador). El modal de pegado usa ancho completo en pantallas chicas.

## Persistencia (motivo opcional)

Migración `0022_he_boleta_motivo_nullable.sql`: columnas `motivo_code` de `he_boleta_headers` y `he_boleta_lines` permiten `NULL`.

## N° de boleta (referencial)

Migración `0023_he_boleta_display_number.sql`: columna `display_number` en `he_boleta_headers` (secuencial por entorno, visible en bandeja y en el mensaje al registrar). No reemplaza el UUID interno.

## Estados de boleta (negocio)

Solo tres estados lógicos:

1. **registrada** — creada, pendiente de aprobación.
2. **aprobada** — una vez aprobada, la **exportación es automática**; no existe un cuarto estado “exportada” en el modelo.
3. **anulada** — anulada.

Si en base hubiera valores legacy `exportada`, la UI los muestra y filtra como **aprobada**.

## Bandeja (aprobación)

- API: `GET horas-extra/aprobacion/bandeja?date_from=&date_to=` — filas por colaborador, alcance según asignaciones supervisor/aprobador o acceso org completo.
- UI: `BandejaBoletasHeView` con **TanStack Table**; rango de fechas y búsqueda de trabajador en barra superior; filtros múltiples de subdivisión y estado en cabeceras (solo registrada / aprobada / anulada).

### Spec de layout (referencia)

Existe un borrador **SPEC_BOLETAS_HE_LAYOUT** (tabs bandeja-first + registro, paginación server-side, edición con confirm al cambiar de tab, etc.). Hoy la app puede diferir (p. ej. ruta de registro vs aprobación, tabla por línea vs por cabecera); conviene ir alineando por entregas.

## Archivos principales

- Registro: `apps/frontend/src/modules/horas-extra/registro/views/RegistroHorasExtraView.tsx`
- Bandeja: `apps/frontend/src/modules/horas-extra/aprobacion/views/BandejaBoletasHeView.tsx`
- API registro: `registro-horas-extra.controller.ts` / `registro-horas-extra.service.ts`
- API aprobación: `aprobacion-horas-extra.controller.ts` / `aprobacion-horas-extra.service.ts`
