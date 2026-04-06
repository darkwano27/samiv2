# Requirements Document

## Introduction

SAMI v2 reemplaza el flujo de autenticación actual (código SAP + password en una sola pantalla) por un flujo multi-step inteligente. El sistema detecta el tipo de worker a partir del código SAP y adapta la experiencia: autenticación AD vía LDAP, autenticación local con Argon2id, registro de primer acceso, recuperación de contraseña y cambio obligatorio de contraseña temporal. El flujo vive completamente dentro de la pantalla de login sin rutas separadas.

El **maestro de trabajadores** en SAP staging es la tabla **`eiis_trabajadores`**: el código que ingresa el usuario (`sap_code` en API) se corresponde con **`pernr`**. El estado laboral se lee de **`stat2`** (mapa de datos: **3 = activo**, **0 = baja** u otros valores = no activo para login). El correo corporativo en **`correo_corp`** (no vacío tras normalizar) indica cuenta **AD**; el correo personal para envío de contraseña temporal es el campo **`correo`**. El DNI en maestro es **`perid`**. Si existen varias filas por `pernr` (histórico), la implementación toma la vigente o la más reciente (p. ej. por `begda` / `id_registro`).

## Glossary

- **Auth_Service**: Módulo NestJS responsable de toda la lógica de autenticación.
- **Login_Flow**: Componente React raíz que orquesta los pasos del flujo multi-step mediante una state machine.
- **Worker**: Empleado registrado en el sistema SAMI con un código SAP único.
- **SAP_Code**: Identificador del worker enviado por el usuario al API; en SAP staging equivale a **`pernr`** en `eiis_trabajadores`.
- **Local_Auth**: Tabla de base de datos `local_auth` que almacena credenciales locales del worker. Solo tiene filas para workers sin AD.
- **AD_Worker**: Worker cuyo campo `correo_corp` está presente y no vacío; se autentica vía LDAP.
- **Local_Worker**: Worker cuyo campo `correo_corp` está vacío o es nulo.
- **New_Local_Worker**: Local_Worker que no tiene `password_hash` registrado en Local_Auth.
- **Existing_Local_Worker**: Local_Worker que tiene `password_hash` registrado en Local_Auth.
- **Temp_Password**: Contraseña temporal de 8 caracteres alfanuméricos generada con `crypto.randomBytes`.
- **Temp_Token**: UUID v4 de uso único con expiración de 10 minutos, usado para autorizar el cambio de contraseña temporal.
- **DNI**: Documento Nacional de Identidad del worker, exactamente 8 dígitos numéricos.
- **LDAP_Service**: Servicio interno que realiza el bind LDAP contra el directorio corporativo.
- **Email_Service**: Servicio interno que envía correos transaccionales.
- **Rate_Limiter**: Mecanismo que restringe intentos por IP en endpoints sensibles.

---

## Requirements

### Requirement 1: Identificación de Worker (Paso 1)

**User Story:** Como worker, quiero ingresar mi código SAP para que el sistema detecte mi tipo de cuenta y me dirija al paso de autenticación correcto.

#### Acceptance Criteria

1. WHEN un SAP_Code válido es enviado a `POST /api/auth/identify`, THE Auth_Service SHALL buscar el worker en SAP staging (`eiis_trabajadores` por `pernr` = SAP_Code) y retornar el tipo de autenticación correspondiente (`ad`, `local`, `new-local`) junto con el primer nombre y la inicial del apellido del worker (p. ej. desde `vorna` / `nachn`).
2. WHEN el worker encontrado tiene `correo_corp` presente y no vacío, THE Auth_Service SHALL retornar `authType: "ad"`.
3. WHEN el worker encontrado tiene `correo_corp` vacío o nulo y tiene `password_hash` en Local_Auth, THE Auth_Service SHALL retornar `authType: "local"`.
4. WHEN el worker encontrado tiene `correo_corp` vacío o nulo y no tiene `password_hash` en Local_Auth, THE Auth_Service SHALL retornar `authType: "new-local"`.
5. IF el SAP_Code no corresponde a ningún worker registrado, THEN THE Auth_Service SHALL retornar HTTP 404 con el mensaje "Código no registrado".
6. IF el worker existe pero **`stat2` no indica activo** (según el mapa de datos, p. ej. distinto de `3`), THEN THE Auth_Service SHALL retornar HTTP 403 con el mensaje "Cuenta inactiva".
7. THE Auth_Service SHALL retornar únicamente el primer nombre y la inicial del apellido del worker, sin revelar el nombre completo.
8. WHILE el Rate_Limiter detecta más de 10 solicitudes por minuto desde la misma IP en `/api/auth/identify`, THE Auth_Service SHALL retornar HTTP 429.

