# Modal Crear / Editar perfil — Salud ocupacional (sección de producto)

Referencia alineada a la guía **SPEC / Kiro** (gestión de roles por módulo). Implementación en repo: `SoModuleProfileEditorDialog` + `GET .../profile-action-catalog` + cuerpo `app_permissions` en POST/PATCH.

## 6. Modal Crear/Editar perfil

- El **admin del módulo** ve **acciones** por aplicación operativa del módulo SO: `read`, `create`, `update`, `delete` (solo las que existen en catálogo para esa app).
- **No** se muestran nombres de roles internos (p. ej. “Médico (SO)”, “Jefe SO — historial”).
- El **backend** recibe `app_permissions[]` y **resuelve** un `role_id` por app que cubra todas las funciones de la app con las acciones pedidas, priorizando el rol con **menos permisos de más** (y desempate por `level`).
- La app de **gestión** del módulo (`salud-ocupacional-gestion`) aparece **deshabilitada** con texto que indica que la administración del módulo la otorga **solo superadmin** (no forma parte del perfil en esta pantalla). Las acciones por app operativa siguen la lista fija de producto (p. ej. historial sin “creación”, solo lectura/edición/eliminación).
- Al **crear** perfil, el **slug** no se muestra: se deriva del nombre en el backend.
- Los perfiles **semilla** solo permiten editar nombre y descripción en este modal.
