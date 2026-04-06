import { integer, pgTable, text, varchar } from 'drizzle-orm/pg-core';

/**
 * Maestro de trabajadores SAP (pid_sistemas / staging).
 * - `pernr` = número de personal (el código SAP que ingresa el usuario).
 * - `stat2` = estado (3 = activo, 0 = baja, según mapa de datos).
 * - `correo_corp` con valor ⇒ flujo AD; vacío/null ⇒ local / new-local.
 */
export const eiisTrabajadores = pgTable('eiis_trabajadores', {
  idRegistro: integer('id_registro'),
  mandt: varchar('mandt', { length: 10 }),
  pernr: varchar('pernr', { length: 20 }).notNull(),
  endda: varchar('endda', { length: 20 }),
  begda: varchar('begda', { length: 20 }),
  /** SAP HCM: 3 activo, 0 baja (puede venir como texto desde la réplica) */
  stat2: varchar('stat2', { length: 20 }).notNull(),
  werks: varchar('werks', { length: 20 }),
  btrtl: varchar('btrtl', { length: 20 }),
  nachn: text('nachn'),
  vorna: text('vorna'),
  /** DNI / documento en maestro */
  perid: varchar('perid', { length: 32 }),
  /** Correo personal (temp password, registro) */
  correo: text('correo'),
  /** Si tiene dato ⇒ cuenta AD */
  correoCorp: text('correo_corp'),
  sede: text('sede'),
  txtDiv: text('txt_div'),
  txtSubdiv: text('txt_subdiv'),
  /** Fecha de nacimiento SAP (réplica), p. ej. `1998-11-27`. */
  gbdat: varchar('gbdat', { length: 32 }),
  /** Texto de puesto / cargo (SAP). */
  stext: text('stext'),
  /** Código SAP (pernr) del jefe inmediato, si viene en la réplica. */
  jefe: varchar('jefe', { length: 32 }),
  /** Centro de costo distribuido (SAP). */
  cecoDist: varchar('ceco_dist', { length: 64 }),
  /** Fecha de ingreso (SAP), p. ej. `2025-04-01`. */
  datin: varchar('datin', { length: 32 }),
});
