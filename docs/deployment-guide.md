# Detailed Deployment Guide: Cloudflare Access + Lark OIDC Provider (Worker)

This project provides an **OIDC Provider** running on Cloudflare Workers (`fg-oidc`), acting as a proxy gateway to translate the authentication protocol of Lark Suite (or Feishu) into the standard OpenID Connect (OIDC) protocol supported by Cloudflare Access.

---

## Authentication Flow Architecture

```
[User / Browser]
      │
      │ 1. Access internal.company.com
      ▼
[Cloudflare Access] ── (Blocked if unauthenticated)
      │
      │ 2. Redirect to Worker Auth URL
      ▼
[OIDC Worker] ── (Automatically encodes client's redirect_uri into the path)
      │
      │ 3. Redirect to Lark login
      ▼
[Lark OAuth2] ── (User enters company credentials)
      │
      │ 4. Redirect with Auth Code to Worker Callback
      ▼
[OIDC Worker] ── (Reads Code, decodes client's redirect_uri)
      │
      │ 5. Redirect with Code to Cloudflare Access callback
      ▼
[Cloudflare Access]
      │
      │ 6. Send POST /token to Worker (with Client ID & Secret)
      ▼
[OIDC Worker]
      │ 7. Call Lark API to exchange code for Access Token & User Info
      │ 8. Sign ID Token JWT using private RS256 key
      │ 9. Return ID Token & Access Token to Access
      ▼
[Cloudflare Access] ── (Validates JWT using JWKS, matches email policy)
      │
      │ 10. Allow traffic through Tunnel
      ▼
[Cloudflare Tunnel]
      │
      ▼
[Internal Website] (localhost:PORT)
```

---

## Detailed Deployment Steps

### Step 1 — Create Lark App on Open Platform

1. Access the Developer Console:
   - If using Global version (Lark): **https://open.larksuite.com**
   - If using China version (Feishu): **https://open.feishu.cn**
2. Create a new application:
   - Select **Create Custom App**.
   - Enter **App Name** (e.g., `Cloudflare Access Auth`) and description.
   - Click **Create**.
3. Retrieve Credentials:
   - Go to **Credentials & Basic Info**.
   - Copy and save **App ID** (Client ID) and **App Secret** (Client Secret).
4. Configure Permissions (Scopes):
   - Go to **Permission Management**.
   - Find and enable the following permissions:
     - **Required Scopes:**
       - `contact:user.email:readonly` (Required to retrieve and map user email address).
       - `contact:user.base:readonly` (Required to retrieve basic info like name and avatar).
       - `contact:user.id:readonly` (Required to retrieve unique user identifiers like `open_id`).
     - **Optional Scopes:**
       - `contact:user.employee_id:readonly` (Optional: needed if you require employee ID mapping).
       - `directory:employee.base.email:read` (Optional: alternative directory-based email access).
       - `directory:employee.base.enterprise_email:read` (Optional: alternative enterprise email access).
5. Publish the application:
   - Go to **Version Management & Release** -> **Create a version**.
   - Enter version details, and set availability scope to all members in the organization.
   - Submit the version for release and approve it (Admin internal approval is instant).

---

### Step 2 — Generate JWT Signing Keys (RS256)

The Worker requires an RSA-256 key pair to sign and verify issued OIDC ID Tokens (JWTs).

Run the utility script included in this project to generate the keys:

```bash
node scripts/generate-keys.js
```

The output in your terminal will contain:

- **`JWT_KEY_ID`**: A random unique identifier for the key (e.g., `f3b6c2d1a5e8f490`).
- **`JWT_PRIVATE_KEY_PEM`**: Private key in PEM format (newlines escaped as `\n` to fit on a single line/env var).
- **`JWT_PUBLIC_KEY_JWK`**: Public key in JSON Web Key (JWK) format which Cloudflare Access will read from the `/jwks` endpoint to verify the JWT signature.

Save these credentials for Step 3 and Step 5.

---

### Step 3 — Local Testing (Recommended) ⚠️ IMPORTANT