---

### Requirement 2: Autenticación AD (Paso 2A)

**User Story:** Como AD_Worker, quiero autenticarme con mi contraseña corporativa para que el sistema valide mi identidad contra el directorio LDAP.

#### Acceptance Criteria

1. WHEN un AD_Worker envía su SAP_Code y password a `POST /api/auth/login`, THE Auth_Service SHALL realizar un bind LDAP usando las credenciales del worker.
2. WHEN el bind LDAP es exitoso, THE Auth_Service SHALL crear una sesión y retornar el token de sesión.
3. IF el bind LDAP falla, THEN THE Auth_Service SHALL retornar HTTP 401 con el mensaje "Credenciales incorrectas".
4. THE Auth_Service SHALL retornar `requiresPasswordChange: false` para AD_Workers autenticados exitosamente.
5. WHILE el Rate_Limiter detecta más de 10 solicitudes por minuto desde la misma IP en `/api/auth/login`, THE Auth_Service SHALL retornar HTTP 429.

---

### Requirement 3: Autenticación Local (Paso 2B)

**User Story:** Como Existing_Local_Worker, quiero autenticarme con mi contraseña local para que el sistema verifique mi identidad y me permita acceder.

#### Acceptance Criteria

1. WHEN un Existing_Local_Worker envía su SAP_Code y password a `POST /api/auth/login`, THE Auth_Service SHALL verificar la password contra el `password_hash` almacenado usando Argon2id.
2. WHEN la verificación Argon2id es exitosa y `is_temp_password = false`, THE Auth_Service SHALL crear una sesión y retornar el token de sesión con `requiresPasswordChange: false`.
3. WHEN la verificación Argon2id es exitosa y `is_temp_password = true`, THE Auth_Service SHALL retornar un `tempToken` UUID v4 con `requiresPasswordChange: true` sin crear sesión.
4. IF la verificación Argon2id falla, THEN THE Auth_Service SHALL retornar HTTP 401 con el mensaje "Credenciales incorrectas".
5. THE Auth_Service SHALL NO incluir la password temporal en ninguna respuesta HTTP.

---

### Requirement 4: Registro de Primer Acceso (Paso 2C)

**User Story:** Como New_Local_Worker, quiero registrarme con mi DNI para que el sistema verifique mi identidad y me envíe una contraseña temporal.

#### Acceptance Criteria

