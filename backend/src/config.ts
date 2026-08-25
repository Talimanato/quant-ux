import fs from 'fs';
import path from 'path';

export interface Config {
  debug: boolean;
  httpPort: number;
  httpHost: string;
  sqlitePath: string;
  imageFolderUser: string;
  imageFolderApps: string;
  imageSize: number;
  jwtPassword: string;
  authService: 'qux' | 'keycloak' | '';
  mailUser: string;
  mailPassword: string;
  mailHost: string;
  mailPort: number;
  mailSSL: 'required' | 'optional' | 'disabled';
  userAllowSignUp: boolean;
  userAllowedDomains: string;
  aiToken: string;
  aiAllowedUrls: string;
  keycloakServer: string;
  keycloakRealm: string;
  keycloakClaimId: string;
  keycloakClaimEmail: string;
  keycloakClaimName: string;
  keycloakClaimLastName: string;
  keycloakClaimRole: string;
  keycloakIssuer: string;
}

export function loadConfig(configPath?: string): Config {
  const base: Partial<Config> = {};

  if (configPath && fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      Object.assign(base, flattenConfig(parsed));
    } catch (err) {
      console.warn('Could not load config file:', err);
    }
  }

  return {
    debug: getEnvBool('QUX_DEBUG', base.debug ?? false),
    httpPort: getEnvInt('QUX_HTTP_PORT', base.httpPort ?? 8080),
    httpHost: getEnvStr('QUX_HTTP_HOST', base.httpHost ?? 'http://localhost:8082'),
    sqlitePath: getEnvStr('QUX_SQLITE_PATH', base.sqlitePath ?? path.join(process.cwd(), 'data', 'qux.db')),
    imageFolderUser: getEnvStr('QUX_IMAGE_FOLDER_USER', base.imageFolderUser ?? path.join(process.cwd(), 'data', 'user-images')),
    imageFolderApps: getEnvStr('QUX_IMAGE_FOLDER_APPS', base.imageFolderApps ?? path.join(process.cwd(), 'data', 'app-images')),
    imageSize: getEnvInt('QUX_IMAGE_SIZE', base.imageSize ?? 50000000),
    jwtPassword: getEnvStr('QUX_JWT_PASSWORD', base.jwtPassword ?? ''),
    authService: getEnvStr('QUX_AUTH_SERVICE', base.authService ?? '') as any,
    mailUser: getEnvStr('QUX_MAIL_USER', base.mailUser ?? ''),
    mailPassword: getEnvStr('QUX_MAIL_PASSWORD', base.mailPassword ?? ''),
    mailHost: getEnvStr('QUX_MAIL_HOST', base.mailHost ?? ''),
    mailPort: getEnvInt('QUX_MAIL_PORT', base.mailPort ?? 587),
    mailSSL: getEnvStr('QUX_MAIL_SSL', base.mailSSL ?? 'required') as any,
    userAllowSignUp: getEnvBool('QUX_USER_ALLOW_SIGNUP', base.userAllowSignUp ?? true),
    userAllowedDomains: getEnvStr('QUX_USER_ALLOWED_DOMAINS', base.userAllowedDomains ?? '*'),
    aiToken: getEnvStr('QUX_AI_TOKEN', base.aiToken ?? ''),
    aiAllowedUrls: getEnvStr('QUX_AI_ALLOWED_URLS', base.aiAllowedUrls ?? ''),
    keycloakServer: getEnvStr('QUX_KEYCLOAK_SERVER', base.keycloakServer ?? ''),
    keycloakRealm: getEnvStr('QUX_KEYCLOAK_REALM', base.keycloakRealm ?? ''),
    keycloakClaimId: getEnvStr('QUX_KEY_CLOAK_CLAIM_ID', base.keycloakClaimId ?? ''),
    keycloakClaimEmail: getEnvStr('QUX_KEY_CLOAK_CLAIM_EMAIL', base.keycloakClaimEmail ?? ''),
    keycloakClaimName: getEnvStr('QUX_KEY_CLOAK_CLAIM_NAME', base.keycloakClaimName ?? ''),
    keycloakClaimLastName: getEnvStr('QUX_KEY_CLOAK_CLAIM_LASTNAME', base.keycloakClaimLastName ?? ''),
    keycloakClaimRole: getEnvStr('QUX_KEY_CLOAK_CLAIM_ROLE', base.keycloakClaimRole ?? ''),
    keycloakIssuer: getEnvStr('QUX_KEY_CLOAK_ISSUER', base.keycloakIssuer ?? '')
  };
}

function flattenConfig(obj: any, prefix = '', result: any = {}): any {
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flattenConfig(value, newKey, result);
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

function getEnvStr(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

function getEnvInt(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvBool(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
}
