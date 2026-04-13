# Salud Ocupacional — patrones de UI y alineación con SAMI

Este documento resume decisiones de interfaz del módulo **Salud ocupacional** y su vínculo con el design system del frontend; sirve para mantener coherencia al extender pantallas.
## Tipografía estándar (todos los módulos)
Fuente definida en `apps/frontend/src/index.css`: **Geist Variable** (`@fontsource-variable/geist`); `--font-sans` y `--font-heading` comparten el mismo stack. **Uso:** títulos de vista con `font-heading` + `font-semibold` y `text-xl` / `text-2xl` (`sm:` si aplica); formularios con `text-sm` / `text-xs` y ayudas en `text-muted-foreground`; primitivos desde `@/components/ui/*` (shadcn / Tailwind v4). Tokens y layout general: `docs/frontend/design-system.md`.

| Uso | Enfoque |
|-----|--------|
| Títulos de página / vistas | `font-heading`, `font-semibold`, tamaños `text-xl` / `text-2xl` + `sm:` |
| Cuerpo y formularios | `text-sm` / `text-xs`; secundarios `text-muted-foreground` |
| Componentes | `@/components/ui/*`; evitar estilos sueltos |

## Etiquetado: “código” en lugar de “SAP”
En UI de Salud ocupacional el identificador de personal se muestra como **código** (las APIs pueden seguir usando `sap_code`, etc.). Archivos: `registro-consulta/views/RegistroConsultaView.tsx` (buscador, boleta, jefatura, mensajes); `ajustes/views/SoAjustesView.tsx` (miembros, tabla); `mis-consultas/views/MisConsultasView.tsx`; `historial-medico/views/HistorialMedicoView.tsx`.

**Correos al guardar consulta:** asunto `ATENCION MEDICA DE TOPICO`; cuerpo con nombre del paciente, motivo, fecha/hora y condición al alta. El PDF va **solo** al correo del paciente; si hay **jefatura** (`supervisorEmail` en API), segundo correo **sin PDF** al responsable con **CC** al paciente (si hay correo de paciente). Persistencia: `email_cc` en BD guarda el correo de jefatura cuando aplica.

**Firma en registro:** la firma del **paciente** no se rellena con la firma del profesional (Mi firma); el PDF combina firma del paciente + firma/sello del profesional desde `worker_signatures`. En PDF, **ATENDIDO POR** usa nombre SAP (`vorna` + `nachn`) cuando staging está disponible.

## Ajustes (roles / perfiles)
Título de vista: **Ajustes — Salud ocupacional**. En tarjetas de perfil ya no se muestra la fila “Detalle en matriz de permisos”. Código: `ajustes/views/SoAjustesView.tsx`.

## Registro de consulta — densidad y móvil
Objetivo: menos scroll en móvil sin quitar flujos. En `RegistroConsultaView.tsx`: contenedor con `gap`/`padding` menores en móvil; `Card` con `size="sm"`; constante `soCardBody` (`space-y-3` → `sm:space-y-4`); textarea de motivo con `min-h` menor en móvil y menos filas; firma con un solo texto de estado; pie con botones a ancho completo en columna en móvil y fila a la derecha desde `sm:`.

## Bordes y contenedores
Constante `soSectionCardClass` → `border border-border shadow-sm` en cada `Card` de bloque (incl. acciones finales). Paneles internos y bordes discontinuos (firma, “Agregar fármaco”) parten de `border-border`; hover suave a primario donde ayuda. El input del buscador de paciente no lleva borde solo en primario: mismo criterio que el resto de `Input`.

## Congruencia entre módulos
`Card`, `Input`, `Label`, `Button` desde `@/components/ui`. Superficies con `border-border` salvo errores (`destructive`). Títulos de bloque en registro: `SectionTitle` — mayúsculas, `text-xs`, `font-semibold`, `text-primary`.

## Referencias
| Ruta | Contenido |
|------|-------------|
| `docs/frontend/design-system.md` | Tokens, UI, shell |
| `apps/frontend/src/index.css` | Fuentes y tema |
| `CLAUDE.md` | Comandos y stack |

*Última revisión: UI SO (ajustes, registro, copy “código”, cards, móvil).*
