# 🌟 Lark Suite (Feishu) OIDC Gateway for Cloudflare Workers

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![OIDC Compliant](https://img.shields.io/badge/Protocol-OIDC%20Compliant-blue)](https://openid.net/connect/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**Connect Lark Suite (Feishu) corporate identity with Cloudflare Zero Trust (Access) seamlessly at the edge.**

---

Lark Suite (Feishu) is a powerful communication and collaboration platform. However, securing your internal websites, admin panels, and apps behind Cloudflare Zero Trust (Access) using Lark identity has historically been difficult because Lark does not offer a native OIDC interface out of the box.

This gateway bridges that gap! It runs on **Cloudflare Workers** at the edge, serving as a lightweight protocol proxy that translates standard OpenID Connect (OIDC) authentication flows from Cloudflare Access into Lark's native OAuth2 protocol.

---

## ⚡ Key Features

* **Dynamic Multi-tenant Architecture**: *Zero hardcoding, zero maintenance!* You don't need to deploy separate workers for each internal application. The gateway dynamically extracts the client's Lark credentials (`App ID` & `App Secret`) from incoming OIDC authorization requests, and routes logins using dynamic callback path encoding.
* **Edge-Native Performance**: Built on Cloudflare Workers, providing lightning-fast login redirects with response times under 50ms, while running at practically zero server cost.
* **Security First**: Utilizes ephemeral Cloudflare KV namespaces to manage OAuth2 states, authorization codes, and replay-protection nonces (`nonce`). Sensitive App Secrets only pass through memory in-transit and are never logged or persisted.
* **Interactive Diagnostic Console**: Test your configurations locally in under 2 minutes using our interactive `/test` diagnostic UI before deploying to production.

---

## 📐 Authentication Flow

```
[User / Browser]
      │
      │ 1. Access internal.company.com
      ▼
[Cloudflare Access] ── (Blocked if unauthenticated)
      │
      │ 2. Redirect to Gateway /auth
      ▼
[OIDC Worker] ── (Dynamically encodes destination redirect_uri into path)
      │
      │ 3. Redirect to Lark login page
      ▼
[Lark OAuth2] ── (User logs in with corporate account)
      │
      │ 4. Redirect with Auth Code to Worker Callback
      ▼
[OIDC Worker] ── (Decodes client destination redirect_uri)
      │
      │ 5. Forward auth code to Cloudflare Access callback
      ▼
[Cloudflare Access]
      │
      │ 6. Exchange code via POST /token (with Client ID & Secret)
      ▼
[OIDC Worker] ── (Retrieves Lark token & user profile, signs OIDC JWT via RS256)
      │
      ▼
[Cloudflare Access] ── (Validates JWT signature via /jwks, evaluates email policy)
      │
      │ 7. Grant access through Tunnel
      ▼
[Cloudflare Tunnel]
      │
      ▼
[Internal Website] (localhost:PORT)
```

---

## 🚀 Quick Start Guide

### Step 1: Clone the Repository & Install Dependencies

```bash
git clone https://github.com/vantt/larksuite-oidc-cloudflare.git
cd larksuite-oidc-cloudflare
pnpm install
```

### Step 2: Generate JWT Signing Keys

The Gateway requires an RSA-256 key pair to sign OIDC ID tokens. Generate your keys by running the included utility script:

```bash
node scripts/generate-keys.js
```

Keep the terminal output handy. It contains:

- **`JWT_KEY_ID`**: Unique ID of the key.
- **`JWT_PUBLIC_KEY_JWK`**: Public key in JSON Web Key format.
- **`JWT_PRIVATE_KEY_PEM`**: Private key in PEM format (escaped into a single line).

---

## 🛠️ Local Testing

You can run and test the complete login flow on your local machine using the built-in diagnostic console:

1. **Configure Local Environment**:
   Create a `.dev.vars` file in the root directory:

   ```env
   ISSUER_BASE_URL=http://localhost:8787
   DOMAIN=example.com
   LARK_MODE=true
   DEBUG_PAGE=true
   JWT_KEY_ID=your-generated-key-id
   JWT_PUBLIC_KEY_JWK=your-generated-jwk-string
   JWT_PRIVATE_KEY_PEM=your-generated-pem-string
   ```

   *(If using Feishu China instead of Lark Suite Global, set `LARK_MODE=false`).*
2. **Add Callback to Lark Developer Console**:
   Register the following local callback URL in your Lark Application under **Developer Console -> Security Settings -> Redirect URLs**:

   ```
   http://localhost:8787/callback/http%3A%2F%2Flocalhost%3A8787%2Ftest
   ```
3. **Launch Local Dev Server**:

   ```bash
   pnpm dev
   ```
4. **Verify Flow**:
   Open `http://localhost:8787/test` in your browser. Enter your Lark application credentials and complete steps 1, 2, and 3 to confirm token exchange and user info retrieval succeed.

---

## 📦 Production Deployment

### 1. Create Cloudflare KV Namespaces

Run the following commands to provision two KV storage namespaces in your Cloudflare account:

```bash
npx wrangler kv namespace create StateNonceKV
npx wrangler kv namespace create CodeNonceKV
```

### 2. Configure bindings in `wrangler.jsonc`

Open `wrangler.jsonc` and replace the placeholder KV namespace IDs with the ones you just created:

```json
  "kv_namespaces": [
    {
      "binding": "StateNonceKV",
      "id": "STATE_NONCE_KV_ID_HERE"
    },
    {
      "binding": "CodeNonceKV",
      "id": "CODE_NONCE_KV_ID_HERE"
    }
  ]
```

### 3. Deploy to Cloudflare Workers

Publish your Worker:

```bash
pnpm deploy
```

Take note of the deployment URL (e.g., `https://larksuite-oidc.yourusername.workers.dev`).

### 4. Configure Production Environment Variables

Go to your Cloudflare Dashboard under **Workers & Pages -> [Your Worker] -> Settings -> Variables** (or use `wrangler secret put`) and set the following:

* **`ISSUER_BASE_URL`**: Deployed Worker URL (e.g., `https://larksuite-oidc.yourusername.workers.dev`, **no trailing slash**).
* **`DOMAIN`**: Default email domain for accounts lacking one (e.g., `yourcompany.com`).
* **`LARK_MODE`**: `true` for Lark Suite (Global) or `false` for Feishu (China).
* **`DEBUG_PAGE`**: Set to `false` in production for security.
* **`JWT_KEY_ID`**: Key ID generated in Step 2.
* **`JWT_PUBLIC_KEY_JWK`**: Public key JWK generated in Step 2.
* **`JWT_PRIVATE_KEY_PEM`**: Private key PEM generated in Step 2 (Save as a **Secret**).
* **`ALLOWED_REDIRECT_URIS`**: Callback URL of your Cloudflare Access tenant:
  `https://<your-team-name>.cloudflareaccess.com/cdn-cgi/access/callback`

---

## 🔌 Integration Setup

### 1. Lark Application (Developer Console)

1. Navigate to **Security Settings** -> **Redirect URLs**.
2. Add your production callback URL (replace `<your-worker-domain>` and `<your-team-name>`):
   ```
   https://<your-worker-domain>/callback/https%3A%2F%2F<your-team-name>.cloudflareaccess.com%2Fcdn-cgi%2Faccess%2Fcallback
   ```
3. Navigate to **Permission Management** and enable:
   * **Required Scopes:**
     * `contact:user.email:readonly` (Required to retrieve and map user email address).
     * `contact:user.base:readonly` (Required to retrieve basic info like name and avatar).
     * `contact:user.id:readonly` (Required to retrieve unique user identifiers like `open_id`).
   * **Optional Scopes:**
     * `contact:user.employee_id:readonly` (Optional: needed if you require employee ID mapping).
     * `directory:employee.base.email:read` (Optional: alternative directory-based email access).
     * `directory:employee.base.enterprise_email:read` (Optional: alternative enterprise email access).
4. Create and release a new application version.

### 2. Cloudflare Zero Trust (Access)

1. Go to **Settings** -> **Authentication** -> **Login methods** -> Click **Add new**.
2. Choose **OpenID Connect**.
3. Configure:
   * **Name**: `Lark` (or Feishu)
   * **App ID**: Lark App ID.
   * **Client Secret**: Lark App Secret.
   * **Auth URL**: `https://<your-worker-domain>/auth`
   * **Token URL**: `https://<your-worker-domain>/token`
   * **Certificate URL**: `https://<your-worker-domain>/jwks`
4. Save and run the built-in OIDC Connection test to verify.

---

## 📖 Deep Dive & Guides

For step-by-step setup guides, refer to the following local documents:

* [Lark OIDC Deployment Guide](docs/deployment-guide.md): Step-by-step configuration for the Lark Suite Open Platform and Cloudflare Access.
* [OIDC Gateway Design Document](docs/lark-oidc-gateway-design.md): In-depth look at dynamic multi-tenancy, sequence flows, state storage, and known limitations.

---

## 🤝 Credits & Acknowledgements

This project is a reorganized and refactored version based on the original work from [BrandonStudio/Feishu-OIDC-Workers](https://github.com/BrandonStudio/Feishu-OIDC-Workers).

---

## 📄 License

Distributed under the Apache License 2.0. See [LICENSE](LICENSE) for more information.
