import type { LarkPort } from '@/core/ports/lark.port';
import type {
  LarkTenantAccessTokenResponse,
  LarkUserDetailResponse,
  LarkDepartmentDetailResponse,
  LarkFunctionalRoleMembersResponse,
} from '@/types/lark';

const FEISHU_FETCH_TIMEOUT_MS = 10_000;

export class LarkAdapter implements LarkPort {
  private acceptLanguage: string;

  constructor(options?: { acceptLanguage?: string }) {
    this.acceptLanguage = options?.acceptLanguage || 'en-US';
  }

  async getTenantAccessToken(appId: string, appSecret: string, apiDomain: string): Promise<string> {
    const response = await fetch(`https://${apiDomain}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret,
      }),
      signal: AbortSignal.timeout(FEISHU_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Lark Tenant Token API returned status ${response.status}: ${body}`);
    }

    const data = (await response.json()) as LarkTenantAccessTokenResponse;
    if (data.code !== 0) {
      throw new Error(`Lark Tenant Token API returned error code ${data.code}: ${data.msg}`);
    }

    return data.tenant_access_token;
  }

  async getUserDetail(openId: string, tenantToken: string, apiDomain: string): Promise<{ departmentIds: string[] }> {
    const response = await fetch(
      `https://${apiDomain}/open-apis/contact/v3/users/${openId}?user_id_type=open_id`,
      {
        headers: {
          'Authorization': `Bearer ${tenantToken}`,
          'Accept-Language': this.acceptLanguage,
        },
        signal: AbortSignal.timeout(FEISHU_FETCH_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Lark User Detail API returned status ${response.status}: ${body}`);
    }

    const data = (await response.json()) as LarkUserDetailResponse;
    if (data.code !== 0 || !data.data?.user) {
      throw new Error(`Lark User Detail API returned error code ${data.code}: ${data.msg}`);
    }

    return {
      departmentIds: data.data.user.department_ids || [],
    };
  }

  async getDepartmentName(departmentId: string, tenantToken: string, apiDomain: string): Promise<string> {
    const response = await fetch(
      `https://${apiDomain}/open-apis/contact/v3/departments/${departmentId}?department_id_type=open_department_id`,
      {
        headers: {
          'Authorization': `Bearer ${tenantToken}`,
          'Accept-Language': this.acceptLanguage,
        },
        signal: AbortSignal.timeout(FEISHU_FETCH_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Lark Department Detail API returned status ${response.status}: ${body}`);
    }

    const data = (await response.json()) as LarkDepartmentDetailResponse;
    if (data.code !== 0 || !data.data?.department) {
      throw new Error(`Lark Department Detail API returned error code ${data.code}: ${data.msg}`);
    }

    const dept = data.data.department;
    console.log(`[LarkAdapter] Department payload for ${departmentId}:`, JSON.stringify(dept));

    // Fallback logic for department name (name -> i18n_name.en_us -> i18n_name.zh_cn -> i18n_name.ja_jp -> departmentId)
    const name = dept.name || 
                 dept.i18n_name?.en_us || 
                 dept.i18n_name?.zh_cn || 
                 dept.i18n_name?.ja_jp || 
                 departmentId;

    return name;
  }

  async getDepartmentsList(tenantToken: string, apiDomain: string): Promise<Map<string, string>> {
    const departmentMap = new Map<string, string>();
    let pageToken = '';
    let hasMore = false;

    do {
      const url = new URL(`https://${apiDomain}/open-apis/contact/v3/departments/0/children`);
      url.searchParams.set('fetch_child', 'true');
      url.searchParams.set('page_size', '50');
      if (pageToken) {
        url.searchParams.set('page_token', pageToken);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${tenantToken}`,
          'Accept-Language': this.acceptLanguage,
        },
        signal: AbortSignal.timeout(FEISHU_FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`[LarkAdapter] List departments children failed:`, body);
        break;
      }

      const data = (await response.json()) as any;
      if (data.code !== 0 || !data.data?.items) {
        console.error(`[LarkAdapter] List departments children returned error code ${data.code}: ${data.msg || ''}`);
        break;
      }

      console.log(`[LarkAdapter] Retrieved ${data.data.items.length} departments from list children.`);
      for (const item of data.data.items) {
        if (item.open_department_id && item.name) {
          departmentMap.set(item.open_department_id, item.name);
        }
      }

      hasMore = !!data.data.has_more;
      pageToken = data.data.page_token || '';
    } while (hasMore && pageToken);

    return departmentMap;
  }

  async getFunctionalRolesList(tenantToken: string, apiDomain: string): Promise<Map<string, string>> {
    const roleMap = new Map<string, string>();
    let pageToken = '';
    let hasMore = false;

    do {
      const url = new URL(`https://${apiDomain}/open-apis/contact/v2/role/list`);
      url.searchParams.set('page_size', '50');
      if (pageToken) {
        url.searchParams.set('page_token', pageToken);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${tenantToken}`,
          'Accept-Language': this.acceptLanguage,
        },
        signal: AbortSignal.timeout(FEISHU_FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`[LarkAdapter] List roles (v2) failed:`, body);
        break;
      }

      const data = (await response.json()) as any;
      if (data.code !== 0 || !data.data?.role_list) {
        console.error(`[LarkAdapter] List roles (v2) returned error code ${data.code}: ${data.msg || ''}`);
        break;
      }

      console.log(`[LarkAdapter] Retrieved ${data.data.role_list.length} roles from v2 list.`);
      for (const item of data.data.role_list) {
        if (item.id && item.name) {
          roleMap.set(item.id, item.name);
        }
      }

      hasMore = !!data.data.has_more;
      pageToken = data.data.page_token || '';
    } while (hasMore && pageToken);

    return roleMap;
  }

  async getFunctionalRoleMembers(roleId: string, tenantToken: string, apiDomain: string): Promise<string[]> {
    const memberIds: string[] = [];
    let pageToken = '';
    let hasMore = false;

    // Custom roles (v2) start with 'or_'
    const isV2 = roleId.startsWith('or_');

    do {
      let urlStr = '';
      if (isV2) {
        urlStr = `https://${apiDomain}/open-apis/contact/v2/role/members?role_id=${roleId}&page_size=100`;
        if (pageToken) {
          urlStr += `&page_token=${pageToken}`;
        }
      } else {
        urlStr = `https://${apiDomain}/open-apis/contact/v3/functional_roles/${roleId}/members?user_id_type=open_id&page_size=100`;
        if (pageToken) {
          urlStr += `&page_token=${pageToken}`;
        }
      }

      const response = await fetch(urlStr, {
        headers: {
          'Authorization': `Bearer ${tenantToken}`,
        },
        signal: AbortSignal.timeout(FEISHU_FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Lark Role Members API returned status ${response.status}: ${body}`);
      }

      const data = (await response.json()) as any;
      if (data.code !== 0 || !data.data) {
        throw new Error(`Lark Role Members API returned error code ${data.code}: ${data.msg}`);
      }

      if (isV2) {
        const users = data.data.user_list || [];
        for (const user of users) {
          const mId = user.open_id || user.user_id;
          if (mId) {
            memberIds.push(mId);
          }
        }
      } else {
        const members = data.data.members || [];
        for (const member of members) {
          if (member.member_id) {
            memberIds.push(member.member_id);
          }
        }
      }

      hasMore = !!data.data.has_more;
      pageToken = data.data.page_token || '';
    } while (hasMore && pageToken);

    return memberIds;
  }
}
