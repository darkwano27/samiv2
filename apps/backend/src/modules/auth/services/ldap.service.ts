import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'ldapts';

/** Escapa valor en porción de filtro LDAP (RFC 4515). */
function escapeLdapFilterValue(value: string): string {
  return value
    .replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\0/g, '\\00');
}

/**
 * SAP a veces trae `correo_corp` en mayúsculas; en AD suele guardarse en minúsculas.
 * Igualamos para el filtro LDAP (muchas comparaciones son case-sensitive en el servidor).
 */
function normalizeCorporateEmailForLdap(email: string): string {
  return email.trim().toLowerCase();
}

export type LdapAdAuthStrategy =
  | 'corporate_mail'
  | 'sap_code'
  | 'corporate_mail_then_sap_code';

/**
 * Bind rechazado por política de AD (contraseña vencida, debe cambiar, etc.), no por clave incorrecta genérica.
 * Ver mensajes `data 532`, `773`, `775` en errores Microsoft LDAP.
 */
export class LdapBindPolicyError extends Error {
  constructor(readonly rawLdapMessage: string) {
    super('LDAP_BIND_POLICY');
    this.name = 'LdapBindPolicyError';
  }
}

/**
 * AD: según estrategia, la cuenta puede localizarse por `correo_corp` (SAP) = mail/UPN en LDAP
 * (varios pernr comparten una cuenta) o por `postalCode` = pernr (1:1).
 */
@Injectable()
export class LdapService {
  private readonly logger = new Logger(LdapService.name);

  constructor(private readonly config: ConfigService) {}

  private getClient() {
    const url = this.config.getOrThrow<string>('LDAP_URL');
    return new Client({
      url,
      timeout: 15_000,
      connectTimeout: 10_000,
    });
  }

  private getSearchBase(): string {
    const baseDn = this.config.getOrThrow<string>('LDAP_BASE_DN');
    return this.config.get<string>('LDAP_SEARCH_BASE')?.trim() || baseDn;
  }

  /**
   * Login corporativo: busca **una** entrada cuyo mail o UPN coincide con `correo_corp` del maestro SAP,
   * luego bind con contraseña de esa cuenta (compartida entre varios trabajadores si el mail es el mismo).
   */
  async authenticateByCorporateEmail(
    corporateEmail: string,
    password: string,
  ): Promise<void> {
    const normalized = normalizeCorporateEmailForLdap(corporateEmail);
    if (!normalized) {
      throw new Error('LDAP_USER_NOT_FOUND');
    }
    const escaped = escapeLdapFilterValue(normalized);
    /** AD: mail, UPN y proxyAddresses (SMTP principal) suelen alinear con correo corporativo */
    const filter = `(&(objectClass=user)(objectCategory=person)(|(mail=${escaped})(userPrincipalName=${escaped})(proxyAddresses=SMTP:${escaped})))`;

    const userDn = await this.searchUserDn(filter, 'mail/UPN');
    await this.bindUserDn(userDn, password);
  }

  /**
   * Autenticación AD alineada al mapa clásico: postalCode (o atributo configurable) = `pernr` en SAP.
   */
  async authenticateBySapCode(sapCode: string, password: string): Promise<void> {
    const escaped = escapeLdapFilterValue(sapCode);
    const customFilter = this.config.get<string>('LDAP_AUTH_FILTER')?.trim();
    const filter = customFilter
      ? customFilter.split('{sapCode}').join(escaped)
      : (() => {
          const attr =
            this.config.get<string>('LDAP_POSTALCODE_ATTR')?.trim() ||
            'postalCode';
          return `(&(objectClass=user)(objectCategory=person)(${attr}=${escaped}))`;
        })();

    const userDn = await this.searchUserDn(filter, 'sapCode');
    await this.bindUserDn(userDn, password);
  }

  /**
   * Punto único de entrada para login AD según `LDAP_AD_AUTH_STRATEGY`.
   */
  async authenticateAdLogin(params: {
    sapCode: string;
    corporateEmail: string | null | undefined;
    password: string;
  }): Promise<void> {
    const strategy = this.config.get<LdapAdAuthStrategy>(
      'LDAP_AD_AUTH_STRATEGY',
      'corporate_mail_then_sap_code',
    );
    const corp = params.corporateEmail?.trim();

    if (strategy === 'sap_code') {
      await this.authenticateBySapCode(params.sapCode, params.password);
      return;
    }

    if (strategy === 'corporate_mail') {
      if (!corp) {
        this.logger.warn('LDAP_AD_AUTH_STRATEGY=corporate_mail pero correo_corp vacío');
        throw new Error('LDAP_USER_NOT_FOUND');
      }
      await this.authenticateByCorporateEmail(corp, params.password);
      return;
    }

    // corporate_mail_then_sap_code
    if (corp) {
      try {
        await this.authenticateByCorporateEmail(corp, params.password);
        return;
      } catch (err) {
        if (this.isLdapUserNotFound(err)) {
          this.logger.debug(
            `LDAP: sin cuenta por correo ${corp}, reintento por pernr ${params.sapCode}`,
          );
          await this.authenticateBySapCode(params.sapCode, params.password);
          return;
        }
        throw err;
      }
    }

    await this.authenticateBySapCode(params.sapCode, params.password);
  }

  private isLdapUserNotFound(err: unknown): boolean {
    return err instanceof Error && err.message === 'LDAP_USER_NOT_FOUND';
  }

  private async searchUserDn(filter: string, label: string): Promise<string> {
    const url = this.config.getOrThrow<string>('LDAP_URL');
    const serviceDn = this.config.getOrThrow<string>('LDAP_BIND_DN');
    const servicePass = this.config.getOrThrow<string>('LDAP_BIND_PASSWORD');
    const searchBase = this.getSearchBase();

    const serviceClient = this.getClient();
    await serviceClient.bind(serviceDn, servicePass);

    let userDn: string | undefined;
    try {
      const { searchEntries } = await serviceClient.search(searchBase, {
        scope: 'sub',
        filter,
        attributes: ['dn'],
        sizeLimit: 2,
      });
      if (searchEntries.length > 1) {
        this.logger.warn(
          `LDAP search (${label}) ambiguous: ${searchEntries.length} entries`,
        );
        throw new Error('LDAP_AMBIGUOUS_USER');
      }
      if (searchEntries.length === 0) {
        this.logger.warn(`LDAP search (${label}): no entries`);
        throw new Error('LDAP_USER_NOT_FOUND');
      }
      userDn = searchEntries[0]!.dn;
    } finally {
      await serviceClient.unbind().catch(() => {});
    }

    return userDn;
  }

  private async bindUserDn(userDn: string, password: string): Promise<void> {
    const userClient = this.getClient();
    try {
      await userClient.bind(userDn, password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`LDAP user bind failed: ${msg}`);
      if (this.isAdPasswordPolicyFailure(msg)) {
        throw new LdapBindPolicyError(msg);
      }
      throw err;
    } finally {
      await userClient.unbind().catch(() => {});
    }
  }

  /** Alineado a subcódigos `data` en errores AcceptSecurityContext de AD. */
  private isAdPasswordPolicyFailure(message: string): boolean {
    return /\bdata\s+532\b/i.test(message) // contraseña vencida
      || /\bdata\s+773\b/i.test(message) // debe restablecer contraseña
      || /\bdata\s+775\b/i.test(message); // debe cambiar en primer inicio
  }
}
