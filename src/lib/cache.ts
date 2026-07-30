type CacheEntry<T> = { value: T; expiresAt: number };

class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string) {
    this.store.delete(key);
  }
}

export const sessionCache = new TtlCache<boolean>();
export const conversationsCache = new TtlCache<unknown>();
export const linkedInStatusCache = new TtlCache<{
  analyticsAccess: boolean;
  postsListAccess: boolean;
  message: string | null;
}>();
export const linkedInSyncCache = new TtlCache<number>();

export const SYNC_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const LINKEDIN_SYNC_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const LINKEDIN_STATUS_TTL_MS = 60 * 60 * 1000; // 1 hour

export function isStale(lastSyncedAt: Date | null | undefined, ttlMs = SYNC_TTL_MS) {
  if (!lastSyncedAt) return true;
  return Date.now() - lastSyncedAt.getTime() > ttlMs;
}
