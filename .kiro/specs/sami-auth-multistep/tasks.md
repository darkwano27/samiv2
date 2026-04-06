# Implementation Plan: SAMI Auth Multi-Step

## Overview

Implementación del flujo de autenticación multi-step para SAMI v2. El plan sigue la arquitectura modular: backend NestJS (Controller → Service → Data Access con Drizzle ORM) y frontend feature-based (View → Component → Hook → Repository → httpClient). Las fases A (backend) y B (frontend) son independientes y pueden ejecutarse en paralelo una vez definidos los contratos de API.

## Tasks

- [ ] 1. Base de datos — Crear tabla local_auth
  - [x] 1.1 Crear migración Drizzle para la tabla `local_auth`
    - `sap_code VARCHAR(20) PRIMARY KEY` — = `pernr` en `eiis_trabajadores` (SAP staging)
    - `password_hash TEXT NOT NULL` — solo existe para workers sin AD
    - `is_temp_password BOOLEAN DEFAULT FALSE`
    - `temp_token UUID`
    - `temp_token_expires_at TIMESTAMPTZ`
    - `created_at` / `updated_at TIMESTAMPTZ DEFAULT now()`
    - **No incluir `auth_method`** — se determina en runtime desde SAP staging
    - _Requirements: 7.1, 7.2, 7.3_
  - [ ]* 1.2 Escribir property test para el schema de migración
    - **Property 13: Temp password = 8 chars alfanuméricos; temp token = UUID v4**
    - **Validates: Requirements 7.2, 7.3, 10.3**

- [ ] 2. Backend — Módulo Auth: tipos, schemas Zod y estructura base
  - [ ] 2.1 Definir DTOs y schemas Zod para todos los endpoints
    - `IdentifyDto`: `sapCode` cadena numérica no vacía
    - `LoginDto`: `sapCode` + `password` no vacíos
    - `RegisterDto`: `sapCode` + `dni` (exactamente 8 dígitos)
    - `RecoverDto`: `sapCode` + `dni` (exactamente 8 dígitos)
    - `ChangePasswordDto`: `tempToken` + `newPassword` (min 8 chars, 1 mayúscula, 1 número) + `confirmPassword`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  - [ ]* 2.2 Escribir property test para validaciones Zod
    - **Property 12: Validaciones Zod → HTTP 400 para inputs inválidos**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6**

- [ ] 3. Backend — POST /api/auth/identify
  - [ ] 3.1 Implementar `AuthService.identify(sapCode)`
    - Query SAP staging: tabla `eiis_trabajadores`, filtrar por `pernr` = `sapCode`; si hay varias filas, quedarse con la más reciente/vigente (p. ej. `ORDER BY begda DESC, id_registro DESC LIMIT 1`)
    - Obtener `stat2`, `correo_corp`, `vorna`, `nachn`
    - Si `stat2` no indica activo (mapa: distinto de **3**) → HTTP 403 "Cuenta inactiva"
    - Si `correo_corp` presente y no vacío → `authType: "ad"` (sin consultar `local_auth`)
    - Si `correo_corp` ausente/vacío → consultar `local_auth`:
      - Fila existe → `authType: "local"`
      - Fila no existe → `authType: "new-local"`
    - **El `auth_method` nunca se lee ni escribe en BD local**
    - Retornar nombre formateado como "Nombre I." desde `vorna` / `nachn`
    - HTTP 404 si no hay fila en `eiis_trabajadores` para ese `pernr`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_
  - [ ]* 3.2 Escribir property test para clasificación de workers
    - **Property 1: auth_type se determina desde SAP staging (correo_corp) + existencia de fila en local_auth — nunca desde un campo auth_method en BD**
    - **Validates: Requirements 1.2, 1.3, 1.4**
  - [ ]* 3.3 Escribir property test para privacidad del nombre
    - **Property 2: Privacidad del nombre (formato "Nombre I.", nunca nombre completo)**
    - **Validates: Requirements 1.7, 10.6**
  - [ ] 3.4 Implementar `AuthController.identify` con el DTO y conectar al servicio
    - Aplicar pipe de validación Zod
    - _Requirements: 1.1, 9.1, 9.6_

