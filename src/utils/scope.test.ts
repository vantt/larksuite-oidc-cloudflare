import { describe, it, expect } from 'vitest';
import { transformFeishuScope, transformOpenIDScope } from './scope';

describe('Scope Utilities', () => {
  describe('transformFeishuScope', () => {
    it('should always include openid in the output scope', () => {
      expect(transformFeishuScope('')).toBe('openid'); // no empty-string artifacts
      expect(transformFeishuScope('contact:user.email:readonly')).toBe('email openid');
    });

    it('should correctly map standard Feishu scopes to OIDC scopes', () => {
      const feishuScopes = 'contact:user.email:readonly contact:user.base:readonly';
      // maps email -> email, contact:user.base:readonly -> sub profile.
      // So unique OIDC scopes are: email, sub, profile, openid
      const result = transformFeishuScope(feishuScopes);
      expect(result).toContain('email');
      expect(result).toContain('sub');
      expect(result).toContain('profile');
      expect(result).toContain('openid');
    });

    it('should pass through unmapped scopes', () => {
      const result = transformFeishuScope('some:custom:scope');
      expect(result).toContain('some:custom:scope');
      expect(result).toContain('openid');
    });

    it('should handle null and undefined input gracefully', () => {
      expect(transformFeishuScope(null)).toBe('openid');
      expect(transformFeishuScope(undefined)).toBe('openid');
    });
  });

  describe('transformOpenIDScope', () => {
    it('should correctly map OIDC scopes to Feishu scopes', () => {
      const result = transformOpenIDScope('email profile');
      expect(result).toContain('contact:user.email:readonly');
      expect(result).toContain('directory:employee.base.email:read');
      expect(result).toContain('contact:user.base:readonly');
    });

    it('should handle unmapped scopes by ignoring them', () => {
      const result = transformOpenIDScope('custom_scope');
      expect(result.trim()).toBe('');
    });

    it('should handle null and undefined input gracefully', () => {
      expect(transformOpenIDScope(null)).toBe('');
      expect(transformOpenIDScope(undefined)).toBe('');
    });
  });
});
