import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Feishu API client so /token flow tests don't hit the network.
vi.mock('./utils/feishu', () => ({
  FeishuClient: {
    exchangeCodeForToken: vi.fn(),
    getUserInfo: vi.fn(),
  },
}));
// Mock id_token signing (real impl needs a valid RSA PEM, unavailable in unit tests).
vi.mock('./utils/token', () => ({
  generateIdToken: vi.fn(async () => 'mock.id.token'),
  transformEmail: vi.fn(() => 'mock@example.com'),
}));

import workerImpl from './index';
import { FeishuClient } from './utils/feishu';

// The default export's fetch expects an incoming Request (with IncomingRequestCfProperties),
// while `new Request()` in tests produces a constructor Request. Loosen the req type for tests.
const worker = workerImpl as unknown as {
  fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response>;
};

const mockedExchange = vi.mocked(FeishuClient.exchangeCodeForToken);
const mockedGetUserInfo = vi.mocked(FeishuClient.getUserInfo);

const createMockKV = () => {
  const store = new Map<string, string>();
  return {
    put: vi.fn(async (key: string, value: string, options?: any) => {
      store.set(key, value);
    }),
    get: vi.fn(async (key: string) => {
      return store.get(key) ?? null;
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  } as unknown as KVNamespace;
};

const createMockEnv = (allowedUris?: string) => {
  return {
    ISSUER_BASE_URL: 'https://issuer.com',
    DOMAIN: 'example.com',
    JWT_KEY_ID: 'test_key_id',
    JWT_PRIVATE_KEY_PEM: 'mock-pem',
    JWT_PUBLIC_KEY_JWK: '{"kty":"RSA","n":"...","e":"AQAB","alg":"RS256","kid":"test_key_id"}',
    ALLOWED_REDIRECT_URIS: allowedUris,
    StateNonceKV: createMockKV(),
    CodeNonceKV: createMockKV(),
  } as unknown as Env;
};

const mockCtx = {} as any;

describe('Worker Endpoint Tests', () => {
  describe('/auth Endpoint Redirect URI Validation', () => {
    it('should return 400 if redirect_uri is missing', async () => {
      const req = new Request('https://issuer.com/auth?client_id=client_1');
      const env = createMockEnv('https://authorized.com/callback');
      const res = await worker.fetch(req, env, mockCtx);
      expect(res.status).toBe(400);
      expect(await res.text()).toBe('Missing redirect_uri parameter');
    });

    it('should return 400 if redirect_uri is not a valid URL', async () => {
      const req = new Request('https://issuer.com/auth?client_id=client_1&redirect_uri=invalid-uri');
      const env = createMockEnv('https://authorized.com/callback');
      const res = await worker.fetch(req, env, mockCtx);
      expect(res.status).toBe(400);
      expect(await res.text()).toBe('Invalid redirect_uri format (must be a valid absolute URL)');
    });

    it('should return 400 if redirect_uri is not whitelisted', async () => {
      const req = new Request(
        'https://issuer.com/auth?client_id=client_1&redirect_uri=https://unauthorized.com/callback'
      );
      const env = createMockEnv('https://authorized.com/callback');
      const res = await worker.fetch(req, env, mockCtx);
      expect(res.status).toBe(400);
      expect(await res.text()).toBe('Unauthorized redirect_uri');
    });

    it('should redirect if redirect_uri is whitelisted', async () => {
      const req = new Request(
        'https://issuer.com/auth?client_id=client_1&redirect_uri=https://authorized.com/callback&scope=openid'
      );
      const env = createMockEnv('https://authorized.com/callback');
      const res = await worker.fetch(req, env, mockCtx);
      expect(res.status).toBe(302);
      const location = res.headers.get('Location');
      expect(location).toContain('https://accounts.feishu.cn/open-apis/authen/v1/authorize');
    });

    it('should redirect to larksuite.com if LARK_MODE is true', async () => {
      const req = new Request(
        'https://issuer.com/auth?client_id=client_1&redirect_uri=https://authorized.com/callback&scope=openid'
      );
      const env = createMockEnv('https://authorized.com/callback');
      env.LARK_MODE = 'true';
      const res = await worker.fetch(req, env, mockCtx);
      expect(res.status).toBe(302);
      const location = res.headers.get('Location')!;
      expect(location).toContain('https://accounts.larksuite.com/open-apis/authen/v1/authorize');
    });

    it('should redirect successfully even when scope parameter is missing', async () => {
      const req = new Request(
        'https://issuer.com/auth?client_id=client_1&redirect_uri=https://authorized.com/callback'
      );
      const env = createMockEnv('https://authorized.com/callback');
      const res = await worker.fetch(req, env, mockCtx);
      expect(res.status).toBe(302);
      const location = res.headers.get('Location')!;
      expect(location).toContain('https://accounts.feishu.cn/open-apis/authen/v1/authorize');
      const url = new URL(location);
      expect(url.searchParams.get('scope')).toBe('');
    });

    it('should return 400 if client_id is missing', async () => {
      const req = new Request('https://issuer.com/auth?redirect_uri=https://authorized.com/callback');
      const env = createMockEnv('https://authorized.com/callback');
      const res = await worker.fetch(req, env, mockCtx);
      expect(res.status).toBe(400);
      expect(await res.text()).toBe('Missing client_id parameter');
    });

    it('should deny all redirect_uris when ALLOWED_REDIRECT_URIS is not configured', async () => {
      const req = new Request(
        'https://issuer.com/auth?client_id=client_1&redirect_uri=https://evil.com/steal'
      );
      const env = createMockEnv(); // no allowlist
      const res = await worker.fetch(req, env, mockCtx);
      expect(res.status).toBe(400);
      expect(await res.text()).toContain('denied');
    });

    it('should reject unauthorized client_id when ALLOWED_CLIENT_IDS is configured', async () => {
      const req = new Request(
        'https://issuer.com/auth?client_id=evil_app&redirect_uri=https://authorized.com/callback'
      );
      const env = createMockEnv('https://authorized.com/callback');
      env.ALLOWED_CLIENT_IDS = 'client_1,client_2';
      const res = await worker.fetch(req, env, mockCtx);
      expect(res.status).toBe(400);
      expect(await res.text()).toBe('Unauthorized client_id');
    });

    it('should allow valid client_id when ALLOWED_CLIENT_IDS is configured', async () => {
      const req = new Request(
        'https://issuer.com/auth?client_id=client_1&redirect_uri=https://authorized.com/callback&scope=openid'
      );
      const env = createMockEnv('https://authorized.com/callback');
      env.ALLOWED_CLIENT_IDS = 'client_1,client_2';
      const res = await worker.fetch(req, env, mockCtx);
      expect(res.status).toBe(302);
    });
  });

  describe('/callback Endpoint Handling', () => {
    it('should return 400 if redirect_uri in path is invalid or unauthorized', async () => {
      const path = '/callback/' + encodeURIComponent('https://unauthorized.com/callback');
      const req = new Request(`https://issuer.com${path}?code=123&state=state123`);
      const env = createMockEnv('https://authorized.com/callback');
      const res = await worker.fetch(req, env, mockCtx);
      expect(res.status).toBe(400);
      expect(await res.text()).toBe('Unauthorized redirect_uri in callback path');
    });

    it('should forward error details if Feishu returns error instead of code', async () => {
      const path = '/callback/' + encodeURIComponent('https://authorized.com/callback');
      const req = new Request(
        `https://issuer.com${path}?error=access_denied&error_description=User+denied&state=state123`
      );
      const env = createMockEnv('https://authorized.com/callback');
      const res = await worker.fetch(req, env, mockCtx);
      expect(res.status).toBe(302);
      const location = new URL(res.headers.get('Location')!);
      expect(location.origin).toBe('https://authorized.com');
      expect(location.searchParams.get('error')).toBe('access_denied');
      expect(location.searchParams.get('error_description')).toBe('User denied');
    });
  });

  describe('/token Endpoint Authentication', () => {
    it('should return 400 JSON error if client sends malformed Basic authorization header', async () => {
      const req = new Request('https://issuer.com/token', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic incorrect-base64!',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=authorization_code&code=123&redirect_uri=https://authorized.com/callback',
      });
      const env = createMockEnv('https://authorized.com/callback');
      const res = await worker.fetch(req, env, mockCtx);
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe('invalid_client');
      expect(body.error_description).toBe('Invalid Basic Authentication encoding');
    });

    it('should return 400 JSON error if redirect_uri is unauthorized at /token', async () => {
      const req = new Request('https://issuer.com/token', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic Y2xpZW50XzE6c2VjcmV0XzE=', // client_1:secret_1
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=authorization_code&code=123&redirect_uri=https://unauthorized.com/callback',
      });
      const env = createMockEnv('https://authorized.com/callback');
      const res = await worker.fetch(req, env, mockCtx);
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe('invalid_request');
      expect(body.error_description).toBe('Unauthorized redirect_uri');
    });

    it('should return 400 if grant_type is not authorization_code', async () => {
      const req = new Request('https://issuer.com/token', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic Y2xpZW50XzE6c2VjcmV0XzE=',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials&code=123&redirect_uri=https://authorized.com/callback',
      });
      const env = createMockEnv('https://authorized.com/callback');
      const res = await worker.fetch(req, env, mockCtx);
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe('unsupported_grant_type');
    });

    it('should correctly parse client secret containing colons in Basic authorization header', async () => {
      mockedExchange.mockResolvedValueOnce({
        code: 0,
        access_token: 'feishu_at',
        expires_in: 7200,
        refresh_token: 'feishu_rt',
        scope: 'contact:user.email:readonly',
        token_type: 'Bearer',
      });
      mockedGetUserInfo.mockResolvedValueOnce({
        code: 0,
        msg: 'success',
        data: {
          open_id: 'ou_123',
          name: 'Test User',
          email: 'test@example.com',
          avatar_url: 'https://avatar/x.png',
        } as any,
      });

      // client_1:sec:ret:123 -> Basic Y2xpZW50XzE6c2VjOnJldDoxMjM=
      const req = new Request('https://issuer.com/token', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic Y2xpZW50XzE6c2VjOnJldDoxMjM=',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=authorization_code&code=123&redirect_uri=https://authorized.com/callback',
      });
      const env = createMockEnv('https://authorized.com/callback');
      const res = await worker.fetch(req, env, mockCtx);
      expect(res.status).toBe(200);

      expect(mockedExchange).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client_1',
          clientSecret: 'sec:ret:123',
        }),
        expect.anything()
      );
    });

    it('should reject unauthorized client_id at /token when ALLOWED_CLIENT_IDS is set', async () => {
      const req = new Request('https://issuer.com/token', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic Y2xpZW50XzE6c2VjcmV0XzE=',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=authorization_code&code=123&redirect_uri=https://authorized.com/callback',
      });
      const env = createMockEnv('https://authorized.com/callback');
      env.ALLOWED_CLIENT_IDS = 'allowed_app_only';
      const res = await worker.fetch(req, env, mockCtx);
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe('invalid_client');
      expect(body.error_description).toBe('Unauthorized client_id');
    });
  });

  describe('/token Endpoint Token Exchange', () => {
    const tokenRequest = () =>
      new Request('https://issuer.com/token', {
        method: 'POST',
        headers: {
          Authorization: 'Basic Y2xpZW50XzE6c2VjcmV0XzE=', // client_1:secret_1
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=authorization_code&code=123&redirect_uri=https://authorized.com/callback',
      });

    beforeEach(() => {
      mockedExchange.mockReset();
      mockedGetUserInfo.mockReset();
    });

    it('should return a signed OIDC token response on success with proper cache headers', async () => {
      mockedExchange.mockResolvedValue({
        code: 0,
        access_token: 'feishu_at',
        expires_in: 7200,
        refresh_token: 'feishu_rt',
        refresh_token_expires_in: 604800,
        scope: 'contact:user.email:readonly',
        token_type: 'Bearer',
      });
      mockedGetUserInfo.mockResolvedValue({
        code: 0,
        msg: 'success',
        data: {
          open_id: 'ou_123',
          name: 'Test User',
          email: 'test@example.com',
          avatar_url: 'https://avatar/x.png',
        } as any,
      });

      const env = createMockEnv('https://authorized.com/callback');
      const res = await worker.fetch(tokenRequest(), env, mockCtx);
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect(res.headers.get('Pragma')).toBe('no-cache');
      const body = (await res.json()) as any;
      expect(body.access_token).toBe('feishu_at');
      expect(body.token_type).toBe('Bearer');
      expect(body.id_token).toBe('mock.id.token');
      expect(body.scope).toContain('openid');
    });

    it('should return 400 if Feishu token exchange fails (generic error, no Feishu details leaked)', async () => {
      mockedExchange.mockResolvedValue({
        code: 20050,
        error: 'server_error',
        error_description: 'boom',
      });

      const env = createMockEnv('https://authorized.com/callback');
      const res = await worker.fetch(tokenRequest(), env, mockCtx);
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe('invalid_grant');
      expect(body.error_description).toBe('Token exchange with upstream provider failed');
      expect(mockedGetUserInfo).not.toHaveBeenCalled();
    });

    it('should return 400 if Feishu user info fails (no 500 crash)', async () => {
      mockedExchange.mockResolvedValue({
        code: 0,
        access_token: 'feishu_at',
        expires_in: 7200,
        refresh_token: 'feishu_rt',
        refresh_token_expires_in: 604800,
        scope: 'contact:user.email:readonly',
        token_type: 'Bearer',
      });
      mockedGetUserInfo.mockResolvedValue({
        code: 99991663,
        msg: 'access token invalid',
      } as any);

      const env = createMockEnv('https://authorized.com/callback');
      const res = await worker.fetch(tokenRequest(), env, mockCtx);
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe('invalid_request');
      // Error description is now generic (no Feishu internals leaked)
      expect(body.error_description).toBe('Failed to fetch user info');
    });

    it('should call FeishuClient.exchangeCodeForToken with Lark endpoints when LARK_MODE is true', async () => {
      mockedExchange.mockResolvedValueOnce({
        code: 0,
        access_token: 'feishu_at',
        expires_in: 7200,
        refresh_token: 'feishu_rt',
        scope: 'contact:user.email:readonly',
        token_type: 'Bearer',
      });
      mockedGetUserInfo.mockResolvedValueOnce({
        code: 0,
        msg: 'success',
        data: {
          open_id: 'ou_123',
          name: 'Test User',
          email: 'test@example.com',
          avatar_url: 'https://avatar/x.png',
        } as any,
      });

      const req = new Request('https://issuer.com/token', {
        method: 'POST',
        headers: {
          Authorization: 'Basic Y2xpZW50XzE6c2VjcmV0XzE=',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=authorization_code&code=123&redirect_uri=https://authorized.com/callback',
      });
      const env = createMockEnv('https://authorized.com/callback');
      env.LARK_MODE = 'true';
      const res = await worker.fetch(req, env, mockCtx);
      expect(res.status).toBe(200);

      expect(mockedExchange).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          OAuth2Token: 'https://open.larksuite.com/open-apis/authen/v2/oauth/token',
        })
      );
      expect(mockedGetUserInfo).toHaveBeenCalledWith(
        'feishu_at',
        expect.objectContaining({
          UserInfo: 'https://open.larksuite.com/open-apis/authen/v1/user_info',
        })
      );
    });

    it('should delete code-nonce after consumption (single-use enforcement)', async () => {
      mockedExchange.mockResolvedValue({
        code: 0,
        access_token: 'feishu_at',
        expires_in: 7200,
        refresh_token: 'feishu_rt',
        refresh_token_expires_in: 604800,
        scope: 'contact:user.email:readonly',
        token_type: 'Bearer',
      });
      mockedGetUserInfo.mockResolvedValue({
        code: 0,
        msg: 'success',
        data: {
          open_id: 'ou_123',
          name: 'Test User',
          email: 'test@example.com',
          avatar_url: 'https://avatar/x.png',
        } as any,
      });

      const env = createMockEnv('https://authorized.com/callback');

      // Pre-populate a code-nonce mapping
      await env.CodeNonceKV.put('123', 'test-nonce-value');

      const res = await worker.fetch(tokenRequest(), env, mockCtx);
      expect(res.status).toBe(200);

      // Verify the code-nonce was deleted after use
      expect(env.CodeNonceKV.delete).toHaveBeenCalledWith('123');

      // Verify nonce is no longer retrievable
      const remainingNonce = await env.CodeNonceKV.get('123');
      expect(remainingNonce).toBeNull();
    });
  });

  describe('/userinfo Endpoint Handling', () => {
    beforeEach(() => {
      mockedGetUserInfo.mockReset();
    });

    it('should return 401 if Authorization header is missing', async () => {
      const req = new Request('https://issuer.com/userinfo');
      const env = createMockEnv();
      const res = await worker.fetch(req, env, mockCtx);
      expect(res.status).toBe(401);
      expect(await res.text()).toBe('Unauthorized');
    });

    it('should return 401 if Authorization header is not Bearer', async () => {
      const req = new Request('https://issuer.com/userinfo', {
        headers: { Authorization: 'Basic 123' },
      });
      const env = createMockEnv();
      const res = await worker.fetch(req, env, mockCtx);
      expect(res.status).toBe(401);
      expect(await res.text()).toBe('Unauthorized');
    });

    it('should return 200 with mapped user info matching token claims', async () => {
      mockedGetUserInfo.mockResolvedValueOnce({
        code: 0,
        msg: 'success',
        data: {
          open_id: 'ou_123',
          name: 'Test User',
          email: '',
          enterprise_email: 'enterprise@example.com',
          avatar_url: 'https://avatar/x.png',
          mobile: '+8613000000000',
        } as any,
      });

      const req = new Request('https://issuer.com/userinfo', {
        headers: { Authorization: 'Bearer test_token' },
      });
      const env = createMockEnv();
      const res = await worker.fetch(req, env, mockCtx);
      expect(res.status).toBe(200);

      const body = (await res.json()) as any;
      expect(body.sub).toBe('ou_123');
      expect(body.name).toBe('Test User');
      expect(body.full_name).toBe('Test User');
      expect(body.email).toBe('mock@example.com');
      expect(body.picture).toBe('https://avatar/x.png');
      expect(body.phone_number).toBe('+8613000000000');
      expect(body.preferred_username).toBe('Test User');
    });
  });

  describe('/test Diagnostic Page Endpoint', () => {
    it('should return 200 OK with HTML content if DEBUG_PAGE is true', async () => {
      const req = new Request('https://issuer.com/test');
      const env = createMockEnv();
      env.DEBUG_PAGE = 'true';
      const res = await worker.fetch(req, env, mockCtx);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/html');
      const text = await res.text();
      expect(text).toContain('OIDC Provider Diagnostic');
    });

    it('should return 404 if DEBUG_PAGE is not set (secure by default)', async () => {
      const req = new Request('https://issuer.com/test');
      const env = createMockEnv();
      const res = await worker.fetch(req, env, mockCtx);
      expect(res.status).toBe(404);
    });

    it('should return 404 if DEBUG_PAGE is false', async () => {
      const req = new Request('https://issuer.com/test');
      const env = createMockEnv();
      env.DEBUG_PAGE = 'false';
      const res = await worker.fetch(req, env, mockCtx);
      expect(res.status).toBe(404);
    });
  });

  describe('/.well-known/openid-configuration', () => {
    it('should only advertise code response type', async () => {
      const req = new Request('https://issuer.com/.well-known/openid-configuration');
      const env = createMockEnv();
      const res = await worker.fetch(req, env, mockCtx);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.response_types_supported).toEqual(['code']);
    });
  });
});
