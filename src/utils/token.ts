import * as jose from 'jose';
import type { FeishuUserInfo } from '@/types/feishu';
import type { OpenIDToken } from '@/types/oidc';

// Module-level cache for imported private keys to optimize performance
const privateKeyCache = new Map<string, CryptoKey>();

/**
 * Normalizes user email. Matches enterprise_email first, then email,
 * and falls back to user_open_id@domain if neither exists.
 */
export function transformEmail(userInfo: FeishuUserInfo, domain?: string): string {
  return (
    userInfo.enterprise_email ||
    userInfo.email ||
    `${userInfo.open_id}@${domain || 'example.com'}`
  );
}

export interface IdTokenConfig {
  userInfo: FeishuUserInfo;
  clientId: string;
  nonce: string | null | undefined;
  issuer: string;
  domain?: string;
  jwtKeyId: string;
  jwtPrivateKeyPem: string;
}

async function getPrivateKey(pem: string): Promise<CryptoKey> {
  const normalizedPem = pem.replace(/\\n/g, '\n');
  let key = privateKeyCache.get(normalizedPem);
  if (!key) {
    key = await jose.importPKCS8(normalizedPem, 'RS256');
    privateKeyCache.set(normalizedPem, key);
  }
  return key;
}

/**
 * Generates and signs an OIDC compliant ID Token (JWT).
 * Throws if jwtPrivateKeyPem or jwtKeyId are missing/invalid.
 */
export async function generateIdToken({
  userInfo,
  clientId,
  nonce,
  issuer,
  domain,
  jwtKeyId,
  jwtPrivateKeyPem,
}: IdTokenConfig): Promise<string> {
  if (!jwtPrivateKeyPem) {
    throw new Error('JWT signing key (JWT_PRIVATE_KEY_PEM) is not configured');
  }
  if (!jwtKeyId) {
    throw new Error('JWT key ID (JWT_KEY_ID) is not configured');
  }

  const now = Math.floor(Date.now() / 1000);
  const hasRealEmail = !!(userInfo.enterprise_email || userInfo.email);

  const payload: OpenIDToken = {
    // OIDC required claims
    iss: issuer,
    sub: userInfo.open_id,
    aud: clientId,
    exp: now + 3600, // expires in 1 hour
    iat: now,
    ...(nonce && { nonce }),

    // Standard claims
    name: userInfo.name,
    email: transformEmail(userInfo, domain),
    email_verified: hasRealEmail,
    picture: userInfo.avatar_url,
  };

  const privateKey = await getPrivateKey(jwtPrivateKeyPem);

  // Sign JWT using private key
  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: jwtKeyId })
    .sign(privateKey);
}