1. WHEN un New_Local_Worker envía su SAP_Code y DNI a `POST /api/auth/register`, THE Auth_Service SHALL verificar que el DNI coincide con **`perid`** en `eiis_trabajadores` para ese `pernr`.
2. WHEN el DNI es válido, THE Auth_Service SHALL generar una Temp_Password de 8 caracteres alfanuméricos usando `crypto.randomBytes`.
3. WHEN la Temp_Password es generada, THE Auth_Service SHALL almacenar el hash Argon2id de la Temp_Password en Local_Auth con `is_temp_password = true`.
4. WHEN la Temp_Password es generada, THE Email_Service SHALL enviar un correo al campo **`correo`** del maestro SAP (`eiis_trabajadores`) con asunto "SAMI — Tu contraseña temporal" conteniendo la Temp_Password.
5. WHEN el entorno es desarrollo, THE Auth_Service SHALL registrar en consola `[DEV] Temp password for {sapCode}: {password}` como fallback del envío de correo.
6. WHEN el registro es exitoso, THE Auth_Service SHALL retornar HTTP 200 con el correo personal (`correo`) enmascarado (solo primeros 2 caracteres y dominio visible).
7. IF el DNI no coincide con el registrado para el worker, THEN THE Auth_Service SHALL retornar HTTP 400 con el mensaje "DNI incorrecto".
8. IF el worker ya tiene `password_hash` en Local_Auth, THEN THE Auth_Service SHALL retornar HTTP 409 indicando que el worker ya está registrado.
9. THE Auth_Service SHALL NO enviar la Temp_Password en la respuesta HTTP.

---

### Requirement 5: Recuperación de Contraseña

**User Story:** Como Existing_Local_Worker que olvidó su contraseña, quiero recuperarla con mi DNI para que el sistema me envíe una nueva contraseña temporal.

#### Acceptance Criteria

1. WHEN un Existing_Local_Worker envía su SAP_Code y DNI a `POST /api/auth/recover`, THE Auth_Service SHALL verificar que el DNI coincide con **`perid`** en `eiis_trabajadores` para ese `pernr`.
2. WHEN el DNI es válido, THE Auth_Service SHALL generar una nueva Temp_Password y actualizar el hash en Local_Auth con `is_temp_password = true`.
3. WHEN la nueva Temp_Password es generada, THE Email_Service SHALL enviar un correo al campo **`correo`** del maestro SAP con asunto "SAMI — Tu contraseña temporal".
4. WHEN la recuperación es exitosa, THE Auth_Service SHALL retornar HTTP 200 con el correo (`correo`) enmascarado.
5. IF el worker es un AD_Worker, THEN THE Auth_Service SHALL retornar HTTP 403 con el mensaje "Los usuarios corporativos no pueden recuperar contraseña desde SAMI".
6. IF el DNI no coincide, THEN THE Auth_Service SHALL retornar HTTP 400 con el mensaje "DNI incorrecto".
7. THE Auth_Service SHALL NO enviar la Temp_Password en la respuesta HTTP.

---

### Requirement 6: Cambio Obligatorio de Contraseña Temporal (Paso 3)

**User Story:** Como worker con contraseña temporal, quiero establecer una nueva contraseña permanente para que pueda acceder al sistema de forma segura.

#### Acceptance Criteria

1. WHEN un worker envía un `tempToken` válido, nueva password y confirmación a `POST /api/auth/change-password`, THE Auth_Service SHALL verificar que el `tempToken` existe en Local_Auth y no ha expirado.
2. WHEN el `tempToken` es válido y las passwords coinciden, THE Auth_Service SHALL hashear la nueva password con Argon2id, actualizar Local_Auth con `is_temp_password = false` y limpiar `temp_token` y `temp_token_expires_at`.
3. WHEN el cambio de password es exitoso, THE Auth_Service SHALL crear una sesión y retornar el token de sesión.
4. IF el `tempToken` no existe o ha expirado, THEN THE Auth_Service SHALL retornar HTTP 401 con el mensaje "Token inválido o expirado".
5. IF la nueva password y la confirmación no coinciden, THEN THE Auth_Service SHALL retornar HTTP 400 con el mensaje "Las contraseñas no coinciden".
6. THE Auth_Service SHALL invalidar el `tempToken` inmediatamente después de un cambio de password exitoso.
7. THE Temp_Token SHALL expirar en 10 minutos desde su generación.

---

### Requirement 7: Cambios de Base de Datos en Local_Auth

**User Story:** Como sistema, necesito almacenar el estado de contraseña temporal para que el flujo de autenticación pueda determinar si se requiere cambio de contraseña.

#### Acceptance Criteria

