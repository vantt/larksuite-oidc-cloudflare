import { describe, it, expect, beforeAll } from 'vitest';
import * as jose from 'jose';
import { transformEmail, generateIdToken } from './token';
import type { FeishuUserInfo } from '@/types/feishu';

describe('Token Utilities', () => {
  describe('transformEmail', () => {
    it('should use enterprise_email if present', () => {
      const userInfo: Partial<FeishuUserInfo> = {
        name: 'John Doe',
        email: 'john@example.com',
        enterprise_email: 'john@company.com',
      };
      expect(transformEmail(userInfo as FeishuUserInfo)).toBe(
        'john@company.com'
      );
    });

    it('should fall back to email if enterprise_email is absent', () => {
      const userInfo: Partial<FeishuUserInfo> = {
        name: 'John Doe',
        email: 'john@example.com',
      };
      expect(transformEmail(userInfo as FeishuUserInfo)).toBe('john@example.com');
    });

    it('should fall back to open_id@domain if both emails are absent', () => {
      const userInfo: Partial<FeishuUserInfo> = {
        open_id: 'usr_john_doe',
        name: 'John Doe',
      };
      expect(transformEmail(userInfo as FeishuUserInfo, 'custom.domain')).toBe(
        'usr_john_doe@custom.domain'
      );
      expect(transformEmail(userInfo as FeishuUserInfo)).toBe(
        'usr_john_doe@example.com'
      );
    });
  });

  describe('generateIdToken', () => {
    let privateKeyPem: string;
    let publicKeyJwk: jose.JWK;

    beforeAll(async () => {
      // Generate a temporary RS256 key pair for the test
      const { privateKey, publicKey } = await jose.generateKeyPair('RS256', {
        modulusLength: 2048,
        extractable: true,
      });
      privateKeyPem = await jose.exportPKCS8(privateKey);
      publicKeyJwk = await jose.exportJWK(publicKey);
    });

    it('should successfully sign and construct a valid JWT ID Token', async () => {
      const userInfo: Partial<FeishuUserInfo> = {
        open_id: 'usr_123',
        name: 'Test User',
        avatar_url: 'https://avatar.com/test.png',
        email: 'test@example.com',
      };

      const token = await generateIdToken({
        userInfo: userInfo as FeishuUserInfo,
        clientId: 'client_abc',
        nonce: 'nonce_xyz',
        issuer: 'https://issuer.com',
        jwtKeyId: 'key_1',
        jwtPrivateKeyPem: privateKeyPem,
      });

      expect(token).toBeDefined();

      // Verify the generated token
      const publicKey = await jose.importJWK(publicKeyJwk, 'RS256');
      const { payload, protectedHeader } = await jose.jwtVerify(token, publicKey, {
        issuer: 'https://issuer.com',
        audience: 'client_abc',
      });

      expect(protectedHeader.kid).toBe('key_1');
      expect(protectedHeader.alg).toBe('RS256');
      expect(payload.sub).toBe('usr_123');
      expect(payload.nonce).toBe('nonce_xyz');
      expect(payload.name).toBe('Test User');
      expect(payload.full_name).toBe('Test User');
      expect(payload.email).toBe('test@example.com');
      expect(payload.picture).toBe('https://avatar.com/test.png');
    });
  });
});
