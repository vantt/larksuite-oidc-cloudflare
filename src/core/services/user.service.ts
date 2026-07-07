import type { LarkPort } from '@/core/ports/lark.port';
import type { CachePort } from '@/core/ports/cache.port';

function cleanValue(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s-_]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export class LarkUserService {
  constructor(
    private larkPort: LarkPort,
    private cachePort: CachePort
  ) {}

  async getUserExtendedInfo(params: {
    openId: string;
    appId: string;
    appSecret: string;
    apiDomain: string;
    roleIdsToCheck?: string[];
    userAccessToken?: string;
    bypassCache?: boolean;
  }): Promise<{
    departments: string[];
    departmentIds: string[];
    functionalRoles: string[];
  }> {
    const { openId, appId, appSecret, apiDomain, roleIdsToCheck = [], userAccessToken, bypassCache = false } = params;

    try {
      // 1. Get tenant_access_token
      const tenantToken = await this.larkPort.getTenantAccessToken(appId, appSecret, apiDomain);

      // 2. Get user's department IDs (always use tenantToken as requested by user)
      const { departmentIds } = await this.larkPort.getUserDetail(openId, tenantToken, apiDomain);

      // 3. Resolve department names (with caching of the full departments list)
      let deptMap: Map<string, string> | null = null;
      const deptCacheKey = 'cache:departments_list';
      const cachedDeptListStr = bypassCache ? null : await this.cachePort.get(deptCacheKey);

      if (cachedDeptListStr) {
        try {
          const entries = JSON.parse(cachedDeptListStr);
          deptMap = new Map(entries);
          console.log(`[Cache] Departments list loaded from KV Cache (${deptMap.size} items).`);
        } catch (err) {
          console.error('[LarkUserService] Failed to parse cached departments list:', err);
        }
      }

      if (!deptMap) {
        try {
          console.log('[Cache] Departments list cache miss. Fetching from Lark API...');
          deptMap = await this.larkPort.getDepartmentsList(tenantToken, apiDomain);
          await this.cachePort.put(deptCacheKey, JSON.stringify(Array.from(deptMap.entries())), { expirationTtl: 3600 });
        } catch (err) {
          console.error('[LarkUserService] Failed to fetch departments list:', err);
          deptMap = new Map();
        }
      }

      const departments = departmentIds.map(id => cleanValue(deptMap?.get(id) || id));

      // 4. Resolve functional roles (with caching of the full roles list)
      const functionalRoles: string[] = [];
      let rolesToCheck: string[] = [];
      let roleMap: Map<string, string> | null = null;

      if (roleIdsToCheck.length === 0) {
        const rolesCacheKey = 'cache:roles_list';
        const cachedRolesListStr = bypassCache ? null : await this.cachePort.get(rolesCacheKey);

        if (cachedRolesListStr) {
          try {
            const entries = JSON.parse(cachedRolesListStr);
            roleMap = new Map(entries);
            console.log(`[Cache] Roles list loaded from KV Cache (${roleMap.size} items).`);
          } catch (err) {
            console.error('[LarkUserService] Failed to parse cached roles list:', err);
          }
        }

        if (!roleMap) {
          try {
            console.log('[Cache] Roles list cache miss. Fetching from Lark API...');
            roleMap = await this.larkPort.getFunctionalRolesList(tenantToken, apiDomain);
            await this.cachePort.put(rolesCacheKey, JSON.stringify(Array.from(roleMap.entries())), { expirationTtl: 3600 });
          } catch (err) {
            console.error('[LarkUserService] Failed to fetch roles list:', err);
            roleMap = new Map();
          }
        }
        rolesToCheck = Array.from(roleMap.keys());
      } else {
        rolesToCheck = roleIdsToCheck;
      }

      // Check role membership (with caching of members list to avoid rate limits)
      for (const roleId of rolesToCheck) {
        const cacheKey = `cache:role_members:${roleId}`;
        let cachedMembersStr = bypassCache ? null : await this.cachePort.get(cacheKey);
        let members: string[] = [];

        if (cachedMembersStr) {
          try {
            members = JSON.parse(cachedMembersStr);
            // If cache is contaminated with user_ids instead of open_ids
            if (members.length > 0 && !members.some(id => id.startsWith('ou_') || id.startsWith('od-'))) {
              members = [];
              cachedMembersStr = null;
            } else {
              console.log(`[Cache] Members for role ${roleId} loaded from KV Cache (${members.length} members).`);
            }
          } catch {
            members = [];
          }
        }

        if (!cachedMembersStr) {
          try {
            console.log(`[Cache] Members for role ${roleId} cache miss. Fetching from Lark API...`);
            members = await this.larkPort.getFunctionalRoleMembers(roleId, tenantToken, apiDomain);
            await this.cachePort.put(cacheKey, JSON.stringify(members), { expirationTtl: 600 }); // cache for 10 minutes
          } catch (err) {
            console.error(`Failed to get members for role ${roleId}:`, err);
            members = [];
          }
        }

        // Check if user (openId) or any of user's departments (departmentIds) is a member
        const isMember = members.includes(openId) || departmentIds.some(deptId => members.includes(deptId));
        if (isMember) {
          const roleName = roleMap?.get(roleId) || roleId;
          functionalRoles.push(cleanValue(roleName));
        }
      }

      return {
        departments,
        departmentIds,
        functionalRoles,
      };
    } catch (err) {
      console.error('Error fetching extended user info from Lark:', err);
      // Fail gracefully: return empty structures rather than crashing the worker
      return {
        departments: [],
        departmentIds: [],
        functionalRoles: [],
      };
    }
  }
}