1. THE Auth_Service SHALL soportar el campo `is_temp_password BOOLEAN DEFAULT FALSE` en la tabla Local_Auth.
2. THE Auth_Service SHALL soportar el campo `temp_token UUID` en la tabla Local_Auth.
3. THE Auth_Service SHALL soportar el campo `temp_token_expires_at TIMESTAMPTZ` en la tabla Local_Auth.

---

### Requirement 8: Flujo Multi-Step en Frontend (Login_Flow)

**User Story:** Como worker, quiero que la pantalla de login me guíe paso a paso según mi tipo de cuenta para que la experiencia sea clara y sin confusión.

#### Acceptance Criteria

1. THE Login_Flow SHALL gestionar los pasos del flujo mediante una state machine con los estados: `identify`, `password-ad`, `password-local`, `register`, `register-success`, `recover`, `recover-success`, `change-password`.
2. WHEN el Auth_Service retorna `authType: "ad"`, THE Login_Flow SHALL transicionar al paso `password-ad`.
3. WHEN el Auth_Service retorna `authType: "local"`, THE Login_Flow SHALL transicionar al paso `password-local`.
4. WHEN el Auth_Service retorna `authType: "new-local"`, THE Login_Flow SHALL transicionar al paso `register`.
5. WHEN el Auth_Service retorna `requiresPasswordChange: true` con un `tempToken`, THE Login_Flow SHALL transicionar al paso `change-password` almacenando el `tempToken` en React state.
6. THE Login_Flow SHALL NO almacenar el `tempToken` en localStorage ni en ningún mecanismo de persistencia del navegador.
7. THE Login_Flow SHALL permitir al usuario regresar al paso anterior mediante un componente BackButton en todos los pasos excepto `identify`.
8. THE Login_Flow SHALL aplicar transiciones entre pasos usando CSS transitions sin usar la librería framer-motion.
9. THE Login_Flow SHALL eliminar los componentes `LoginForm.tsx` y `RegisterForm.tsx` existentes y la ruta `/register`.

---

### Requirement 9: Validaciones de Entrada

**User Story:** Como sistema, necesito validar todas las entradas del usuario para que los datos procesados sean correctos y seguros.

#### Acceptance Criteria

1. THE Auth_Service SHALL validar que `sapCode` es una cadena numérica no vacía usando esquemas Zod.
2. THE Auth_Service SHALL validar que `password` es una cadena no vacía usando esquemas Zod.
3. THE Auth_Service SHALL validar que `dni` contiene exactamente 8 dígitos numéricos usando esquemas Zod.
4. THE Auth_Service SHALL validar que `newPassword` tiene mínimo 8 caracteres, al menos 1 mayúscula y al menos 1 número usando esquemas Zod.
5. THE Auth_Service SHALL validar que `confirmPassword` es igual a `newPassword` usando esquemas Zod.
6. IF alguna validación Zod falla, THEN THE Auth_Service SHALL retornar HTTP 400 con los detalles de los campos inválidos.

---

### Requirement 10: Seguridad General

**User Story:** Como sistema, necesito aplicar controles de seguridad en el flujo de autenticación para que los datos y accesos estén protegidos.

#### Acceptance Criteria

1. THE Auth_Service SHALL aplicar Rate_Limiter de máximo 10 intentos por minuto por IP en los endpoints `/api/auth/identify` y `/api/auth/login`.
2. THE Auth_Service SHALL generar Temp_Passwords usando `crypto.randomBytes` con un alfabeto alfanumérico de 8 caracteres.
3. THE Auth_Service SHALL generar Temp_Tokens como UUID v4.
4. THE Auth_Service SHALL hashear todas las passwords usando el algoritmo Argon2id.
5. THE Auth_Service SHALL NO crear sesión cuando `is_temp_password = true`.
6. THE Auth_Service SHALL NO retornar el nombre completo del worker en ningún endpoint del flujo de autenticación.