- [ ] 4. Backend — Rate limiting en /identify y /login
  - [ ] 4.1 Configurar ThrottlerModule o guard de rate limiting en el módulo Auth
    - Máximo 10 req/min por IP en `/api/auth/identify` y `/api/auth/login`
    - Retornar HTTP 429 al superar el límite
    - _Requirements: 1.8, 2.5, 10.1_

- [ ] 5. Backend — POST /api/auth/login
  - [ ] 5.1 Implementar `AuthService.login(sapCode, password)`
    - Consultar SAP staging (`eiis_trabajadores` por `pernr`): validar `stat2` activo; obtener `correo_corp` y derivar rama en runtime
    - Rama AD (`correo_corp` presente): `LdapService` busca usuario AD por atributo configurable (p. ej. `postalCode` = `sapCode` / `pernr`) y hace bind con contraseña; si exitoso crear sesión y retornar token con `requiresPasswordChange: false`
    - Rama local (`correo_corp` ausente): buscar fila en `local_auth`, verificar Argon2id contra `password_hash`
      - `is_temp_password = false`: crear sesión, retornar token con `requiresPasswordChange: false`
      - `is_temp_password = true`: retornar `tempToken` UUID v4 con `requiresPasswordChange: true`, SIN crear sesión
    - HTTP 401 si credenciales incorrectas
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 10.5_
  - [ ]* 5.2 Escribir property test para auth AD exitosa
    - **Property 3: Auth AD exitosa → requires_password_change: false, token de sesión**
    - **Validates: Requirements 2.2, 2.4**
  - [ ]* 5.3 Escribir property test para auth local sin temp
    - **Property 4: Auth local sin temp → token de sesión, requires_password_change: false**
    - **Validates: Requirements 3.2**
  - [ ]* 5.4 Escribir property test para auth local con temp
    - **Property 5: Auth local con temp → requires_password_change: true, temp_token, SIN sesión**
    - **Validates: Requirements 3.3, 10.5**
  - [ ]* 5.5 Escribir property test para Argon2id round trip
    - **Property 14: Argon2id round trip (hash + verify)**
    - **Validates: Requirements 3.1, 10.4**
  - [ ] 5.6 Implementar `AuthController.login` y conectar al servicio
    - _Requirements: 2.1, 3.1, 9.1, 9.2_

- [ ] 6. Backend — POST /api/auth/register
  - [ ] 6.1 Implementar `AuthService.register(sapCode, dni)`
    - Verificar en SAP staging que worker no tiene `correo_corp` (no es AD)
    - Verificar que NO existe fila en `local_auth`; HTTP 409 si ya registrado
    - Verificar DNI contra `perid` en `eiis_trabajadores`; HTTP 400 si no coincide
    - Exigir `correo` personal en maestro; si vacío, HTTP 400 con mensaje claro
    - Generar Temp_Password: 8 chars alfanuméricos con `crypto.randomBytes`
    - Hashear con Argon2id e insertar fila en `local_auth` con `is_temp_password = true`
    - Llamar a `EmailService.sendTempPassword(correo, tempPassword)`; fallback `console.log` en dev
    - Retornar `maskedEmail` (primeros 2 chars + *** + @dominio)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_
  - [ ]* 6.2 Escribir property test para registro/recover con DNI correcto
    - **Property 6: Registro/recover con DNI correcto → fila en local_auth con password_hash verificable y is_temp_password: true**
    - **Validates: Requirements 4.3, 5.2**
  - [ ]* 6.3 Escribir property test para masked_email
    - **Property 7: masked_email → primeros 2 chars + *** + @dominio**
    - **Validates: Requirements 4.6, 5.4**
  - [ ]* 6.4 Escribir property test para generación de temp password
    - **Property 13: Temp password = 8 chars alfanuméricos**
    - **Validates: Requirements 4.2, 10.2**
  - [ ] 6.5 Implementar `AuthController.register` y conectar al servicio
    - _Requirements: 4.1, 9.3_

