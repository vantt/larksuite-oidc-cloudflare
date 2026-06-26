import { FeishuEndpoints } from '@/types/feishu';
import type {
  FeishuAccessTokenRequest,
  FeishuAccessTokenResponse,
  FeishuUserInfoResponse,
} from '@/types/feishu';

export class FeishuClient {
  /**
   * Exchange authorization code for a Feishu user access token.
   */
  static async exchangeCodeForToken(
    params: {
      clientId: string;
      clientSecret: string;
      code: string;
      redirectUri: string;
    },
    endpoints: { OAuth2Token: string } = FeishuEndpoints
  ): Promise<FeishuAccessTokenResponse> {
    try {
      const response = await fetch(endpoints.OAuth2Token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: params.code,
          client_id: params.clientId,
          client_secret: params.clientSecret,
          // CRITICAL: Double-encode the redirect URI because Lark's token API internally
          // URL-decodes this parameter from the JSON body once before comparing it to
          // the redirect URI used during authorization (which was single-decoded by Lark).
          // Double-encoding here ensures that after Lark's internal decode, the string
          // matches the stored authorize redirect URI exactly.
          redirect_uri: encodeURIComponent(params.redirectUri),
        } satisfies FeishuAccessTokenRequest),
      });

      const contentType = response.headers.get('Content-Type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        return {
          code: response.status || -1,
          error: 'server_error',
          error_description: `Feishu Token API returned non-JSON content (status ${response.status}): ${text.substring(0, 100)}`,
        };
      }

      return (await response.json()) as FeishuAccessTokenResponse;
    } catch (error: any) {
      return {
        code: -1,
        error: 'server_error',
        error_description: `Failed to exchange code for token with Feishu: ${error?.message || error}`,
      };
    }
  }

  /**
   * Fetch Feishu user info using an access token.
   */
  static async getUserInfo(
    accessToken: string,
    endpoints: { UserInfo: string } = FeishuEndpoints
  ): Promise<FeishuUserInfoResponse> {
    try {
      const response = await fetch(endpoints.UserInfo, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const contentType = response.headers.get('Content-Type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        return {
          code: response.status || -1,
          msg: `Feishu UserInfo API returned non-JSON content (status ${response.status}): ${text.substring(0, 100)}`,
          data: {} as any,
        };
      }

      return (await response.json()) as FeishuUserInfoResponse;
    } catch (error: any) {
      return {
        code: -1,
        msg: `Failed to fetch user info from Feishu: ${error?.message || error}`,
        data: {} as any,
      };
    }
  }
}
