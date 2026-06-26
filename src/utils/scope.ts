import type { OpenIDStandardClaims } from '@/types/oidc';

/**
 * Convert Feishu scopes to OIDC scopes.
 */
export function transformFeishuScope(feishuScope: string | null | undefined): string {
  if (!feishuScope) return 'openid';
  const scopeMap: Record<string, string> = {
    'contact:user.email:readonly': 'email',
    'contact:user.id:readonly': 'sub',
    'directory:employee.base.email:read': 'email',
    'directory:employee.base.enterprise_email:read': 'email',
    'contact:user.base:readonly': 'sub profile',
    'contact:user.employee_id:readonly': 'sub',
  };

  return [
    ...new Set(
      feishuScope
        .split(' ')
        .map((scope) => scopeMap[scope] || scope)
        .join(' ')
        .split(' ')
        .filter(Boolean)
    ).add('openid'),
  ].join(' ');
}

/**
 * Convert OpenID scopes to Feishu scopes.
 */
export function transformOpenIDScope(openIDScope: string | null | undefined): string {
  if (!openIDScope) return '';
  const scopeMap = new Map<keyof OpenIDStandardClaims, string>([
    [
      'sub',
      'contact:user.id:readonly contact:user.base:readonly contact:user.employee_id:readonly',
    ],
    [
      'email',
      'contact:user.email:readonly directory:employee.base.email:read directory:employee.base.enterprise_email:read',
    ],
    ['profile', 'contact:user.base:readonly'],
  ]);

  return [
    ...new Set(
      openIDScope
        .split(' ')
        .map((scope) => scopeMap.get(scope as keyof OpenIDStandardClaims) || '')
        .join(' ')
        .split(' ')
        .filter(Boolean)
    ),
  ].join(' ');
}
