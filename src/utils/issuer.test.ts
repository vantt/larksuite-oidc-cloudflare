import { describe, it, expect } from 'vitest';
import { IssuerHelper } from './issuer';

describe('IssuerHelper', () => {
  describe('Constructor Validation & Normalization', () => {
    it('should throw an error if baseUrl is empty', () => {
      expect(() => new IssuerHelper({ baseUrl: '' })).toThrow("ISSUER_BASE_URL is required but not configured.");
    });

    it('should throw an error if baseUrl is not a valid URL', () => {
      expect(() => new IssuerHelper({ baseUrl: 'not-a-url' })).toThrow('Invalid ISSUER_BASE_URL: "not-a-url"');
    });

    it('should normalize baseUrl by removing trailing slash', () => {
      const helper = new IssuerHelper({ baseUrl: 'https://example.com/' });
      expect(helper.baseUrl).toBe('https://example.com');
      expect(helper.issuer).toBe('https://example.com');
    });

    it('should keep baseUrl without trailing slash as is', () => {
      const helper = new IssuerHelper({ baseUrl: 'https://example.com' });
      expect(helper.baseUrl).toBe('https://example.com');
    });
  });

  describe('Default Endpoints', () => {
    const helper = new IssuerHelper({ baseUrl: 'https://example.com' });

    it('should return default authorization endpoint', () => {
      expect(helper.authEndpoint).toBe('https://example.com/auth');
    });

    it('should return default token endpoint', () => {
      expect(helper.tokenEndpoint).toBe('https://example.com/token');
    });

    it('should return default userinfo endpoint', () => {
      expect(helper.userinfoEndpoint).toBe('https://example.com/userinfo');
    });

    it('should return default jwks uri', () => {
      expect(helper.jwksUri).toBe('https://example.com/jwks');
    });

    it('should return default callback url', () => {
      expect(helper.getCallbackUrl('https://client.com/callback')).toBe(
        `https://example.com/callback/${encodeURIComponent('https://client.com/callback')}`
      );
    });

    it('should match default callback path', () => {
      expect(helper.isCallbackPath('/callback/some-encoded-url')).toBe(true);
      expect(helper.isCallbackPath('/callback/')).toBe(true);
      expect(helper.isCallbackPath('/auth')).toBe(false);
    });

    it('should extract redirect uri from callback path', () => {
      const targetUri = 'https://client.com/cb?param=1';
      const path = `/callback/${encodeURIComponent(targetUri)}`;
      expect(helper.extractRedirectUri(path)).toBe(targetUri);
    });
  });

  describe('Custom Endpoints as Paths', () => {
    it('should support customized endpoints as paths', () => {
      const helper = new IssuerHelper({
        baseUrl: 'https://identity.company.com',
        authPath: '/oauth2/v1/authorize',
        tokenPath: 'oauth2/v1/token', // without leading slash
        userinfoPath: '/oauth2/v1/userinfo',
        jwksPath: '/oauth2/v1/keys',
        callbackPrefix: '/oauth2/callback/',
      });

      expect(helper.authEndpoint).toBe('https://identity.company.com/oauth2/v1/authorize');
      expect(helper.authPath).toBe('/oauth2/v1/authorize');

      expect(helper.tokenEndpoint).toBe('https://identity.company.com/oauth2/v1/token');
      expect(helper.tokenPath).toBe('/oauth2/v1/token');

      expect(helper.userinfoEndpoint).toBe('https://identity.company.com/oauth2/v1/userinfo');
      expect(helper.userinfoPath).toBe('/oauth2/v1/userinfo');

      expect(helper.jwksUri).toBe('https://identity.company.com/oauth2/v1/keys');
      expect(helper.jwksPath).toBe('/oauth2/v1/keys');

      expect(helper.getCallbackUrl('https://client.com')).toBe(
        `https://identity.company.com/oauth2/callback/${encodeURIComponent('https://client.com')}`
      );
      expect(helper.isCallbackPath('/oauth2/callback/xyz')).toBe(true);
      expect(helper.extractRedirectUri('/oauth2/callback/https%3A%2F%2Fclient.com')).toBe('https://client.com');
    });
  });

  describe('Enforce Relative Paths Validation', () => {
    it('should throw error if authPath is configured as a full URL', () => {
      expect(() => new IssuerHelper({
        baseUrl: 'https://example.com',
        authPath: 'https://auth.custom-domain.com/auth'
      })).toThrow('Invalid config: ISSUER_AUTH_PATH must be a relative path (e.g. "/auth"), not a full URL');
    });

    it('should throw error if tokenPath is configured as a full URL', () => {
      expect(() => new IssuerHelper({
        baseUrl: 'https://example.com',
        tokenPath: 'https://auth.custom-domain.com/token'
      })).toThrow('Invalid config: ISSUER_TOKEN_PATH must be a relative path (e.g. "/auth"), not a full URL');
    });

    it('should throw error if userinfoPath is configured as a full URL', () => {
      expect(() => new IssuerHelper({
        baseUrl: 'https://example.com',
        userinfoPath: 'https://auth.custom-domain.com/userinfo'
      })).toThrow('Invalid config: ISSUER_USERINFO_PATH must be a relative path (e.g. "/auth"), not a full URL');
    });

    it('should throw error if jwksPath is configured as a full URL', () => {
      expect(() => new IssuerHelper({
        baseUrl: 'https://example.com',
        jwksPath: 'https://auth.custom-domain.com/jwks'
      })).toThrow('Invalid config: ISSUER_JWKS_PATH must be a relative path (e.g. "/auth"), not a full URL');
    });

    it('should throw error if callbackPrefix is configured as a full URL', () => {
      expect(() => new IssuerHelper({
        baseUrl: 'https://example.com',
        callbackPrefix: 'https://auth.custom-domain.com/callback/'
      })).toThrow('Invalid config: ISSUER_CALLBACK_PREFIX must be a relative path, not a full URL');
    });
  });

  describe('Edge-case Guards', () => {
    it('should throw if baseUrl contains a sub-path', () => {
      expect(() => new IssuerHelper({ baseUrl: 'https://example.com/oidc' })).toThrow(
        'ISSUER_BASE_URL must be an origin without path/query/hash'
      );
    });

    it('should throw if baseUrl contains query or hash', () => {
      expect(() => new IssuerHelper({ baseUrl: 'https://example.com/?x=1' })).toThrow(
        'ISSUER_BASE_URL must be an origin without path/query/hash'
      );
    });

    it('should accept root baseUrl with or without trailing slash', () => {
      expect(() => new IssuerHelper({ baseUrl: 'https://example.com' })).not.toThrow();
      expect(() => new IssuerHelper({ baseUrl: 'https://example.com/' })).not.toThrow();
    });

    it('should throw if callbackPrefix normalizes to "/"', () => {
      expect(() => new IssuerHelper({ baseUrl: 'https://example.com', callbackPrefix: '/' })).toThrow(
        'ISSUER_CALLBACK_PREFIX cannot be "/"'
      );
    });
  });
});
