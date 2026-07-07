export interface LarkPort {
  getTenantAccessToken(appId: string, appSecret: string, apiDomain: string): Promise<string>;
  getUserDetail(openId: string, tenantToken: string, apiDomain: string): Promise<{ departmentIds: string[] }>;
  getDepartmentName(departmentId: string, tenantToken: string, apiDomain: string): Promise<string>;
  getDepartmentsList(tenantToken: string, apiDomain: string): Promise<Map<string, string>>;
  getFunctionalRolesList(tenantToken: string, apiDomain: string): Promise<Map<string, string>>;
  getFunctionalRoleMembers(roleId: string, tenantToken: string, apiDomain: string): Promise<string[]>;
}
