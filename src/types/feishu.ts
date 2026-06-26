// Default Feishu (China) endpoints — used as fallback when no endpoints are provided.
export const FeishuEndpoints = {
  /** GET {@link FeishuAuthRequestParams} */
  OAuth2Auth: 'https://accounts.feishu.cn/open-apis/authen/v1/authorize' as const,
  /** POST {@link FeishuAccessTokenRequest}: {@link FeishuAccessTokenResponse} */
  OAuth2Token: 'https://open.feishu.cn/open-apis/authen/v2/oauth/token' as const,
  /** GET: {@link FeishuUserInfoResponse} */
  UserInfo: 'https://open.feishu.cn/open-apis/authen/v1/user_info' as const,
};

export function getFeishuEndpoints(larkMode?: string | boolean) {
  const isLark = larkMode === 'true' || larkMode === true;
  const authDomain = isLark ? 'accounts.larksuite.com' : 'accounts.feishu.cn';
  const apiDomain = isLark ? 'open.larksuite.com' : 'open.feishu.cn';

  return {
    OAuth2Auth: `https://${authDomain}/open-apis/authen/v1/authorize`,
    OAuth2Token: `https://${apiDomain}/open-apis/authen/v2/oauth/token`,
    UserInfo: `https://${apiDomain}/open-apis/authen/v1/user_info`,
  };
}

/**
 * ```http
 * GET https://accounts.feishu.cn/open-apis/authen/v1/authorize HTTP/1.1
 * ```
 * @see https://open.feishu.cn/document/authentication-management/access-token/obtain-oauth-code
 * @example
 * ```
 * "https://accounts.feishu.cn/open-apis/authen/v1/authorize?client_id=cli_a5d611352af9d00b&redirect_uri=https%3A%2F%2Fexample.com%2Fapi%2Foauth%2Fcallback&scope=bitable:app:readonly%20contact:contact&state=RANDOMSTRING"
 * ```
 */
export type FeishuAuthRequestParams = {
  /**
   * App ID of the application, which can be viewed on the **Credentials and Basic Info** page in the Developer Console. For detailed information about App ID, please refer to [Common Parameters](https://open.feishu.cn/document/ukTMukTMukTM/uYTM5UjL2ETO14iNxkTN/terminology).
   *
   * @example "cli_a5d611352af9d00b"
   */
  client_id: string;
  /**
   * Application redirect address. After successful user authorization, it will jump to this address, carrying the `code` and `state` parameters (if the `state` parameter was passed).
   *
   * **Please note**:
   * 1. This address must be URL encoded;
   * 2. Before calling this interface, you need to configure the HTTP GET request interface address used to receive OAuth callbacks as the application's redirect URL on the application security settings page in the developer console.
   * Multiple redirect URLs are supported. Only the URLs in the redirect URL list will pass the security verification of the open platform. For details, please refer to configuring redirect domains.
   *
   * @example "https://example.com/api/oauth/callback"
   */
  redirect_uri: string;
  /**
   * The permissions that the user needs to incrementally grant to the application.
   *
   * **Format requirements**: The `scope` parameter is a space-separated, case-sensitive string.
   *
   * Note:
   * - Developers need to autonomously concatenate the `scope` parameter after applying for the necessary `scope` for calling OpenAPI in the **Permissions Management** module of the [Developer Console](https://open.larkoffice.com/app) according to business scenarios.
   * If the corresponding permissions are not applied for the application in the application backend, users will encounter a 20027 error when actually using the application.
   * - An application can request users to grant up to 50 scopes at a time. For details, refer to the API Permissions List.
   * - If `refresh_token` is needed later, the `offline_access` permission must be added here. For details, refer to [Refresh `user_access_token`](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/authentication-management/access-token/refresh-user-access-token).
   *
   * @example "contact:contact bitable:app:readonly"
   */
  scope?: string;
  /**
   * Additional string used to maintain the state between the request and callback. It will be returned as is during the authorization completion callback.
   * The application can use this string to determine the context, and this parameter can also be used to prevent CSRF attacks. Be sure to check whether the `state` parameter is consistent before and after.
   *
   * @example "RANDOMSTRING"
   */
  state?: string | null;
  /**
   * Used to enhance the security of the authorization code through the PKCE (Proof Key for Code Exchange) flow.
   *
   * @see https://datatracker.ietf.org/doc/html/rfc7636
   * @example "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
   */
  code_challenge?: string;
  /**
   * The method to generate code_challenge.
   *
   * **Optional values**:
   *
   * 1. `S256` (Recommended):
   * Use the SHA-256 hash algorithm to calculate the hash value of `code_verifier`, and Base64URL encode the result to generate `code_challenge`.
   * 2. `plain` (Default):
   * Use `code_verifier` directly as `code_challenge` without any additional processing.
   *
   * The above `code_verifier` refers to a random string generated locally before initiating the authorization.
   */
  code_challenge_method?: string;
};

