import { describe, it, expect, vi } from 'vitest';
import { NonceManager } from './nonce';

const createMockKV = () => {
  const store = new Map<string, string>();
  return {
    put: vi.fn(async (key: string, value: string, options?: any) => {
      store.set(key, value);
    }),
    get: vi.fn(async (key: string) => {
      return store.get(key) ?? null;
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  } as unknown as KVNamespace;
};

describe('NonceManager', () => {
  it('should store, retrieve and delete state nonces correctly', async () => {
    const stateNonceKV = createMockKV();
    const codeNonceKV = createMockKV();
    const manager = new NonceManager({ stateNonceKV, codeNonceKV });

    const state = 'test_state_123';
    const nonce = 'test_nonce_456';

    // Save
    await manager.saveStateNonce(state, nonce);
    expect(stateNonceKV.put).toHaveBeenCalledWith(
      state,
      nonce,
      expect.objectContaining({ expirationTtl: 900 })
    );

    // Get
    const retrieved = await manager.getStateNonce(state);
    expect(retrieved).toBe(nonce);
    expect(stateNonceKV.get).toHaveBeenCalledWith(state);

    // Delete
    await manager.deleteStateNonce(state);
    expect(stateNonceKV.delete).toHaveBeenCalledWith(state);
    expect(await manager.getStateNonce(state)).toBeNull();
  });

  it('should associate authorization code with nonce correctly', async () => {
    const stateNonceKV = createMockKV();
    const codeNonceKV = createMockKV();
    const manager = new NonceManager({ stateNonceKV, codeNonceKV });

    const code = 'feishu_code_xyz';
    const nonce = 'nonce_12345';

    await manager.associateCodeWithNonce(code, nonce);
    expect(codeNonceKV.put).toHaveBeenCalledWith(
      code,
      nonce,
      expect.objectContaining({ expirationTtl: 300 })
    );

    const retrieved = await manager.getCodeNonce(code);
    expect(retrieved).toBe(nonce);
    expect(codeNonceKV.get).toHaveBeenCalledWith(code);
  });

  it('should delete code nonce after use (single-use enforcement)', async () => {
    const stateNonceKV = createMockKV();
    const codeNonceKV = createMockKV();
    const manager = new NonceManager({ stateNonceKV, codeNonceKV });

    const code = 'feishu_code_abc';
    const nonce = 'nonce_single_use';

    await manager.associateCodeWithNonce(code, nonce);
    expect(await manager.getCodeNonce(code)).toBe(nonce);

    await manager.deleteCodeNonce(code);
    expect(codeNonceKV.delete).toHaveBeenCalledWith(code);
    expect(await manager.getCodeNonce(code)).toBeNull();
  });

  it('should truncate key to 256 characters', async () => {
    const stateNonceKV = createMockKV();
    const codeNonceKV = createMockKV();
    const manager = new NonceManager({ stateNonceKV, codeNonceKV });

    const longState = 'a'.repeat(300);
    const expectedTruncated = 'a'.repeat(256);
    const nonce = 'some_nonce';

    await manager.saveStateNonce(longState, nonce);
    expect(stateNonceKV.put).toHaveBeenCalledWith(
      expectedTruncated,
      nonce,
      expect.any(Object)
    );

    await manager.getStateNonce(longState);
    expect(stateNonceKV.get).toHaveBeenCalledWith(expectedTruncated);

    await manager.deleteStateNonce(longState);
    expect(stateNonceKV.delete).toHaveBeenCalledWith(expectedTruncated);
  });
});
