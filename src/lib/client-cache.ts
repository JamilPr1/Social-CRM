"use client";

let accountsCache: { data: unknown; expiresAt: number } | null = null;

export async function fetchAccounts<T = unknown>(): Promise<T[]> {
  if (accountsCache && Date.now() < accountsCache.expiresAt) {
    return (accountsCache.data as { accounts: T[] }).accounts;
  }

  const res = await fetch("/api/accounts");
  const data = await res.json();
  accountsCache = { data, expiresAt: Date.now() + 60_000 };
  return data.accounts || [];
}

export function invalidateAccountsCache() {
  accountsCache = null;
}