/**
 * ```http
 * GET https://accounts.feishu.cn/open-apis/authen/v1/authorize HTTP/1.1
 * ```
 * @see https://open.feishu.cn/document/authentication-management/access-token/obtain-oauth-code
 * @example
 * "https://example.com/api/oauth/callback?code=2Wd5g337vo5BZXUz-3W5KECsWUmIzJ_FJ1eFD59fD1AJIibIZljTu3OLK-HP_UI1&state=RANDOMSTRING"
 */
export type FeishuAuthResponse = {
  /**
   * Authorization code, used to obtain `user_access_token`.
   *
   * **Character set**: [A-Z] / [a-z] / [0-9] / "-" / "_"
   *
   * **Length**: Developers are requested to reserve at least 64 characters
   * @example "2Wd5g337vo5BZXUz-3W5KECsWUmIzJ_FJ1eFD59fD1AJIibIZljTu3OLK-HP_UI1"
   */
  code: string;
  /** The original value of the `state` parameter passed when opening the authorization page. It will not be returned if not passed. */
  state?: string;
};

/**
 * ```http
 * POST https://open.feishu.cn/open-apis/authen/v2/oauth/token HTTP/1.1
 * ```
 * @see https://open.feishu.cn/document/authentication-management/access-token/get-user-access-token
 * @example
 * ```json
 * {
 *   "grant_type": "authorization_code",
 *   "client_id": "cli_a5ca35a685b0x26e",
 *   "client_secret": "baBqE5um9LbFGDy3X7LcfxQX1sqpXlwy",
 *   "code": "a61hb967bd094dge949h79bbexd16dfe",
 *   "redirect_uri": "https://example.com/api/oauth/callback",
 *   "code_verifier": "TxYmzM4PHLBlqm5NtnCmwxMH8mFlRWl_ipie3O0aVzo"
 * }
 * ```
 */
