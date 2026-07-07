export const testPageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OIDC Provider Diagnostic Console</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['Outfit', 'sans-serif'],
            mono: ['JetBrains Mono', 'monospace'],
          },
        },
      },
    }
  </script>
  <style>
    body {
      background: radial-gradient(circle at 50% 50%, #111827 0%, #030712 100%);
    }
    .glass {
      background: rgba(17, 24, 39, 0.7);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .glow-indigo:hover {
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.4);
    }
  </style>
</head>
<body class="text-gray-100 min-h-screen font-sans selection:bg-indigo-500 selection:text-white pb-12">
  <div class="max-w-4xl mx-auto px-4 pt-10">
    <!-- Header -->
    <header class="flex justify-between items-center mb-8 pb-6 border-b border-gray-800">
      <div>
        <h1 class="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
          OIDC Provider Diagnostic
        </h1>
        <p class="text-sm text-gray-400 mt-1">Interactive OIDC Flow Validator for Lark & Feishu</p>
      </div>
      <div id="env-badge" class="px-3 h-7 flex items-center text-xs font-semibold rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
        Diagnostic Mode Active
      </div>
    </header>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <!-- Left Column: Configuration -->
      <div class="md:col-span-1 space-y-6">
        <div class="glass rounded-2xl p-6">
          <h2 class="text-lg font-semibold mb-4 text-indigo-400 flex items-center">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            Client Config
          </h2>
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Client ID (Lark App ID)</label>
              <input type="text" id="clientId" class="w-full bg-gray-900/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono transition" placeholder="cli_xxxxxxxx">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Client Secret (Lark App Secret)</label>
              <input type="password" id="clientSecret" class="w-full bg-gray-900/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono transition" placeholder="••••••••••••••••">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Requested Scopes</label>
              <input type="text" id="scopes" class="w-full bg-gray-900/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono transition" value="openid profile email">
            </div>
            <div class="pt-2 flex gap-2">
              <button onclick="saveConfig()" class="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg py-2 text-xs font-semibold text-gray-300 transition duration-200">
                Save Config
              </button>
              <button onclick="clearCache()" class="flex-1 bg-red-950/40 hover:bg-red-900/40 border border-red-500/30 rounded-lg py-2 text-xs font-semibold text-red-400 transition duration-200">
                Clear Cache
              </button>
            </div>
          </div>
        </div>

        <div class="glass rounded-2xl p-6 text-xs text-gray-400 space-y-3">
          <h3 class="font-bold text-gray-300 uppercase tracking-wide">Quick Reference</h3>
          <p>
            Make sure to register the dynamic redirect URI in your <strong>Lark Suite Open Platform Developer Console</strong>:
          </p>
          <div class="bg-gray-950 p-2.5 rounded border border-gray-800 font-mono break-all text-[11px] text-indigo-300 select-all" id="callback-uri-ref">
            loading...
          </div>
        </div>
      </div>

      <!-- Right Column: Interactive Steps -->
      <div class="md:col-span-2 space-y-6">
        <!-- Step 1: Authentication -->
        <div id="step-auth" class="glass rounded-2xl p-6 transition duration-300">
          <div class="flex items-start justify-between">
            <div>
              <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold mr-2">1</span>
              <h3 class="inline text-lg font-semibold">User Authentication</h3>
              <p class="text-sm text-gray-400 mt-1 ml-8">Redirect to the authorize endpoint and obtain an authorization code.</p>
            </div>
            <span id="badge-auth" class="text-xs px-2.5 py-0.5 rounded-full bg-gray-800 text-gray-400 font-medium">Pending</span>
          </div>

          <div class="mt-5 ml-8 flex flex-wrap gap-4">
            <button id="btn-login" onclick="startLogin()" class="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2.5 rounded-xl transition duration-200 flex items-center glow-indigo">
              <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clip-rule="evenodd"></path>
              </svg>
              Sign In with Lark/Feishu
            </button>
            <button id="btn-reset" onclick="resetFlow()" class="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 px-4 py-2.5 rounded-xl transition duration-200">
              Reset Flow
            </button>
          </div>
          
          <div id="code-display" class="hidden mt-4 ml-8 p-3 rounded-lg bg-gray-950 border border-gray-800 font-mono text-sm break-all">
            <span class="text-gray-400">Authorization Code:</span> <span id="auth-code" class="text-emerald-400"></span>
          </div>
        </div>

        <!-- Step 2: Token Exchange -->
        <div id="step-token" class="glass opacity-50 rounded-2xl p-6 transition duration-300">
          <div class="flex items-start justify-between">
            <div>
              <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold mr-2">2</span>
              <h3 class="inline text-lg font-semibold">Token Exchange</h3>
              <p class="text-sm text-gray-400 mt-1 ml-8">Exchange the authorization code for access and identity tokens.</p>
            </div>
            <span id="badge-token" class="text-xs px-2.5 py-0.5 rounded-full bg-gray-800 text-gray-400 font-medium">Locked</span>
          </div>

          <div class="mt-5 ml-8">
            <button id="btn-token" onclick="exchangeToken()" disabled class="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-medium px-5 py-2.5 rounded-xl transition duration-200 flex items-center">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m0 0a2 2 0 01-2 2m2-2h3m-3-4H9a4 4 0 00-4 4v7a4 4 0 004 4h9a4 4 0 004-4v-3"></path>
              </svg>
              Exchange Code for Tokens
            </button>

            <!-- Loading spinner -->
            <div id="token-loading" class="hidden mt-4 flex items-center text-sm text-gray-400">
              <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Executing exchange request...
            </div>

            <!-- Error display -->
            <div id="token-error" class="hidden mt-4 p-4 rounded-xl bg-red-950/50 border border-red-500/30 text-red-300 text-sm">
            </div>

            <!-- Token Results Tab -->
            <div id="token-results" class="hidden mt-6 space-y-4">
              <div>
                <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Access Token</h4>
                <div class="bg-gray-950 p-3 rounded-lg border border-gray-800 font-mono text-xs break-all text-purple-300 select-all" id="res-access-token"></div>
              </div>
              <div>
                <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">ID Token (Signed JWT)</h4>
                <div class="bg-gray-950 p-3 rounded-lg border border-gray-800 font-mono text-xs break-all text-indigo-300 select-all" id="res-id-token"></div>
              </div>
              <div class="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
                <h4 class="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2 flex items-center">
                  <svg class="w-4 h-4 mr-1 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                  </svg>
                  Decoded ID Token Claims (OIDC Identity)
                </h4>
                <pre class="text-xs text-emerald-400 font-mono overflow-x-auto whitespace-pre-wrap" id="res-decoded-claims"></pre>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 3: User Info -->
        <div id="step-userinfo" class="glass opacity-50 rounded-2xl p-6 transition duration-300">
          <div class="flex items-start justify-between">
            <div>
              <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-pink-500/20 text-pink-400 text-xs font-bold mr-2">3</span>
              <h3 class="inline text-lg font-semibold">User Profile Verification</h3>
              <p class="text-sm text-gray-400 mt-1 ml-8">Call the userinfo endpoint using the Bearer access token.</p>
            </div>
            <span id="badge-userinfo" class="text-xs px-2.5 py-0.5 rounded-full bg-gray-800 text-gray-400 font-medium">Locked</span>
          </div>

          <div class="mt-5 ml-8 flex items-center gap-4">
            <button id="btn-userinfo" onclick="fetchUserInfo()" disabled class="bg-pink-600 hover:bg-pink-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-medium px-5 py-2.5 rounded-xl transition duration-200 flex items-center">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
              </svg>
              Fetch UserInfo Profile
            </button>
            <label class="inline-flex items-center text-xs text-gray-400 cursor-pointer select-none">
              <input type="checkbox" id="bypassCache" class="rounded bg-gray-900 border-gray-700 text-pink-600 focus:ring-pink-500 focus:ring-offset-gray-900 mr-2">
              Bypass Cache (Force Lark Reload)
            </label>
          </div>

          <!-- Loading spinner -->
          <div id="userinfo-loading" class="hidden mt-4 flex items-center text-sm text-gray-400">
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-pink-500" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Retrieving profile data...
          </div>

          <!-- Error display -->
          <div id="userinfo-error" class="hidden mt-4 p-4 rounded-xl bg-red-950/50 border border-red-500/30 text-red-300 text-sm">
          </div>

          <!-- Profile results -->
          <div id="userinfo-results" class="hidden mt-6 bg-gray-950 border border-gray-800 rounded-xl p-4">
            <pre class="text-xs text-pink-400 font-mono overflow-x-auto whitespace-pre-wrap" id="res-userinfo-data"></pre>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    // Constants
    const STORAGE_KEY = 'oidc_diagnostic_config';
    const REDIRECT_URI = window.location.origin + '/test';

    // State Variables
    let state = {
      clientId: '',
      clientSecret: '',
      scopes: 'openid profile email',
      code: '',
      accessToken: '',
      idToken: ''
    };

    // Initialize UI
    window.addEventListener('DOMContentLoaded', () => {
      // Set redirect URI helper text
      const callbackPrefix = window.location.origin + '/callback/';
      const encodedClientRedirect = encodeURIComponent(REDIRECT_URI);
      document.getElementById('callback-uri-ref').innerText = callbackPrefix + encodedClientRedirect;

      // Load config
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const config = JSON.parse(saved);
          document.getElementById('clientId').value = config.clientId || '';
          document.getElementById('clientSecret').value = config.clientSecret || '';
          document.getElementById('scopes').value = config.scopes || 'openid profile email';
        } catch (e) {
          console.error("Error loading config", e);
        }
      }

      // Check URL parameters (callback handler)
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');
      const errorDesc = urlParams.get('error_description');

      if (code) {
        state.code = code;
        
        // Load configurations into memory
        saveConfigInMemory();

        // UI state update
        document.getElementById('badge-auth').innerText = 'Completed';
        document.getElementById('badge-auth').className = 'text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium';
        document.getElementById('step-auth').classList.add('border-emerald-500/30');
        
        document.getElementById('code-display').classList.remove('hidden');
        document.getElementById('auth-code').innerText = code;

        // Unlock Step 2
        document.getElementById('step-token').classList.remove('opacity-50');
        document.getElementById('badge-token').innerText = 'Ready';
        document.getElementById('badge-token').className = 'text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-medium';
        document.getElementById('btn-token').disabled = false;
        
        // Clean URL state
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (error) {
        document.getElementById('badge-auth').innerText = 'Error';
        document.getElementById('badge-auth').className = 'text-xs px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium';
        document.getElementById('step-auth').classList.add('border-red-500/30');
        alert('Authentication Error: ' + error + '\\n' + (errorDesc || ''));
      }
    });

    function saveConfigInMemory() {
      state.clientId = document.getElementById('clientId').value.trim();
      state.clientSecret = document.getElementById('clientSecret').value.trim();
      state.scopes = document.getElementById('scopes').value.trim();
    }

    function saveConfig() {
      saveConfigInMemory();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        clientId: state.clientId,
        clientSecret: state.clientSecret,
        scopes: state.scopes
      }));
      alert('Configuration saved to browser local storage!');
    }

    function resetFlow() {
      localStorage.removeItem(STORAGE_KEY);
      window.location.href = REDIRECT_URI;
    }

    function startLogin() {
      saveConfigInMemory();
      if (!state.clientId) {
        alert('Please specify Client ID first!');
        return;
      }
      
      const authUrl = new URL(window.location.origin + '/auth');
      authUrl.searchParams.set('client_id', state.clientId);
      authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.set('scope', state.scopes);
      authUrl.searchParams.set('state', 'test-state-' + Math.random().toString(36).substring(2, 10));
      authUrl.searchParams.set('nonce', 'test-nonce-' + Math.random().toString(36).substring(2, 10));

      window.location.href = authUrl.toString();
    }

    async function exchangeToken() {
      saveConfigInMemory();
      if (!state.clientSecret) {
        alert('Please enter your Client Secret (Lark App Secret) to perform the exchange!');
        return;
      }

      const errorDiv = document.getElementById('token-error');
      const loader = document.getElementById('token-loading');
      const results = document.getElementById('token-results');
      
      errorDiv.classList.add('hidden');
      results.classList.add('hidden');
      loader.classList.remove('hidden');

      const formData = new URLSearchParams();
      formData.set('grant_type', 'authorization_code');
      formData.set('client_id', state.clientId);
      formData.set('client_secret', state.clientSecret);
      formData.set('code', state.code);
      formData.set('redirect_uri', REDIRECT_URI);

      try {
        const response = await fetch('/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString()
        });

        const data = await response.json();
        loader.classList.add('hidden');

        if (!response.ok) {
          throw new Error(data.error_description || data.error || 'Failed to exchange token');
        }

        // Save tokens
        state.accessToken = data.access_token;
        state.idToken = data.id_token;

        // Populate results
        document.getElementById('res-access-token').innerText = data.access_token;
        document.getElementById('res-id-token').innerText = data.id_token;

        // Decode JWT client-side for rendering (using TextDecoder to handle UTF-8 characters correctly)
        try {
          const parts = data.id_token.split('.');
          const binary = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const decoded = JSON.parse(new TextDecoder().decode(bytes));
          document.getElementById('res-decoded-claims').innerText = JSON.stringify(decoded, null, 2);
        } catch (jwtErr) {
          document.getElementById('res-decoded-claims').innerText = 'Could not decode ID Token: ' + jwtErr.message;
        }

        results.classList.remove('hidden');

        // Update UI Badge
        document.getElementById('badge-token').innerText = 'Completed';
        document.getElementById('badge-token').className = 'text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium';
        document.getElementById('step-token').classList.add('border-emerald-500/30');

        // Unlock Step 3
        document.getElementById('step-userinfo').classList.remove('opacity-50');
        document.getElementById('badge-userinfo').innerText = 'Ready';
        document.getElementById('badge-userinfo').className = 'text-xs px-2.5 py-0.5 rounded-full bg-pink-500/20 text-pink-400 font-medium';
        document.getElementById('btn-userinfo').disabled = false;

      } catch (err) {
        loader.classList.add('hidden');
        errorDiv.innerText = err.message;
        errorDiv.classList.remove('hidden');

        document.getElementById('badge-token').innerText = 'Failed';
        document.getElementById('badge-token').className = 'text-xs px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium';
        document.getElementById('step-token').classList.add('border-red-500/30');
      }
    }

    async function fetchUserInfo() {
      if (!state.accessToken) {
        alert('Access token is missing!');
        return;
      }

      const errorDiv = document.getElementById('userinfo-error');
      const loader = document.getElementById('userinfo-loading');
      const results = document.getElementById('userinfo-results');

      errorDiv.classList.add('hidden');
      results.classList.add('hidden');
      loader.classList.remove('hidden');

      try {
        const bypass = document.getElementById('bypassCache').checked;
        const url = bypass ? '/userinfo?bypass_cache=true' : '/userinfo';
        const response = await fetch(url, {
          headers: {
            'Authorization': 'Bearer ' + state.accessToken
          }
        });

        const data = await response.json();
        loader.classList.add('hidden');

        if (!response.ok) {
          throw new Error(data.error_description || data.error || 'Failed to fetch userinfo');
        }

        document.getElementById('res-userinfo-data').innerText = JSON.stringify(data, null, 2);
        results.classList.remove('hidden');

        // Update UI Badge
        document.getElementById('badge-userinfo').innerText = 'Completed';
        document.getElementById('badge-userinfo').className = 'text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium';
        document.getElementById('step-userinfo').classList.add('border-emerald-500/30');

      } catch (err) {
        loader.classList.add('hidden');
        errorDiv.innerText = err.message;
        errorDiv.classList.remove('hidden');

        document.getElementById('badge-userinfo').innerText = 'Failed';
        document.getElementById('badge-userinfo').className = 'text-xs px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium';
        document.getElementById('step-userinfo').classList.add('border-red-500/30');
      }
    }

    async function clearCache() {
      if (!confirm('Are you sure you want to clear the organization departments and roles list cache?')) {
        return;
      }
      try {
        const response = await fetch('/clear-cache', {
          method: 'POST'
        });
        const data = await response.json();
        if (response.ok && data.success) {
          alert('Cache cleared successfully!');
        } else {
          alert('Failed to clear cache: ' + (data.error || 'Unknown error'));
        }
      } catch (err) {
        alert('Network error clearing cache: ' + err.message);
      }
    }
  </script>
</body>
</html>
`;
