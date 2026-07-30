"use client";

import { useEffect, useState } from "react";
import { Rocket, X, AlertCircle, CheckCircle2 } from "lucide-react";

interface BoostModalProps {
  accountId: string;
  postId: string;
  metaPostId: string;
  postPreview?: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface Eligibility {
  eligible: boolean;
  canBoost: boolean;
  reason?: string;
  hasAdAccount: boolean;
  adAccountId?: string;
  adAccountName?: string;
}

export function BoostModal({
  accountId,
  postId,
  metaPostId,
  postPreview,
  onClose,
  onSuccess,
}: BoostModalProps) {
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [boosting, setBoosting] = useState(false);
  const [error, setError] = useState("");
  const [dailyBudget, setDailyBudget] = useState("5");
  const [durationDays, setDurationDays] = useState("7");
  const [countries, setCountries] = useState("US");

  useEffect(() => {
    fetch(`/api/ads/eligibility?accountId=${accountId}&postId=${postId}`)
      .then((r) => r.json())
      .then(setEligibility)
      .finally(() => setLoading(false));
  }, [accountId, postId]);

  async function handleBoost(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBoosting(true);
    try {
      const res = await fetch("/api/ads/boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          postId,
          metaPostId,
          dailyBudget: parseFloat(dailyBudget),
          durationDays: parseInt(durationDays, 10),
          countries: countries.split(",").map((c) => c.trim().toUpperCase()),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to boost post");
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setError("Something went wrong");
    } finally {
      setBoosting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-[var(--primary)]" />
            <h2 className="text-lg font-semibold">Boost Post</h2>
          </div>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {postPreview && (
            <p className="text-sm text-[var(--muted)] line-clamp-2 border-l-2 border-[var(--primary)] pl-3">
              {postPreview}
            </p>
          )}

          {loading ? (
            <div className="h-20 bg-[var(--background)] rounded-lg animate-pulse" />
          ) : eligibility?.canBoost ? (
            <div className="flex items-start gap-2 text-sm text-[var(--success)] bg-green-500/10 border border-green-500/20 rounded-lg p-3">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Eligible for boosting</p>
                <p className="text-[var(--muted)] mt-0.5">
                  Ad account: {eligibility.adAccountName || eligibility.adAccountId}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Cannot boost this post</p>
                <p className="text-[var(--muted)] mt-0.5">
                  {eligibility?.reason ||
                    (!eligibility?.hasAdAccount
                      ? "No ad account linked. Go to Ads page to configure."
                      : "Post is not eligible")}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {eligibility?.canBoost && (
            <form onSubmit={handleBoost} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Daily Budget ($)</label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    step="1"
                    value={dailyBudget}
                    onChange={(e) => setDailyBudget(e.target.value)}
                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Duration (days)</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Target Countries</label>
                <input
                  type="text"
                  value={countries}
                  onChange={(e) => setCountries(e.target.value)}
                  placeholder="US, CA, GB"
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm"
                />
                <p className="text-xs text-[var(--muted)] mt-1">Comma-separated country codes</p>
              </div>
              <p className="text-xs text-[var(--muted)]">
                Estimated total spend: ${(parseFloat(dailyBudget || "0") * parseInt(durationDays || "0", 10)).toFixed(2)}
              </p>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-lg text-sm border border-[var(--border)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={boosting}
                  className="px-4 py-2.5 rounded-lg text-sm bg-[var(--primary)] text-white disabled:opacity-50 flex items-center gap-2"
                >
                  <Rocket className="w-4 h-4" />
                  {boosting ? "Launching..." : "Launch Boost"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