export type FeishuAccessTokenRequest = {
  /**
   * Authorization type.
   *
   * **Fixed value**: `authorization_code`
   */
  grant_type: "authorization_code";
  /**
   * App ID of the application.
   *
   * @example "cli_a5ca35a685b0x26e"
   */
  client_id: string;
  /**
   * App Secret of the application.
   *
   * @example "baBqE5um9LbFGDy3X7LcfxQX1sqpXlwy"
   */
  client_secret: string;
  /**
   * Authorization code.
   *
   * @see https://open.feishu.cn/document/common-capabilities/sso/api/obtain-oauth-code
   * @example "a61hb967bd094dge949h79bbexd16dfe"
   */
  code: string;
  /**
   * The application callback address spliced when constructing the authorization page link.
   *
   * > Required for web application authorization scenarios, and must be **strictly** consistent with the `redirect_uri` set when obtaining the authorization code. No need to pass it for mini-program authorization scenarios.
   *
   * @example "https://example.com/api/oauth/callback"
   */
  redirect_uri?: string;
  /**
   * A random string generated locally before initiating authorization, used for the PKCE (Proof Key for Code Exchange) process. This value is required when using PKCE.
   *
   * **Length limit**: Minimum 43 characters, maximum 128 characters
   *
   * **Available character set**: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
   *
   * @see https://datatracker.ietf.org/doc/html/rfc7636
   * @example "TxYmzM4PHLBlqm5NtnCmwxMH8mFlRWl_ipie3O0aVzo"
   */
  code_verifier?: string;
  /**
   * This parameter is used to reduce the permission scope of `user_access_token`.
   *
   * For example:
   * 1. When [obtaining the authorization code](https://open.feishu.cn/document/common-capabilities/sso/api/obtain-oauth-code), three permissions were authorized through the `scope` parameter: `contact:user.base:readonly`, `contact:contact.base:readonly`, `contact:user.employee:readonly`.
   * 2. In the current interface, `contact:user.base:readonly` can be passed in through the `scope` parameter to reduce the permissions of the `user_access_token` to just this one `contact:user.base:readonly`.
   *
   * **Note**:
   * - If the current parameter is not specified, the generated `user_access_token` will contain all permissions authorized by the user.
   * - Duplicate permissions cannot be passed in this parameter, otherwise the interface call will error, returning error code 20067.
   * - Unauthorized permissions cannot be passed in this parameter (i.e. permissions outside the range already authorized by the user when [obtaining the authorization code](https://open.feishu.cn/document/common-capabilities/sso/api/obtain-oauth-code)), otherwise the interface call will error, returning error code 20068.
   * - Calling this interface multiple times to reduce the permission scope will not stack.
   * For example, if the user grants permissions A and B, the first call to this interface reduces to permission A, then the `user_access_token` only contains permission A; the second call reduces to permission B, then the `user_access_token` only contains permission B.
   * - The effective permission list can be viewed through the `scope` return value of this interface.
   *
   * **Format requirements**: Space-separated `scope` list
   *
   * Example value: "auth:user.id:read task:task:read"
   */
  scope?: string;
};

/**
 * @see {@linkcode FeishuAccessTokenResponse}
 */
type FeishuAccessTokenSuccessResponse = {
  /** Error code, 0 indicates request success, non-zero indicates failure */
  code: 0;
  /** Namely `user_access_token` */
  access_token: string;
  /** Namely the validity period of `user_access_token` in seconds */
  expires_in: number;
  token_type: "Bearer";
  /** The list of permissions obtained by the `access_token` in this request, separated by spaces */
  scope: string;
};

/**
 * @see {@linkcode FeishuAccessTokenResponse}
 */
type FeishuAccessTokenSuccessResponseWithRefreshToken = FeishuAccessTokenSuccessResponse & {
  /**
   * Used to refresh `user_access_token`, see [Refresh `user_access_token`](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/authentication-management/access-token/refresh-user-access-token) for details.
   * This field is only returned when the request is successful and the user grants the `offline_access` permission.
   */
  refresh_token: string;
  /** Namely the validity period of `refresh_token` in seconds, only returned when `refresh_token` is returned. */
  refresh_token_expires_in: number;
};

/**
 * @see {@linkcode FeishuAccessTokenResponse}
 */
export type FeishuAccessTokenErrorResponse = {
  /** Error code, 0 indicates request success, non-zero indicates failure */
  code: number;
  /** Error type */
  error: string;
  /** Specific error information */
  error_description: string;
};