- [ ] 7. Backend — POST /api/auth/recover
  - [ ] 7.1 Implementar `AuthService.recover(sapCode, dni)`
    - Consultar SAP staging: HTTP 403 si worker tiene `correo_corp` (es AD)
    - Verificar DNI contra `perid`; exigir `correo` en maestro; HTTP 400 si no coincide o falta correo
    - Generar nueva Temp_Password, actualizar fila en `local_auth` con nuevo hash y `is_temp_password = true`
    - Enviar correo con `EmailService`; fallback console.log en dev
    - Retornar `maskedEmail`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  - [ ] 7.2 Implementar `AuthController.recover` y conectar al servicio
    - _Requirements: 5.1, 9.3_

- [ ] 8. Backend — POST /api/auth/change-password
  - [ ] 8.1 Implementar `AuthService.changePassword(tempToken, newPassword, confirmPassword)`
    - Buscar `tempToken` en `local_auth`; HTTP 401 si no existe o expirado
    - Verificar que `newPassword === confirmPassword`; HTTP 400 si no coinciden
    - Hashear nueva password con Argon2id
    - Actualizar `local_auth`: `is_temp_password = false`, `temp_token = null`, `temp_token_expires_at = null`
    - Crear sesión y retornar token
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_
  - [ ]* 8.2 Escribir property test para cambio de password exitoso
    - **Property 8: Cambio de password exitoso → fila en local_auth con is_temp_password: false, temp_token: null, sesión creada**
    - **Validates: Requirements 6.2, 6.3**
  - [ ]* 8.3 Escribir property test para temp token de un solo uso
    - **Property 9: Temp token de un solo uso → segundo intento retorna 401**
    - **Validates: Requirements 6.6**
  - [ ] 8.4 Implementar `AuthController.changePassword` y conectar al servicio
    - _Requirements: 6.1, 9.4, 9.5_

- [ ] 9. Checkpoint — Backend completo
  - Asegurar que todos los tests del backend pasan. Consultar al usuario si hay dudas antes de continuar.

- [ ] 10. Frontend — Tipos y contrato de API
  - [ ] 10.1 Actualizar `auth.types.ts` con los nuevos tipos del flujo multi-step
    - `IdentifyResponse`: `authType`, `displayName`
    - `LoginResponse`: `token?`, `requiresPasswordChange`, `tempToken?`
    - `RegisterResponse` / `RecoverResponse`: `maskedEmail`
    - `ChangePasswordResponse`: `token`
    - `AuthStep` union type para la state machine
    - _Requirements: 8.1, 8.5_
  - [ ] 10.2 Actualizar `auth.repository.ts` (interface) con los nuevos métodos
    - `identify`, `login`, `register`, `recover`, `changePassword`
    - _Requirements: 8.1_
  - [ ] 10.3 Implementar `auth.api-repository.ts` con los nuevos métodos usando `httpClient`
    - Mapear cada método al endpoint correspondiente
    - _Requirements: 8.1_

- [ ] 11. Frontend — Componentes shared de autenticación
  - [ ] 11.1 Crear componente `AuthCard`
    - Contenedor visual para todos los pasos del flujo
    - _Requirements: 8.1_
  - [ ] 11.2 Crear componente `PasswordInput`
    - Input de password con toggle show/hide
    - _Requirements: 8.1_
  - [ ] 11.3 Crear componente `PasswordRequirements`
    - Indicador visual de requisitos: min 8 chars, 1 mayúscula, 1 número
    - _Requirements: 9.4_
  - [ ] 11.4 Crear componente `BackButton`
    - Botón de regreso para todos los pasos excepto `identify`
    - _Requirements: 8.7_

- [ ] 12. Frontend — StepIdentify
  - [ ] 12.1 Crear hook `useIdentify`
    - Usar TanStack Query mutation para llamar a `repository.identify`
    - Exponer estado de loading y error
    - _Requirements: 1.1_
  - [ ] 12.2 Crear componente `StepIdentify`
    - Input de SAP_Code + submit
    - Usar `useIdentify`; al éxito emitir evento con `authType` y `displayName` al `LoginFlow`
    - _Requirements: 1.1, 8.2, 8.3, 8.4_