Before deploying to Cloudflare Workers production, it is highly recommended to run and verify the authentication flow locally using the interactive diagnostic console.

#### 3.1 Create local variable file `.dev.vars`

Wrangler Dev server simulates local KV storage and reads environment variables from the `.dev.vars` file at the project root:

```env
ISSUER_BASE_URL=http://localhost:8787
DOMAIN=example.com
LARK_MODE=true
DEBUG_PAGE=true
JWT_KEY_ID=5437f0cd4f62f44f
JWT_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC9w81MatQZy8Vp\n..."
JWT_PUBLIC_KEY_JWK='{"kty":"RSA","n":"vcPNTGrUGcvFafSL5BceoqPUviRO2aBsJ-..."}'
```

*(Replace `JWT_KEY_ID`, `JWT_PRIVATE_KEY_PEM`, and `JWT_PUBLIC_KEY_JWK` with the values generated in **Step 2**).*

#### 3.2 Configure Redirect URL on Lark Console for Local

During local testing, the Worker calls the Lark API with `redirect_uri` containing the encoded local callback:
`http://localhost:8787/callback/http%3A%2F%2Flocalhost%3A8787%2Ftest` (or `127.0.0.1` depending on which address you open in your browser).

Since Lark performs exact string matching, you **MUST** configure the exact callback URLs in the **Redirect URLs** section of the Lark App (**Developer Console -> Security Settings -> Redirect URLs**).

> [!WARNING]
> **Troubleshooting Error 20029 (Invalid redirect URL) during local testing:**
>
> Lark treats `localhost` and `127.0.0.1` as distinct hosts. Depending on how you access the local environment, make sure to add the correct URL.
>
> - If you open the test page via: `http://localhost:8787/test`
>   -> Add: `http://localhost:8787/callback/http%3A%2F%2Flocalhost%3A8787%2Ftest`
> - If you open the test page via: `http://127.0.0.1:8787/test`
>   -> Add: `http://localhost:8787/callback/http%3A%2F%2F127.0.0.1%3A8787%2Ftest`
>
> *Tip:* To avoid hostname mismatch errors, it is best to **add both** callback URLs to your Redirect URLs in the Lark Console.

#### 3.3 Start Local Server and Test

1. Run the local development server:
   ```bash
   pnpm dev 
   # or npm run dev
   # or wrangler dev
   ```
2. Open your browser and navigate to: `http://localhost:8787/test`
3. Enter your Lark App's **App ID** and **App Secret** in the form on the left -> click **Save to Local Storage**.
4. Click **Sign In with Lark/Feishu** under **Step 1**.
5. After authenticating on Lark, you will be redirected back to the `/test` page with the authorization `code` populated.
6. Click **Exchange Code for Tokens** under **Step 2** to exchange the code for access/ID tokens.
7. Click **Fetch UserInfo** under **Step 3** to verify user profile retrieval from the `/userinfo` endpoint.

---

### Step 4 — Create Cloudflare KV Namespaces (Production)

Once local testing succeeds, prepare for production deployment. Create two KV namespaces on your Cloudflare account:

```bash
# KV Namespace for storing temporary States and Nonces
npx wrangler kv namespace create StateNonceKV

# KV Namespace for linking temporary Codes and Nonces
npx wrangler kv namespace create CodeNonceKV
```

Open the **`wrangler.jsonc`** file at the project root and update the IDs in the `kv_namespaces` section:

```json
  "kv_namespaces": [
    {
      "binding": "StateNonceKV",
      "id": "YOUR_STATE_NONCE_KV_ID"
    },
    {
      "binding": "CodeNonceKV",
      "id": "YOUR_CODE_NONCE_KV_ID"
    }
  ]
```

---

### Step 5 — Configure Environment Variables & Secrets (Production)

Set up your Worker's environment variables via the Cloudflare Dashboard (or using `wrangler secret put`):

