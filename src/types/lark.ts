export type LarkTenantAccessTokenResponse = {
  code: number;
  msg: string;
  tenant_access_token: string;
  expire: number;
};

export type LarkUserDetailResponse = {
  code: number;
  msg: string;
  data: {
    user: {
      department_ids: string[];
      [key: string]: any;
    };
  };
};

export type LarkDepartmentDetailResponse = {
  code: number;
  msg: string;
  data: {
    department: {
      name: string;
      [key: string]: any;
    };
  };
};

export type LarkFunctionalRoleMembersResponse = {
  code: number;
  msg: string;
  data: {
    members: Array<{
      member_id: string;
      [key: string]: any;
    }>;
    has_more?: boolean;
    page_token?: string;
  };
};
