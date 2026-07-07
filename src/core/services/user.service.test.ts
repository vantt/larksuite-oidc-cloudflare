import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LarkUserService } from './user.service';
import type { LarkPort } from '../ports/lark.port';
import type { CachePort } from '../ports/cache.port';

describe('LarkUserService', () => {
  let mockLarkPort: LarkPort;
  let mockCachePort: CachePort;
  let service: LarkUserService;

  const mockAppId = 'cli_mock_id';
  const mockAppSecret = 'mock_secret';
  const mockApiDomain = 'open.feishu.cn';
  const mockOpenId = 'ou_user_123';
  const mockTenantToken = 't-token_123';

  beforeEach(() => {
    mockLarkPort = {
      getTenantAccessToken: vi.fn().mockResolvedValue(mockTenantToken),
      getUserDetail: vi.fn().mockResolvedValue({ departmentIds: ['od_dept_1', 'od_dept_2'] }),
      getDepartmentName: vi.fn().mockImplementation(async (id) => {
        if (id === 'od_dept_1') return 'Phòng Phát triển';
        if (id === 'od_dept_2') return 'Phòng Marketing';
        return id;
      }),
      getDepartmentsList: vi.fn().mockResolvedValue(new Map([
        ['od_dept_1', 'Phòng Phát triển'],
        ['od_dept_2', 'Phòng Marketing'],
      ])),
      getFunctionalRolesList: vi.fn().mockResolvedValue(new Map([
        ['role_admin', 'Admin Role'],
        ['role_marketing', 'Marketing Role'],
      ])),
      getFunctionalRoleMembers: vi.fn().mockImplementation(async (roleId) => {
        if (roleId === 'role_admin') return [mockOpenId]; // User is direct member
        if (roleId === 'role_marketing') return ['od_dept_2']; // Department is member
        return [];
      }),
    };

    const cacheStore = new Map<string, string>();
    mockCachePort = {
      get: vi.fn().mockImplementation(async (key) => cacheStore.get(key) ?? null),
      put: vi.fn().mockImplementation(async (key, value) => {
        cacheStore.set(key, value);
      }),
    };

    service = new LarkUserService(mockLarkPort, mockCachePort);
  });

  it('should fetch user detail, departments, and functional roles correctly (no cache)', async () => {
    const result = await service.getUserExtendedInfo({
      openId: mockOpenId,
      appId: mockAppId,
      appSecret: mockAppSecret,
      apiDomain: mockApiDomain,
      roleIdsToCheck: ['role_admin', 'role_marketing', 'role_other'],
    });

    expect(mockLarkPort.getTenantAccessToken).toHaveBeenCalledWith(mockAppId, mockAppSecret, mockApiDomain);
    expect(mockLarkPort.getUserDetail).toHaveBeenCalledWith(mockOpenId, mockTenantToken, mockApiDomain);
    expect(mockLarkPort.getDepartmentsList).toHaveBeenCalledTimes(1);

    expect(result.departmentIds).toEqual(['od_dept_1', 'od_dept_2']);
    expect(result.departments).toEqual(['phong-phat-trien', 'phong-marketing']);
    expect(result.functionalRoles).toEqual(['role_admin', 'role_marketing']); // admin (direct) and marketing (via department)

    // Verify cache updates
    expect(mockCachePort.put).toHaveBeenCalledWith(
      'cache:departments_list',
      JSON.stringify([['od_dept_1', 'Phòng Phát triển'], ['od_dept_2', 'Phòng Marketing']]),
      { expirationTtl: 3600 }
    );
    expect(mockCachePort.put).toHaveBeenCalledWith(
      'cache:role_members:role_admin',
      JSON.stringify([mockOpenId]),
      { expirationTtl: 600 }
    );
  });

  it('should reuse cached departments list and cached role members', async () => {
    // Populate cache first
    await mockCachePort.put(
      'cache:departments_list',
      JSON.stringify([['od_dept_1', 'Phòng IT Cũ'], ['od_dept_2', 'Phòng Marketing']])
    );
    await mockCachePort.put(
      'cache:role_members:role_admin',
      JSON.stringify([mockOpenId])
    );

    const result = await service.getUserExtendedInfo({
      openId: mockOpenId,
      appId: mockAppId,
      appSecret: mockAppSecret,
      apiDomain: mockApiDomain,
      roleIdsToCheck: ['role_admin'],
    });

    expect(mockLarkPort.getDepartmentsList).not.toHaveBeenCalled(); // Reused from cache
    expect(mockLarkPort.getFunctionalRoleMembers).not.toHaveBeenCalled(); // Reused from cache

    expect(result.departments).toEqual(['phong-it-cu', 'phong-marketing']);
    expect(result.functionalRoles).toEqual(['role_admin']);
  });

  it('should handle API errors gracefully and return empty structures', async () => {
    mockLarkPort.getTenantAccessToken = vi.fn().mockRejectedValue(new Error('Network Error'));

    const result = await service.getUserExtendedInfo({
      openId: mockOpenId,
      appId: mockAppId,
      appSecret: mockAppSecret,
      apiDomain: mockApiDomain,
      roleIdsToCheck: ['role_admin'],
    });

    expect(result).toEqual({
      departments: [],
      departmentIds: [],
      functionalRoles: [],
    });
  });

  it('should dynamically discover and resolve roles when roleIdsToCheck is empty', async () => {
    const result = await service.getUserExtendedInfo({
      openId: mockOpenId,
      appId: mockAppId,
      appSecret: mockAppSecret,
      apiDomain: mockApiDomain,
      roleIdsToCheck: [],
    });

    expect(mockLarkPort.getFunctionalRolesList).toHaveBeenCalledTimes(1);
    expect(mockLarkPort.getFunctionalRoleMembers).toHaveBeenCalledTimes(2);

    expect(result.departmentIds).toEqual(['od_dept_1', 'od_dept_2']);
    // Returns human-readable role names mapped from the Map!
    expect(result.functionalRoles).toEqual(['admin-role', 'marketing-role']);

    // Verify roles list cache
    expect(mockCachePort.put).toHaveBeenCalledWith(
      'cache:roles_list',
      JSON.stringify([['role_admin', 'Admin Role'], ['role_marketing', 'Marketing Role']]),
      { expirationTtl: 3600 }
    );
  });

  it('should reuse cached roles list on dynamic discovery', async () => {
    // Populate roles list cache
    await mockCachePort.put(
      'cache:roles_list',
      JSON.stringify([['role_admin', 'Admin Role'], ['role_marketing', 'Marketing Role']])
    );

    const result = await service.getUserExtendedInfo({
      openId: mockOpenId,
      appId: mockAppId,
      appSecret: mockAppSecret,
      apiDomain: mockApiDomain,
      roleIdsToCheck: [],
    });

    expect(mockLarkPort.getFunctionalRolesList).not.toHaveBeenCalled(); // Reused from cache
    expect(mockLarkPort.getFunctionalRoleMembers).toHaveBeenCalledTimes(2); // Queried members directly
    expect(result.functionalRoles).toEqual(['admin-role', 'marketing-role']);
  });

  it('should ignore and clear contaminated role members cache (containing user_ids instead of open_ids)', async () => {
    // Populate cache with non-open_id strings (e.g. user_ids)
    await mockCachePort.put('cache:role_members:role_admin', JSON.stringify(['ec53db85', 'ab6f2135']));

    const result = await service.getUserExtendedInfo({
      openId: mockOpenId,
      appId: mockAppId,
      appSecret: mockAppSecret,
      apiDomain: mockApiDomain,
      roleIdsToCheck: ['role_admin'],
    });

    // Should fetch from Lark again instead of using cache because it was contaminated!
    expect(mockLarkPort.getFunctionalRoleMembers).toHaveBeenCalledWith('role_admin', mockTenantToken, mockApiDomain);
    expect(result.functionalRoles).toEqual(['role_admin']); // Admin Role resolved since mockOpenId belongs to role_admin
  });
});