- **`ISSUER_BASE_URL`**: Public URL of your deployed Worker (e.g., `https://lark-oidc.yourdomain.workers.dev`, **no trailing slash `/`**).
- **`DOMAIN`**: Default fallback domain for pseudo emails if the user lacks an email (e.g., `yourcompany.com`).
- **`LARK_MODE`**: Set to `true` if you are using Lark Suite (Global). Set to `false` or omit if you use Feishu (China).
- **`DEBUG_PAGE`**: Set to `false` in production to disable the `/test` page for security.
- **`JWT_KEY_ID`**: Key ID generated in Step 2.
- **`JWT_PUBLIC_KEY_JWK`**: Public key JWK generated in Step 2.
- **`JWT_PRIVATE_KEY_PEM`**: Private key PEM generated in Step 2 (configure as a **Secret**).
- **`ALLOWED_REDIRECT_URIS`**: Callback URL of your Cloudflare Access tenant:
  `https://<your-team-name>.cloudflareaccess.com/cdn-cgi/access/callback`

---

### Step 6 — Deploy Worker to Production

Deploy the Worker to Cloudflare:

```bash
pnpm deploy # or npm run deploy
```

Save the generated Worker URL (e.g., `https://larksuite-oidc.username.workers.dev`).

---

### Step 7 — Register Redirect URLs on Lark Console (Production)

Go to your Lark App in the Developer Console (**Developer Console -> Security Settings -> Redirect URLs**) and add the production callback URL.

Replace `<your-worker-domain>` with your Worker's domain (Step 6) and `<your-team-name>` with your Cloudflare Zero Trust team name:

```
https://<your-worker-domain>/callback/https%3A%2F%2F<your-team-name>.cloudflareaccess.com%2Fcdn-cgi%2Faccess%2Fcallback
```

---

### Step 8 — Configure Cloudflare Zero Trust (Access)

1. Log in to the Cloudflare Zero Trust Dashboard: **https://one.dash.cloudflare.com**
2. Navigate to **Settings** -> **Authentication** -> **Login methods** -> **Add new** -> select **OpenID Connect**.
3. Enter the OIDC IdP details:
   - **Name**: `Lark` or `Feishu` (The label displayed on the login page).
   - **App ID (Client ID)**: Enter your Lark App ID.
   - **Client Secret**: Enter your Lark App Secret.
   - **OIDC Gateway Configuration**:
     - **Auth URL**: `https://<your-worker-domain>/auth`
     - **Token URL**: `https://<your-worker-domain>/token`
     - **Certificate URL**: `https://<your-worker-domain>/jwks`
4. Scroll down and click **Save**.
5. Click **Test** next to the newly created login method. A popup will prompt you to log in to Lark. If successful, you will see a message: `"Your connection is working"`.

---

### Step 9 — Create Access Application & Policy

1. Go to **Access** -> **Applications** -> **Add an Application** -> select **Self-hosted**.
2. Enter basic settings:
   - **Application Name**: e.g., `Internal Wiki`.
   - **Subdomain & Domain**: Subdomain pointing to your internal site (e.g., `wiki.yourcompany.com`).
3. Click **Next**.
4. Configure Policy:
   - **Policy Name**: e.g., `Allow employees`.
   - **Action**: Select `Allow`.
   - **Include rule**: Select `Emails ending in` and enter `@yourcompany.com` to allow all employees with the corporate email domain.
5. Click **Next**.
6. Under **Authentication**: Check the box for **Lark** (or your OIDC IdP Name).
7. Click **Save**.

---

### Step 10 — Deploy Cloudflare Tunnel for Internal Site

1. Go to **Networks** -> **Tunnels** -> **Create a tunnel**.
2. Select **Cloudflared** and name the tunnel. Click **Save tunnel**.
3. Run the installation command corresponding to your internal server's OS.
4. Once the connector status is 🟢 **Healthy**, select the **Public Hostnames** tab -> **Add a public hostname**.
5. Fill in the mapping details (must match Step 9):
   - **Subdomain**: `wiki`
   - **Domain**: `yourcompany.com`
   - **Service Type**: `HTTP`
   - **URL**: Local IP/port of the application (e.g., `localhost:8080`).
6. Click **Save**.
