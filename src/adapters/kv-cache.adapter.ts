import type { CachePort } from '@/core/ports/cache.port';

export class KVCacheAdapter implements CachePort {
  constructor(private kv: KVNamespace) {}

  async get(key: string): Promise<string | null> {
    return this.kv.get(key);
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    await this.kv.put(key, value, {
      ...(options?.expirationTtl && { expirationTtl: options.expirationTtl }),
    });
  }
}
