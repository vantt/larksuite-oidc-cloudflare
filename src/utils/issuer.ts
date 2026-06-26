export interface IssuerConfig {
  baseUrl: string;
  authPath?: string;
  tokenPath?: string;
  userinfoPath?: string;
  jwksPath?: string;
  callbackPrefix?: string;
}

export class IssuerHelper {
  readonly baseUrl: string;
  readonly authPath: string;
  readonly tokenPath: string;
  readonly userinfoPath: string;
  readonly jwksPath: string;
  readonly callbackPrefix: string;

  constructor(config: IssuerConfig) {
    if (!config.baseUrl) {
      throw new Error("ISSUER_BASE_URL is required but not configured.");
    }

    let parsedBase: URL;
    try {
      parsedBase = new URL(config.baseUrl);
    } catch {
      throw new Error(`Invalid ISSUER_BASE_URL: "${config.baseUrl}"`);
    }

    // Routing matches incoming pathname against root-relative paths, so the issuer
    // must be a bare origin (no sub-path/query/hash) or routing would silently 404.
    if (parsedBase.pathname !== '/' || parsedBase.search || parsedBase.hash) {
      throw new Error(
        `ISSUER_BASE_URL must be an origin without path/query/hash: "${config.baseUrl}"`
      );
    }

    // Normalize: remove trailing slash
    this.baseUrl = config.baseUrl.endsWith('/') ? config.baseUrl.slice(0, -1) : config.baseUrl;

    const validateAndNormalizePath = (value: string | undefined, defaultPath: string, fieldName: string): string => {
      if (!value) return defaultPath;

      // Reject full URLs for path variables to prevent DNS/Routing mismatch issues and enforce clarity
      if (value.startsWith('http://') || value.startsWith('https://')) {
        throw new Error(`Invalid config: ${fieldName} must be a relative path (e.g. "/auth"), not a full URL: "${value}"`);
      }

      return value.startsWith('/') ? value : `/${value}`;
    };

    this.authPath = validateAndNormalizePath(config.authPath, '/auth', 'ISSUER_AUTH_PATH');
    this.tokenPath = validateAndNormalizePath(config.tokenPath, '/token', 'ISSUER_TOKEN_PATH');
    this.userinfoPath = validateAndNormalizePath(config.userinfoPath, '/userinfo', 'ISSUER_USERINFO_PATH');
    this.jwksPath = validateAndNormalizePath(config.jwksPath, '/jwks', 'ISSUER_JWKS_PATH');

    let callback = config.callbackPrefix || '/callback/';
    if (callback.startsWith('http://') || callback.startsWith('https://')) {
      throw new Error(`Invalid config: ISSUER_CALLBACK_PREFIX must be a relative path, not a full URL: "${callback}"`);
    }
    if (!callback.startsWith('/')) callback = '/' + callback;
    if (!callback.endsWith('/')) callback = callback + '/';
    if (callback === '/') {
      throw new Error(
        'Invalid config: ISSUER_CALLBACK_PREFIX cannot be "/" (would capture all routes).'
      );
    }
    this.callbackPrefix = callback;
  }

  get issuer(): string {
    return this.baseUrl;
  }

  get authEndpoint(): string {
    return `${this.baseUrl}${this.authPath}`;
  }

  get tokenEndpoint(): string {
    return `${this.baseUrl}${this.tokenPath}`;
  }

  get userinfoEndpoint(): string {
    return `${this.baseUrl}${this.userinfoPath}`;
  }

  get jwksUri(): string {
    return `${this.baseUrl}${this.jwksPath}`;
  }

  getCallbackUrl(redirectUri: string): string {
    return `${this.baseUrl}${this.callbackPrefix}${encodeURIComponent(redirectUri)}`;
  }

  isCallbackPath(pathname: string): boolean {
    return pathname.startsWith(this.callbackPrefix);
  }

  extractRedirectUri(pathname: string): string {
    if (!this.isCallbackPath(pathname)) {
      throw new Error(`Pathname does not start with callback prefix: ${pathname}`);
    }
    const encoded = pathname.substring(this.callbackPrefix.length);
    return decodeURIComponent(encoded);
  }
}