/**
 * ```http
 * POST https://open.feishu.cn/open-apis/authen/v2/oauth/token HTTP/1.1
 * ```
 * @see https://open.feishu.cn/document/authentication-management/access-token/get-user-access-token
 * @example
 * **Success Response**
 * ```json
 * {
 *   "code": 0,
 *   "access_token": "eyJhbGciOiJFUzI1NiIs**********X6wrZHYKDxJkWwhdkrYg",
 *   "expires_in": 7200, // Non-fixed value, please be sure to determine the validity of the access_token according to the actual value returned in the response body
 *   "refresh_token": "eyJhbGciOiJFUzI1NiIs**********XXOYOZz1mfgIYHwM8ZJA",
 *   "refresh_token_expires_in": 604800, // Non-fixed value, please be sure to determine the validity of the refresh_token according to the actual value returned in the response body
 *   "scope": "auth:user.id:read offline_access task:task:read user_profile",
 *   "token_type": "Bearer"
 * }
 * ```
 *
 * @example
 * **Error Response**
 * ```json
 * {
 *   "code": 20050,
 *   "error": "server_error",
 *   "error_description": "An unexpected server error occurred. Please retry your request."
 * }
 * ```
 */
export type FeishuAccessTokenResponse = FeishuAccessTokenSuccessResponse | FeishuAccessTokenSuccessResponseWithRefreshToken | FeishuAccessTokenErrorResponse;

/**
 * @see {@linkcode FeishuUserInfoResponse}
 */
export type FeishuUserInfo = {
  /** User's name */
  name: string;
  /** User's English name */
  en_name: string;
  /** User's avatar */
  avatar_url: string;
  /** User's avatar 72x72 */
  avatar_thumb: string;
  /** User's avatar 240x240 */
  avatar_middle: string;
  /** User's avatar 640x640 */
  avatar_big: string;
  /** User's unique identifier within the application */
  open_id: string;
  /** User's unique identifier for the ISV. For the same ISV, the user's union_id is the same across all its applications */
  union_id: string;
  /**
   * User's email.
   * The email information is the user contact method imported by the administrator. It has not been verified in real-time by the user themselves. It is not recommended for developers to directly use it as the login credential for business systems.
   * If used, please authenticate it yourself.
   */
  email: string;
  /** Enterprise email, please first ensure that the Feishu email service is enabled in the management backend */
  enterprise_email: string;
  /** User ID */
  user_id: string;
  /**
   * User's mobile number.
   * The mobile number information is the user contact method imported by the administrator. It has not been verified in real-time by the user themselves. It is not recommended for developers to directly use it as the login credential for business systems.
   * If used, please authenticate it yourself.
   */
  mobile: string;
  /** Current enterprise identifier */
  tenant_key: string;
  /** User's employee number */
  employee_no: string;
};

/**
 * ```http
 * GET https://open.feishu.cn/open-apis/authen/v1/user_info HTTP/1.1
 * ```
 * @see https://open.feishu.cn/document/server-docs/authentication-management/login-state-management/get
 * @example
 * ```json
 * {
 *   "code": 0,
 *   "msg": "success",
 *   "data": {
 *     "name": "zhangsan",
 *     "en_name": "zhangsan",
 *     "avatar_url": "www.feishu.cn/avatar/icon",
 *     "avatar_thumb": "www.feishu.cn/avatar/icon_thumb",
 *     "avatar_middle": "www.feishu.cn/avatar/icon_middle",
 *     "avatar_big": "www.feishu.cn/avatar/icon_big",
 *     "open_id": "ou-caecc734c2e3328a62489fe0648c4b98779515d3",
 *     "union_id": "on-d89jhsdhjsajkda7828enjdj328ydhhw3u43yjhdj",
 *     "email": "zhangsan@feishu.cn",
 *     "enterprise_email": "demo@mail.com",
 *     "user_id": "5d9bdxxx",
 *     "mobile": "+86130002883xx",
 *     "tenant_key": "736588c92lxf175d",
 *     "employee_no": "111222333"
 *   }
 * }
 * ```
 */
export type FeishuUserInfoResponse = {
  /** Error code, non-zero indicates failure */
  code: number;
  /** Error description */
  msg: string;
  data: FeishuUserInfo;
};
