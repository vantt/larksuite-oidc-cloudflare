import { IssuerHelper } from './utils/issuer';
import { NonceManager } from './utils/nonce';
import { FeishuClient } from './utils/feishu';
import { generateIdToken, transformEmail } from './utils/token';
import { transformFeishuScope, transformOpenIDScope } from './utils/scope';

import { getFeishuEndpoints } from '@/types/feishu';
import { testPageHtml } from './utils/test-page';
import type {
  FeishuAuthRequestParams,
  FeishuAccessTokenResponse,
  FeishuAccessTokenErrorResponse,
  FeishuAuthResponse,
} from '@/types/feishu';
import type {
  OpenIDAuthRequestParams,
  OpenIDProviderMetadata,
  OpenIDSuccessTokenResponse,
  OpenIDUserInfoSuccessResponse,
} from '@/types/oidc';
import type {
  OAuth2AccessTokenErrorResponse,
  OAuth2AccessTokenRequest,
  OAuth2AccessTokenRequestWithAuth,
} from './types/oauth2';

const DEFAULT_STATE_PREFIX = '638DG14L72WO-';

// Minimum length for STATE_PREFIX to prevent accidental matching of client-provided state values
const MIN_STATE_PREFIX_LENGTH = 8;

/**
 * Validates a redirect_uri against the configured allowlist.
 * Returns null if allowed, or an error message string if rejected.
 */
function validateRedirectUri(
  redirectUri: string,
  env: Pick<Env, 'ALLOWED_REDIRECT_URIS' | 'DEBUG_PAGE'>,
  issuerBaseUrl: string,
): string | null {
  const allowedUris = (env.ALLOWED_REDIRECT_URIS || '')
    .split(',')
    .map(u => u.trim())
    .filter(Boolean);

  // When no allowlist is configured, deny all redirects (secure by default)
  if (allowedUris.length === 0) {
    // Exception: allow test page redirect when debug mode is enabled
    const isTestPage = env.DEBUG_PAGE === 'true' && redirectUri === `${issuerBaseUrl}/test`;
    if (!isTestPage) {
      return 'No ALLOWED_REDIRECT_URIS configured — all redirect_uri values are denied';
    }
    return null;
  }

  const isTestPageAllowed = env.DEBUG_PAGE === 'true' && redirectUri === `${issuerBaseUrl}/test`;
  if (!allowedUris.includes(redirectUri) && !isTestPageAllowed) {
    return 'Unauthorized redirect_uri';
  }

  return null;
}

/**
 * Validates client_id against the configured allowlist.
 * Returns null if allowed, or an error message string if rejected.
 */
