/**
 * Configuration interface for NonceManager.
 */
export interface NonceManagerConfig {
  stateNonceKV: KVNamespace;
  codeNonceKV: KVNamespace;
}

/**
 * Manages OAuth2 state and nonce bindings stored in Cloudflare KV storage.
 */
export class NonceManager {
  private stateNonceKV: KVNamespace;
  private codeNonceKV: KVNamespace;

  constructor(config: NonceManagerConfig) {
    this.stateNonceKV = config.stateNonceKV;
    this.codeNonceKV = config.codeNonceKV;
  }

  /**
   * Truncates state/code key to protect storage or comply with limits.
   * Currently uses simple prefix truncation as before.
   */
  private truncateKey(key: string): string {
    return key.substring(0, 256);
  }

  /**
   * Save a state to nonce mapping.
   */
  async saveStateNonce(state: string, nonce: string): Promise<void> {
    await this.stateNonceKV.put(this.truncateKey(state), nonce, {
      expirationTtl: 900, // 15 minutes
    });
  }

  /**
   * Retrieve the nonce mapped to a state.
   */
  async getStateNonce(state: string): Promise<string | null> {
    return await this.stateNonceKV.get(this.truncateKey(state));
  }

  /**
   * Delete a state mapping (used once validation is complete).
   */
  async deleteStateNonce(state: string): Promise<void> {
    await this.stateNonceKV.delete(this.truncateKey(state));
  }

  /**
   * Associate an authorization code with a nonce.
   */
  async associateCodeWithNonce(code: string, nonce: string): Promise<void> {
    await this.codeNonceKV.put(this.truncateKey(code), nonce, {
      expirationTtl: 300, // 5 minutes
    });
  }

  /**
   * Retrieve the nonce mapped to an authorization code.
   */
  async getCodeNonce(code: string): Promise<string | null> {
    return await this.codeNonceKV.get(this.truncateKey(code));
  }

  /**
   * Delete a code-to-nonce mapping (single-use enforcement).
   */
  async deleteCodeNonce(code: string): Promise<void> {
    await this.codeNonceKV.delete(this.truncateKey(code));
  }
}
