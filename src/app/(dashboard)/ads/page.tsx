"use client";

import { useCallback, useEffect, useState } from "react";
import { Rocket, RefreshCw, Link2, AlertCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { fetchAccounts } from "@/lib/client-cache";

interface MetaAccount {
  id: string;
  pageName: string;
  adAccountId?: string | null;
  adAccountName?: string | null;
}

interface AdAccount {
  id: string;
  name: string;
  account_status: number;
  currency: string;
}

interface BoostRecord {
  id: string;
  metaPostId: string;
  dailyBudget: number;
  durationDays: number;
  status: string;
  metaCampaignId: string | null;
  metaAdId: string | null;
  errorMessage: string | null;
  createdAt: string;
  post: { message: string | null; mediaUrl: string | null } | null;
}

export default function AdsPage() {
  const [accounts, setAccounts] = useState<MetaAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [boosts, setBoosts] = useState<BoostRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [selectedAdAccount, setSelectedAdAccount] = useState("");

  useEffect(() => {
    fetchAccounts<MetaAccount>().then((accs) => {
      setAccounts(accs);
      if (accs.length > 0) setSelectedAccount(accs.length > 1 ? "all" : accs[0].id);
    });
  }, []);

  const loadData = useCallback(async (accountId: string) => {
    const boostsRes = await fetch(`/api/ads/boost?accountId=${accountId}`);
    const boostsData = await boostsRes.json();
    setBoosts(boostsData.boosts || []);

    if (accountId === "all") {
      setAdAccounts([]);
      setSelectedAdAccount("");
      return;
    }

    const adsRes = await fetch(`/api/ads/accounts?accountId=${accountId}`);
    const ads = await adsRes.json();
    setAdAccounts(ads.adAccounts || []);
    setSelectedAdAccount(ads.linkedAdAccountId || "");
  }, []);

  useEffect(() => {
    if (!selectedAccount) return;
    setLoading(true);
    loadData(selectedAccount).finally(() => setLoading(false));
  }, [selectedAccount, loadData]);

  async function handleLinkAdAccount() {
    if (!selectedAdAccount) return;
    setLinking(true);
    const ad = adAccounts.find((a) => a.id === selectedAdAccount);
    await fetch("/api/ads/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: selectedAccount,
        adAccountId: selectedAdAccount,
        adAccountName: ad?.name,
      }),
    });
    setLinking(false);
    await loadData(selectedAccount);
  }

  const selected = accounts.find((a) => a.id === selectedAccount);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Ads & Boosting</h1>
        <p className="text-[var(--muted)] mt-1">
          Check post eligibility and boost content directly from the CRM
        </p>
      </div>

      {accounts.length > 0 && (
        <div className="mb-6">
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm"
          >
            {accounts.length > 1 && <option value="all">All pages</option>}
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.pageName}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {selectedAccount !== "all" && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Link2 className="w-5 h-5 text-[var(--primary)]" />
            <h2 className="font-semibold">Ad Account</h2>
          </div>

          {loading ? (
            <div className="h-16 bg-[var(--background)] rounded animate-pulse" />
          ) : adAccounts.length === 0 ? (
            <div className="flex items-start gap-2 text-sm text-amber-400">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              <p>
                No ad accounts found. Ensure your Meta account has ads permissions and
                reconnect from Accounts page.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <select
                value={selectedAdAccount}
                onChange={(e) => setSelectedAdAccount(e.target.value)}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm"
              >
                <option value="">Select ad account...</option>
                {adAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency}) {a.account_status !== 1 ? "— Inactive" : ""}
                  </option>
                ))}
              </select>
              {selected?.adAccountId && (
                <p className="text-xs text-[var(--success)]">
                  Linked: {selected.adAccountName || selected.adAccountId}
                </p>
              )}
              <button
                onClick={handleLinkAdAccount}
                disabled={!selectedAdAccount || linking}
                className="text-sm bg-[var(--primary)] text-white px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {linking ? "Linking..." : "Link Ad Account"}
              </button>
            </div>
          )}
        </div>
        )}

        <div className={`bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 ${selectedAccount === "all" ? "lg:col-span-2" : ""}`}>
          <div className="flex items-center gap-2 mb-4">
            <Rocket className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="font-semibold">How Boosting Works</h2>
          </div>
          <ol className="text-sm text-[var(--muted)] space-y-2 list-decimal list-inside">
            <li>Link an ad account above</li>
            <li>Go to Posts and click Boost on any eligible post</li>
            <li>Set budget, duration, and target countries</li>
            <li>CRM creates campaign, ad set, and ad via Meta Marketing API</li>
          </ol>
          <p className="text-xs text-[var(--muted)] mt-4">
            Requires <code className="text-[var(--primary)]">ads_management</code> permission.
            Facebook posts only — Instagram boosts use Ads Manager.
          </p>
        </div>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Boost History</h2>
          <button
            onClick={() => loadData(selectedAccount)}
            className="text-sm text-[var(--muted)] hover:text-white flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-[var(--background)] rounded animate-pulse" />
            ))}
          </div>
        ) : boosts.length === 0 ? (
          <p className="text-sm text-[var(--muted)] text-center py-8">
            No boosts yet. Boost a post from the Posts page.
          </p>
        ) : (
          <div className="space-y-3">
            {boosts.map((boost) => (
              <div
                key={boost.id}
                className="flex items-center justify-between bg-[var(--background)] rounded-lg px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">
                    {boost.post?.message || boost.metaPostId}
                  </p>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    ${(boost.dailyBudget / 100).toFixed(2)}/day · {boost.durationDays} days ·{" "}
                    {formatDate(boost.createdAt)}
                  </p>
                  {boost.errorMessage && (
                    <p className="text-xs text-red-400 mt-1">{boost.errorMessage}</p>
                  )}
                </div>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    boost.status === "ACTIVE"
                      ? "bg-green-500/15 text-green-400"
                      : boost.status === "FAILED"
                        ? "bg-red-500/15 text-red-400"
                        : "bg-gray-500/15 text-gray-400"
                  }`}
                >
                  {boost.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
