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
 * AD: busca la cuenta cuyo atributo postalCode (configurable) = `pernr` SAP,
 * luego hace bind con el DN del usuario y la contraseña de red.
 */
@Injectable()
export class LdapService {
  private readonly logger = new Logger(LdapService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Autenticación AD alineada al mapa: postalCode en AD = `pernr` en `eiis_trabajadores`.
   */
  async authenticateBySapCode(sapCode: string, password: string): Promise<void> {
    const url = this.config.getOrThrow<string>('LDAP_URL');
    const serviceDn = this.config.getOrThrow<string>('LDAP_BIND_DN');
    const servicePass = this.config.getOrThrow<string>('LDAP_BIND_PASSWORD');
    const baseDn = this.config.getOrThrow<string>('LDAP_BASE_DN');
    const searchBase =
      this.config.get<string>('LDAP_SEARCH_BASE')?.trim() || baseDn;
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

    const serviceClient = new Client({
      url,
      timeout: 15_000,
      connectTimeout: 10_000,
    });

    await serviceClient.bind(serviceDn, servicePass);

    let userDn: string | undefined;
    try {
      const { searchEntries } = await serviceClient.search(searchBase, {
        scope: 'sub',
        filter,
        attributes: ['dn'],
        sizeLimit: 2,
      });
      if (searchEntries.length !== 1) {
        this.logger.warn(
          `LDAP search expected 1 entry for sap/cod, got ${searchEntries.length}`,
        );
        throw new Error('LDAP_USER_NOT_FOUND');
      }
      userDn = searchEntries[0]!.dn;
    } finally {
      await serviceClient.unbind().catch(() => {});
    }

    const userClient = new Client({
      url,
      timeout: 15_000,
      connectTimeout: 10_000,
    });
    try {
      await userClient.bind(userDn, password);
    } catch (err) {
      this.logger.warn(
        `LDAP user bind failed: ${err instanceof Error ? err.message : err}`,
      );
      throw err;
    } finally {
      await userClient.unbind().catch(() => {});
    }
  }
}