function validateClientId(clientId: string, env: Pick<Env, 'ALLOWED_CLIENT_IDS'>): string | null {
  const allowedIds = (env.ALLOWED_CLIENT_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

  // When no allowlist is configured, allow all client IDs (backwards compatible)
  if (allowedIds.length === 0) return null;

  if (!allowedIds.includes(clientId)) {
    return 'Unauthorized client_id';
  }
  return null;
}

/** Returns a plain-text error Response with explicit Content-Type. */
function textError(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

/** Returns a JSON error Response with Cache-Control headers per RFC 6749 §5.1. */
function jsonError(body: OAuth2AccessTokenErrorResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Pragma': 'no-cache',
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const statePrefix = env.STATE_PREFIX || DEFAULT_STATE_PREFIX;

    // Validate STATE_PREFIX length to prevent accidental state filtering bypass
    if (statePrefix.length < MIN_STATE_PREFIX_LENGTH) {
      return textError(
        `Configuration error: STATE_PREFIX must be at least ${MIN_STATE_PREFIX_LENGTH} characters`,
        500,
      );
    }

    const issuerHelper = new IssuerHelper({
      baseUrl: env.ISSUER_BASE_URL,
      authPath: env.ISSUER_AUTH_PATH,
      tokenPath: env.ISSUER_TOKEN_PATH,
      userinfoPath: env.ISSUER_USERINFO_PATH,
      jwksPath: env.ISSUER_JWKS_PATH,
      callbackPrefix: env.ISSUER_CALLBACK_PREFIX,
    });

    const nonceManager = new NonceManager({
      stateNonceKV: env.StateNonceKV,
      codeNonceKV: env.CodeNonceKV,
    });

    const feishuEndpoints = getFeishuEndpoints(env.LARK_MODE);

    // OpenID Connect required configuration endpoint
    if (url.pathname === '/.well-known/openid-configuration') {
      return new Response(
        JSON.stringify({
          issuer: issuerHelper.issuer,
          authorization_endpoint: issuerHelper.authEndpoint,
          token_endpoint: issuerHelper.tokenEndpoint,
          userinfo_endpoint: issuerHelper.userinfoEndpoint,
          jwks_uri: issuerHelper.jwksUri,
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code'],
          subject_types_supported: ['public'],
          id_token_signing_alg_values_supported: ['RS256'],
          scopes_supported: ['openid', 'profile', 'email'],
        } satisfies OpenIDProviderMetadata),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Serve interactive diagnostic console
    if (url.pathname === '/test' && env.DEBUG_PAGE === 'true') {
      return new Response(testPageHtml, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // JWKS endpoint - provides public keys for verifying JWT signatures
    if (url.pathname === issuerHelper.jwksPath) {
      let jwk: unknown;
      try {
        jwk = JSON.parse(env.JWT_PUBLIC_KEY_JWK);
      } catch {
        return jsonError({ error: 'server_error', error_description: 'JWKS configuration error' }, 500);
      }
      return new Response(
        JSON.stringify({ keys: [jwk] }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // auth endpoint: redirect to Feishu login
    if (url.pathname === issuerHelper.authPath) {
      const inputParams = url.searchParams as {
        get<TKey extends keyof OpenIDAuthRequestParams>(
          key: TKey
        ): OpenIDAuthRequestParams[TKey];
      };

      const clientId = inputParams.get('client_id');
      if (!clientId) {
        return textError('Missing client_id parameter', 400);
      }

      const clientIdError = validateClientId(clientId, env);
      if (clientIdError) {
        return textError(clientIdError, 400);
      }

      const redirectUriParam = inputParams.get('redirect_uri');
      if (!redirectUriParam) {
        return textError('Missing redirect_uri parameter', 400);
      }

      let parsedRedirectUrl: URL;
      try {
        parsedRedirectUrl = new URL(redirectUriParam);
      } catch {
        return textError('Invalid redirect_uri format (must be a valid absolute URL)', 400);
      }

      const redirectError = validateRedirectUri(parsedRedirectUrl.toString(), env, issuerHelper.baseUrl);
      if (redirectError) {
        return textError(redirectError, 400);
      }

      const nonce = inputParams.get('nonce');
      const state = inputParams.get('state') || statePrefix + crypto.randomUUID();
      if (nonce && state) {
        await nonceManager.saveStateNonce(state, nonce);
      }

      const redirectUrl = new URL(
        issuerHelper.getCallbackUrl(redirectUriParam)
      );

      const inputScope = inputParams.get('scope');
      const scope = transformOpenIDScope(inputScope);
      const searchParams = new URLSearchParams({
        scope,
        client_id: clientId,
        redirect_uri: redirectUrl.toString(),
        ...(state && { state }),
      } satisfies FeishuAuthRequestParams);

      const feishuAuthUrl = new URL(feishuEndpoints.OAuth2Auth);
      feishuAuthUrl.search = '?' + searchParams.toString();
      return Response.redirect(feishuAuthUrl.toString());
    }

    // callback endpoint: receive code from Feishu and forward to client
    if (issuerHelper.isCallbackPath(url.pathname)) {
      const searchParams = url.searchParams as {
        get<TKey extends keyof FeishuAuthResponse>(key: TKey): FeishuAuthResponse[TKey];
      };
      const code = searchParams.get('code');
      const state = searchParams.get('state');

      let redirectUrl: URL;
      try {
        const extractedUri = issuerHelper.extractRedirectUri(url.pathname);
        redirectUrl = new URL(extractedUri);
      } catch {
        return textError('Invalid redirect_uri in callback path', 400);
      }

      const redirectError = validateRedirectUri(redirectUrl.toString(), env, issuerHelper.baseUrl);
      if (redirectError) {
        return textError('Unauthorized redirect_uri in callback path', 400);
      }

      // Check for error parameters from Feishu
      const error = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description') || url.searchParams.get('msg');

      if (!code) {
        const errorRedirectUrl = new URL(redirectUrl.toString());
        errorRedirectUrl.searchParams.set('error', error || 'access_denied');
        if (errorDescription) {
          errorRedirectUrl.searchParams.set('error_description', errorDescription);
        }
        if (state && !state.startsWith(statePrefix)) {
          errorRedirectUrl.searchParams.set('state', state);
        }
        return Response.redirect(errorRedirectUrl.toString());
      }

      if (state) {
        const nonce = await nonceManager.getStateNonce(state);
        if (nonce) {
          await nonceManager.deleteStateNonce(state);
          await nonceManager.associateCodeWithNonce(code, nonce);
        }
      }

      redirectUrl.searchParams.set('code', code);
      if (state && !state.startsWith(statePrefix)) {
        redirectUrl.searchParams.set('state', state);
      }

      return Response.redirect(redirectUrl.toString());
    }

    // token endpoint — reject non-POST with 405 per RFC 6749 §3.2
    if (url.pathname === issuerHelper.tokenPath && request.method !== 'POST') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { 'Allow': 'POST', 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // token endpoint
    // Exchange Feishu code for token, and generate token required by OIDC
    if (url.pathname === issuerHelper.tokenPath && request.method === 'POST') {
      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        return jsonError({
          error: 'invalid_request',
          error_description: 'Request body must be application/x-www-form-urlencoded',
        }, 400);
      }

      // Validate grant_type per RFC 6749 §4.1.3
      const grantType = formData.get('grant_type') as string | null;
      if (grantType !== 'authorization_code') {
        return jsonError({
          error: 'unsupported_grant_type',
          error_description: 'Only authorization_code grant type is supported',
        }, 400);
      }

      let clientId: string | undefined = undefined;
      let clientSecret: string | undefined = undefined;
      if (request.headers.get('Authorization')) {
        const authHeader = request.headers.get('Authorization')!;
        const [scheme, token] = authHeader.split(' ');
        if (scheme === 'Basic') {
          try {
            const decoded = atob(token);
            const colonIndex = decoded.indexOf(':');
            if (colonIndex !== -1) {
              clientId = decoded.substring(0, colonIndex);
              clientSecret = decoded.substring(colonIndex + 1);
            } else {
              clientId = decoded;
              clientSecret = '';
            }
          } catch {
            return jsonError({
              error: 'invalid_client',
              error_description: 'Invalid Basic Authentication encoding',
            }, 400);
          }
        }
      }
      if (formData.has('client_id')) {
        clientId = formData.get('client_id') as string;
      }
      if (formData.has('client_secret')) {
        clientSecret = formData.get('client_secret') as string;
      }
      if (!clientId || !clientSecret) {
        return jsonError({
          error: 'invalid_client',
          error_description: 'Missing client authentication',
        }, 401);
      }

      const clientIdError = validateClientId(clientId, env);
      if (clientIdError) {
        return jsonError({
          error: 'invalid_client',
          error_description: clientIdError,
        }, 400);
      }

      const code = formData.get('code') as string | null;
      if (!code) {
        return jsonError({
          error: 'invalid_request',
          error_description: 'Missing code parameter',
        }, 400);
      }

      const redirectUriParam = formData.get('redirect_uri') as string | null;
      if (!redirectUriParam) {
        return jsonError({
          error: 'invalid_request',
          error_description: 'Missing redirect_uri parameter',
        }, 400);
      }

      let parsedRedirectUrl: URL;
      try {
        parsedRedirectUrl = new URL(redirectUriParam);
      } catch {
        return jsonError({
          error: 'invalid_request',
          error_description: 'Invalid redirect_uri format (must be a valid absolute URL)',
        }, 400);
      }

      const redirectError = validateRedirectUri(parsedRedirectUrl.toString(), env, issuerHelper.baseUrl);
      if (redirectError) {
        return jsonError({
          error: 'invalid_request',
          error_description: redirectError,
        }, 400);
      }

      const redirectUrl = new URL(
        issuerHelper.getCallbackUrl(redirectUriParam)
      );

      const feishuTokenData = await FeishuClient.exchangeCodeForToken({
        clientId,
        clientSecret,
        code,
        redirectUri: redirectUrl.toString(),
      }, feishuEndpoints);

      if (feishuTokenData.code !== 0) {
        console.warn(`Feishu token exchange failed: code=${feishuTokenData.code}`);
        return jsonError({
          error: 'invalid_grant',
          error_description: 'Token exchange with upstream provider failed',
        }, 400);
      }

      const { access_token, expires_in, refresh_token, scope } =
        feishuTokenData as Extract<
          FeishuAccessTokenResponse,
          { code: 0; refresh_token: string }
        >;

      // Get user info using access_token
      const userInfo = await FeishuClient.getUserInfo(access_token, feishuEndpoints);

      if (userInfo.code !== 0 || !userInfo.data) {
        console.warn(`Feishu user info failed: code=${userInfo.code}`);
        return jsonError({
          error: 'invalid_request',
          error_description: 'Failed to fetch user info',
        }, 400);
      }

      // Retrieve and immediately delete code-nonce (single-use enforcement)
      let nonce: string | null = null;
      nonce = await nonceManager.getCodeNonce(code);
      if (nonce) {
        await nonceManager.deleteCodeNonce(code);
      }

      // Generate OIDC response with required cache headers (RFC 6749 §5.1)
      try {
        return new Response(
          JSON.stringify({
            access_token: access_token,
            token_type: 'Bearer',
            refresh_token,
            id_token: await generateIdToken({
              userInfo: userInfo.data,
              clientId,
              nonce,
              issuer: issuerHelper.issuer,
              domain: env.DOMAIN,
              jwtKeyId: env.JWT_KEY_ID,
              jwtPrivateKeyPem: env.JWT_PRIVATE_KEY_PEM,
            }),
            expires_in,
            scope: transformFeishuScope(scope),
          } satisfies OpenIDSuccessTokenResponse),
          {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store',
              'Pragma': 'no-cache',
            },
          }
        );
      } catch (err: any) {
        console.error(`ID token generation failed: ${err?.message}`);
        return jsonError({
          error: 'server_error',
          error_description: 'Failed to generate ID token',
        }, 500);
      }
    }

    // userinfo endpoint - forward directly to Feishu
    if (url.pathname === issuerHelper.userinfoPath) {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
        return textError('Unauthorized', 401);
      }
      const accessToken = authHeader.substring(7); // "Bearer " is 7 chars

      const userInfoFeishu = await FeishuClient.getUserInfo(accessToken, feishuEndpoints);

      if (userInfoFeishu.code !== 0 || !userInfoFeishu.data) {
        return textError('Failed to fetch user info', 401);
      }

      return new Response(
        JSON.stringify({
          sub: userInfoFeishu.data.open_id,
          name: userInfoFeishu.data.name,
          email: transformEmail(userInfoFeishu.data, env.DOMAIN),
          picture: userInfoFeishu.data.avatar_url,
          phone_number: userInfoFeishu.data.mobile || undefined,
          preferred_username: userInfoFeishu.data.name || undefined,
        } satisfies OpenIDUserInfoSuccessResponse),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return textError('Not Found', 404);
  },
} satisfies ExportedHandler<Env>;