- [ ] 13. Frontend — StepPasswordAD y StepPasswordLocal
  - [ ] 13.1 Adaptar/crear hook `useAuth` para manejar login AD y local
    - Mutation para `repository.login`
    - Al éxito con `requiresPasswordChange: false`: guardar token de sesión
    - Al éxito con `requiresPasswordChange: true`: emitir `tempToken` al `LoginFlow` (NO a localStorage)
    - _Requirements: 2.2, 3.2, 3.3, 8.5, 8.6_
  - [ ] 13.2 Crear componente `StepPasswordAD`
    - Input de password + submit; usar `useAuth`
    - _Requirements: 2.1, 2.3_
  - [ ] 13.3 Crear componente `StepPasswordLocal`
    - Input de password + link "Olvidé mi contraseña"; usar `useAuth`
    - _Requirements: 3.1, 3.4_
  - [ ]* 13.4 Escribir property test para tempToken nunca en localStorage
    - **Property 11: tempToken nunca en localStorage**
    - **Validates: Requirements 8.6**

- [ ] 14. Frontend — StepRegister y StepRegisterSuccess
  - [ ] 14.1 Crear hook `useRegister`
    - Mutation para `repository.register`
    - _Requirements: 4.1_
  - [ ] 14.2 Crear componente `StepRegister`
    - Input de DNI + submit; usar `useRegister`
    - _Requirements: 4.1, 4.7_
  - [ ] 14.3 Crear componente `StepRegisterSuccess`
    - Mostrar `maskedEmail` recibido del hook
    - _Requirements: 4.6_

- [ ] 15. Frontend — StepRecover y StepRecoverSuccess
  - [ ] 15.1 Crear hook `useRecover`
    - Mutation para `repository.recover`
    - _Requirements: 5.1_
  - [ ] 15.2 Crear componente `StepRecover`
    - Input de DNI + submit; usar `useRecover`
    - _Requirements: 5.1, 5.6_
  - [ ] 15.3 Crear componente `StepRecoverSuccess`
    - Mostrar `maskedEmail` recibido del hook
    - _Requirements: 5.4_

- [ ] 16. Frontend — StepChangePassword
  - [ ] 16.1 Crear hook `useChangePassword`
    - Mutation para `repository.changePassword`; recibe `tempToken` desde props/contexto
    - _Requirements: 6.1_
  - [ ] 16.2 Crear componente `StepChangePassword`
    - Dos inputs de password + `PasswordRequirements`; usar `useChangePassword`
    - Al éxito guardar token de sesión y redirigir
    - _Requirements: 6.1, 6.5, 9.4, 9.5_

- [ ] 17. Frontend — LoginFlow (state machine)
  - [ ] 17.1 Implementar `LoginFlow` con state machine
    - Estados: `identify`, `password-ad`, `password-local`, `register`, `register-success`, `recover`, `recover-success`, `change-password`
    - Transiciones según `authType` y `requiresPasswordChange`
    - Almacenar `tempToken` solo en React state (nunca localStorage)
    - CSS transitions entre pasos (sin framer-motion)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_
  - [ ]* 17.2 Escribir property test para transiciones de la state machine
    - **Property 10: Transiciones state machine según authType/requiresPasswordChange**
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.5**

- [ ] 18. Frontend — Actualizar ruta /login y limpiar código legacy
  - [ ] 18.1 Actualizar la ruta `/login` para usar `LoginFlow` con layout split-screen
    - _Requirements: 8.1_
  - [ ] 18.2 Eliminar `LoginForm.tsx`, `RegisterForm.tsx` y la ruta `/register`
    - _Requirements: 8.9_

- [ ] 19. Checkpoint final — Todos los tests pasan
  - Asegurar que todos los tests (backend y frontend) pasan. Consultar al usuario si hay dudas antes de cerrar.

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia los requisitos específicos para trazabilidad
- Los property tests usan fast-check
- Maestro SAP: tabla **`eiis_trabajadores`** (`pernr`, `stat2`, `correo_corp`, `correo`, `perid`, `vorna`, `nachn`, …). Schema Drizzle en `schema-sap/eiis-trabajadores.ts`
- `local_auth` solo tiene filas para workers sin AD — el `auth_method` se calcula siempre en runtime desde SAP staging (`stat2` + `correo_corp`)
- El `tempToken` NUNCA debe persistirse fuera de React state
- En desarrollo, el fallback de email es `console.log`; en producción se usa `EmailService`
