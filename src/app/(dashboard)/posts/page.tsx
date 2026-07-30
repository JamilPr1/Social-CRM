"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  Plus,
  RefreshCw,
  Sparkles,
  Calendar,
  Hash,
  Globe,
  CheckSquare,
  Square,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { fetchAccounts } from "@/lib/client-cache";
import { BoostModal } from "@/components/boost-modal";
import { PostListItem } from "@/components/post-list-item";

interface MetaAccount {
  id: string;
  pageName: string;
  instagramId: string | null;
}

interface Post {
  id: string;
  metaPostId: string;
  metaAccountId: string;
  message: string | null;
  mediaUrl: string | null;
  permalink: string | null;
  publishedAt: string;
  platform?: string;
  linkedInStatus?: string;
  linkedInPostId?: string;
  impressions?: number;
  reactionCount?: number;
  errorMessage?: string | null;
  metaAccount?: { pageName: string };
  _count?: { comments: number };
}

type PlatformFilter = "all" | "facebook" | "instagram" | "linkedin";

interface SeoKeyword {
  id: string;
  keyword: string;
}

interface ScheduledPost {
  id: string;
  message: string;
  platform: string;
  status: string;
  scheduledAt: string | null;
  accountIds: string;
  publishResults: string | null;
}

interface AccountHealth {
  accountId: string;
  pageName: string;
  instagramUsername: string | null;
  canPostFacebook: boolean;
  canPostInstagram: boolean;
  hasInstagramLinked: boolean;
  issues: string[];
}

type ComposePlatform = "all" | "facebook" | "instagram" | "both" | "linkedin";

interface LinkedInAuth {
  authenticated: boolean;
  personName: string | null;
}

type Tab = "published" | "compose" | "scheduled";

export default function PostsPage() {
  const [accounts, setAccounts] = useState<MetaAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformFilter>("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, startSync] = useTransition();
  const [tab, setTab] = useState<Tab>("compose");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [platform, setPlatform] = useState<ComposePlatform>("all");
  const [includeLinkedIn, setIncludeLinkedIn] = useState(true);
  const [linkedInAuth, setLinkedInAuth] = useState<LinkedInAuth>({
    authenticated: false,
    personName: null,
  });
  const [imageUrl, setImageUrl] = useState("");
  const [postToAll, setPostToAll] = useState(true);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [savedKeywords, setSavedKeywords] = useState<SeoKeyword[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [scheduled, setScheduled] = useState<ScheduledPost[]>([]);

  const [syncStatus, setSyncStatus] = useState("");
  const [boostPost, setBoostPost] = useState<Post | null>(null);
  const [accountHealth, setAccountHealth] = useState<AccountHealth[]>([]);

  useEffect(() => {
    fetchAccounts<MetaAccount>().then((accs) => {
      setAccounts(accs);
      setSelectedAccountIds(accs.map((a) => a.id));
    });
  }, []);

  const loadPosts = useCallback(async (accountId: string, platform: PlatformFilter, sync = false) => {
    const res = await fetch(
      `/api/posts?accountId=${accountId}&platform=${platform}${sync ? "&sync=true" : ""}`
    );
    const data = await res.json();
    const loaded: Post[] = data.posts || [];
    setPosts(loaded);

    if (data.linkedInSyncNote) {
      setSyncStatus(data.linkedInSyncNote);
    } else if (data.counts) {
      setSyncStatus(
        `Synced — FB: ${data.counts.facebook}, IG: ${data.counts.instagram}, LinkedIn: ${data.counts.linkedin}`
      );
    }
  }, []);

  const loadScheduled = useCallback(async () => {
    const res = await fetch("/api/posts/scheduled");
    const data = await res.json();
    setScheduled(data.scheduled || []);
  }, []);

  useEffect(() => {
    if (tab !== "published") return;
    setLoading(true);
    loadPosts(selectedAccount, selectedPlatform)
      .finally(() => setLoading(false));
  }, [selectedAccount, selectedPlatform, loadPosts, tab]);

  useEffect(() => {
    if (tab === "scheduled") loadScheduled();
  }, [tab, loadScheduled]);

  useEffect(() => {
    if (tab !== "compose") return;
    fetch("/api/seo/keywords")
      .then((r) => r.json())
      .then((d) => setSavedKeywords(d.keywords || []));
    fetch("/api/accounts/health")
      .then((r) => r.json())
      .then((d) => setAccountHealth(d.health || []));
    fetch("/api/linkedin/status")
      .then((r) => r.json())
      .then((d) =>
        setLinkedInAuth({
          authenticated: Boolean(d.auth?.authenticated),
          personName: d.auth?.personName || d.auth?.profile?.name || null,
        })
      );
  }, [tab]);

  const targetAccounts = useMemo(() => {
    if (postToAll) return accounts;
    return accounts.filter((a) => selectedAccountIds.includes(a.id));
  }, [postToAll, selectedAccountIds, accounts]);

  const hasInstagramOnTargets = targetAccounts.some((a) => a.instagramId);

  const targetCount = useMemo(() => {
    let count = 0;
    const publishMeta = platform !== "linkedin";
    const publishLi =
      includeLinkedIn &&
      linkedInAuth.authenticated &&
      (platform === "linkedin" || platform === "all");

    if (publishMeta) {
      if (platform === "facebook" || platform === "all" || platform === "both") {
        count += targetAccounts.length;
      }
      if (
        (platform === "instagram" || platform === "both" || platform === "all") &&
        hasInstagramOnTargets
      ) {
        count += targetAccounts.filter((a) => a.instagramId).length;
      }
    }
    if (publishLi) count += 1;
    return count;
  }, [
    platform,
    includeLinkedIn,
    linkedInAuth.authenticated,
    targetAccounts,
    hasInstagramOnTargets,
  ]);

  useEffect(() => {
    if (!hasInstagramOnTargets && (platform === "instagram" || platform === "both")) {
      setPlatform("facebook");
    }
  }, [hasInstagramOnTargets, platform]);

  function toggleAccount(id: string) {
    setPostToAll(false);
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleKeyword(keyword: string) {
    setSelectedKeywords((prev) =>
      prev.includes(keyword) ? prev.filter((k) => k !== keyword) : [...prev, keyword]
    );
  }

  async function handleAddKeyword(e: React.FormEvent) {
    e.preventDefault();
    if (!keywordInput.trim()) return;
    const res = await fetch("/api/seo/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: keywordInput }),
    });
    const data = await res.json();
    if (res.ok) {
      setSavedKeywords((prev) => {
        if (prev.some((k) => k.keyword === data.keyword.keyword)) return prev;
        return [...prev, data.keyword].sort((a, b) => a.keyword.localeCompare(b.keyword));
      });
      setSelectedKeywords((prev) =>
        prev.includes(data.keyword.keyword) ? prev : [...prev, data.keyword.keyword]
      );
      setKeywordInput("");
    }
  }

  async function handleGenerate() {
    setError("");
    setGenerating(true);
    try {
      const res = await fetch("/api/posts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic || message,
          keywords: selectedKeywords,
          useSavedKeywords: selectedKeywords.length === 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate");
        return;
      }
      setMessage(data.message);
      if (!topic) setTopic(message);
    } catch {
      setError("Failed to generate post");
    } finally {
      setGenerating(false);
    }
  }

  async function handlePublish(publishNow: boolean) {
    setError("");
    setSuccess("");
    setPosting(true);
    try {
      const payload = {
        postToAll,
        accountIds: postToAll ? undefined : selectedAccountIds,
        message,
        platform,
        imageUrl: imageUrl || undefined,
        keywords: selectedKeywords,
        publishNow,
        includeLinkedIn,
        scheduledAt: publishNow ? undefined : scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      };

      const endpoint = publishNow && !scheduledAt ? "/api/posts/bulk" : "/api/posts/scheduled";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to publish");
        return;
      }

      if (publishNow && data.results) {
        const failed = data.results.filter((r: { success: boolean }) => !r.success);
        const ok = data.successCount ?? data.results.filter((r: { success: boolean }) => r.success).length;
        const total = data.total ?? data.results.length;
        if (ok === 0) {
          const details = failed
            .map((r: { pageName: string; platform: string; error?: string }) =>
              `${r.pageName} (${r.platform}): ${r.error || "Failed"}`
            )
            .join("\n");
          setError(details || "Publish failed for all targets");
          return;
        }
        if (failed.length > 0) {
          const details = failed
            .map((r: { pageName: string; platform: string; error?: string }) =>
              `${r.pageName} (${r.platform}): ${r.error}`
            )
            .join(" · ");
          setSuccess(`Published to ${ok} of ${total}. Failed: ${details}`);
        } else {
          setSuccess(`Published to ${ok} of ${total} page(s).`);
        }
      } else if (publishNow) {
        setSuccess("Post published successfully.");
      } else {
        setSuccess("Post scheduled successfully.");
      }

      setTopic("");
      setMessage("");
      setImageUrl("");
      setScheduledAt("");
      await loadScheduled();
      if (selectedAccount) await loadPosts(selectedAccount, selectedPlatform, true);
    } catch {
      setError("Something went wrong");
    } finally {
      setPosting(false);
    }
  }

  function handleSync() {
    startSync(async () => {
      setSyncStatus("");
      let linkedInNote = "";
      if (selectedPlatform === "linkedin" || selectedPlatform === "all") {
        const liRes = await fetch("/api/linkedin/posts?sync=true");
        const liData = await liRes.json();
        if (liData.syncResult?.apiError) {
          linkedInNote = liData.syncResult.apiError;
        }
      }
      if (selectedPlatform !== "linkedin") {
        await fetch(`/api/sync/all?accountId=${selectedAccount}`, { method: "POST" });
      }
      await loadPosts(selectedAccount, selectedPlatform, true);
      if (linkedInNote) {
        setSyncStatus(
          `LinkedIn: ${linkedInNote} Publish from Compose to add posts here.`
        );
      }
    });
  }

  const boostAccountId = boostPost?.metaAccountId || selectedAccount;
  const healthIssues = accountHealth.flatMap((h) => h.issues);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Posts</h1>
          <p className="text-[var(--muted)] mt-1">
            Publish to Facebook, Instagram, and LinkedIn from one place
          </p>
        </div>
        {tab === "published" && (
          <button
            onClick={handleSync}
            disabled={!selectedAccount || syncing}
            className="flex items-center gap-2 border border-[var(--border)] hover:bg-[var(--card-hover)] px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync all"}
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-6 border-b border-[var(--border)]">
        {[
          { id: "compose" as const, label: "Compose", icon: Plus },
          { id: "published" as const, label: "Published", icon: Globe },
          { id: "scheduled" as const, label: "Scheduled", icon: Calendar },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--muted)] hover:text-white"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "compose" && (
        <div className="grid lg:grid-cols-3 gap-6">
          {healthIssues.length > 0 && (
            <div className="lg:col-span-3 bg-red-500/10 border border-red-500/30 rounded-xl p-5 text-sm space-y-3">
              <p className="font-medium text-red-300">Posting blocked — fix these, then reconnect</p>
              <ul className="list-disc list-inside space-y-1 text-[var(--muted)]">
                {[...new Set(healthIssues)].map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href="/accounts"
                  className="px-4 py-2 rounded-lg text-sm bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]"
                >
                  Reconnect Account
                </a>
              </div>
            </div>
          )}
          {accounts.length === 0 && platform !== "linkedin" && (
            <div className="lg:col-span-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="font-medium text-yellow-300">No Meta pages connected</p>
                <p className="text-sm text-[var(--muted)] mt-1">
                  Connect Facebook Pages in Accounts, or choose LinkedIn only below.
                </p>
              </div>
              <a
                href="/accounts"
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] shrink-0"
              >
                Connect Account
              </a>
            </div>
          )}
          {!linkedInAuth.authenticated && (platform === "linkedin" || platform === "all") && (
            <div className="lg:col-span-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="font-medium text-yellow-300">LinkedIn not connected</p>
                <p className="text-sm text-[var(--muted)] mt-1">
                  Connect LinkedIn in Accounts to publish there.
                </p>
              </div>
              <a
                href="/accounts"
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm bg-[#0a66c2] text-white shrink-0"
              >
                Connect LinkedIn
              </a>
            </div>
          )}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 space-y-4">
              <h2 className="font-semibold">Create post</h2>

              {(error || success) && (
                <div
                  className={`px-4 py-3 rounded-lg text-sm border ${
                    error
                      ? "bg-red-500/10 border-red-500/30 text-red-400"
                      : "bg-green-500/10 border-green-500/30 text-green-400"
                  }`}
                >
                  {error || success}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Topic / headline</label>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Summer sale on premium services"
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Post message</label>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generating || (!topic && !message)}
                    className="flex items-center gap-1.5 text-xs text-[var(--primary)] hover:underline disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {generating ? "Generating..." : "Auto-generate with SEO"}
                  </button>
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3 text-sm resize-none focus:outline-none focus:border-[var(--primary)]"
                  placeholder="Write your post or auto-generate from topic + keywords"
                  required
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Platform</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as ComposePlatform)}
                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm"
                  >
                    <option value="all">All platforms (Meta + LinkedIn)</option>
                    <option value="facebook">Facebook only</option>
                    <option value="instagram" disabled={!hasInstagramOnTargets}>
                      Instagram only{!hasInstagramOnTargets ? " (not linked)" : ""}
                    </option>
                    <option value="both" disabled={!hasInstagramOnTargets}>
                      Facebook + Instagram{!hasInstagramOnTargets ? " (IG not linked)" : ""}
                    </option>
                    <option value="linkedin" disabled={!linkedInAuth.authenticated}>
                      LinkedIn only{!linkedInAuth.authenticated ? " (not connected)" : ""}
                    </option>
                  </select>
                  {!hasInstagramOnTargets && (
                    <p className="text-xs text-yellow-400 mt-2">
                      Instagram is not linked to your page yet. Use Facebook only, or link @arfadevelopers in Meta Business Suite.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Schedule (optional)</label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm"
                  />
                </div>
              </div>

              {(platform === "instagram" || platform === "both" || platform === "all") && (
                <div>
                  <label className="block text-sm font-medium mb-2">Image URL (required for Instagram)</label>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm"
                    placeholder="https://..."
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handlePublish(true)}
                  disabled={posting || !message || targetCount === 0}
                  className="px-5 py-2.5 rounded-lg text-sm bg-[var(--primary)] text-white disabled:opacity-50"
                >
                  {posting
                    ? "Publishing..."
                    : `Publish now to ${targetCount} destination${targetCount === 1 ? "" : "s"}`}
                </button>
                {scheduledAt && (
                  <button
                    type="button"
                    onClick={() => handlePublish(false)}
                    disabled={posting || !message || targetCount === 0}
                    className="px-5 py-2.5 rounded-lg text-sm border border-[var(--border)] hover:bg-[var(--card-hover)] disabled:opacity-50"
                  >
                    Schedule post
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">Publish targets</h3>
                <button
                  type="button"
                  onClick={() => {
                    setPostToAll(true);
                    setSelectedAccountIds(accounts.map((a) => a.id));
                    setIncludeLinkedIn(linkedInAuth.authenticated);
                  }}
                  className="text-xs text-[var(--primary)] hover:underline"
                >
                  Select all
                </button>
              </div>

              {platform !== "linkedin" && (
                <>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={postToAll}
                      onChange={(e) => {
                        setPostToAll(e.target.checked);
                        if (e.target.checked) setSelectedAccountIds(accounts.map((a) => a.id));
                      }}
                      className="rounded"
                    />
                    All Meta pages ({accounts.length})
                  </label>

                  {!postToAll && (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {accounts.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => toggleAccount(a.id)}
                          className="flex items-center gap-2 w-full text-left text-sm px-2 py-1.5 rounded hover:bg-[var(--card-hover)]"
                        >
                          {selectedAccountIds.includes(a.id) ? (
                            <CheckSquare className="w-4 h-4 text-[var(--primary)]" />
                          ) : (
                            <Square className="w-4 h-4 text-[var(--muted)]" />
                          )}
                          <span className="truncate">{a.pageName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {(platform === "all" || platform === "linkedin") && (
                <label className="flex items-center gap-2 text-sm cursor-pointer pt-2 border-t border-[var(--border)]">
                  <input
                    type="checkbox"
                    checked={includeLinkedIn}
                    onChange={(e) => setIncludeLinkedIn(e.target.checked)}
                    disabled={!linkedInAuth.authenticated}
                    className="rounded"
                  />
                  <span>
                    LinkedIn
                    {linkedInAuth.authenticated
                      ? ` — ${linkedInAuth.personName || "Connected"}`
                      : " — not connected"}
                  </span>
                </label>
              )}

              {platform !== "linkedin" && accountHealth.length > 0 && (
                <div className="pt-3 border-t border-[var(--border)] space-y-2 text-xs">
                  {accountHealth.map((h) => (
                    <div key={h.accountId} className="text-[var(--muted)]">
                      <p className="font-medium text-white">{h.pageName}</p>
                      <p>Facebook: {h.canPostFacebook ? "✓ Ready" : "✗ Missing permission"}</p>
                      <p>
                        Instagram:{" "}
                        {h.canPostInstagram
                          ? `✓ @${h.instagramUsername}`
                          : h.hasInstagramLinked
                            ? "✗ Missing publish permission"
                            : "✗ Not linked"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-[var(--primary)]" />
                <h3 className="font-medium text-sm">SEO keywords</h3>
              </div>

              <form onSubmit={handleAddKeyword} className="flex gap-2">
                <input
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  placeholder="Add keyword"
                  className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="px-3 py-2 rounded-lg text-sm border border-[var(--border)] hover:bg-[var(--card-hover)]"
                >
                  Add
                </button>
              </form>

              <div className="flex flex-wrap gap-2">
                {savedKeywords.length === 0 ? (
                  <p className="text-xs text-[var(--muted)]">No saved keywords yet</p>
                ) : (
                  savedKeywords.map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => toggleKeyword(k.keyword)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        selectedKeywords.includes(k.keyword)
                          ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                          : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--muted)]"
                      }`}
                    >
                      {k.keyword}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "published" && (
        <>
          <div className="mb-6 flex flex-wrap gap-3">
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value as PlatformFilter)}
              className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--primary)]"
            >
              <option value="all">All platforms</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="linkedin">LinkedIn</option>
            </select>

            {selectedPlatform !== "linkedin" && accounts.length > 0 && (
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--primary)]"
              >
                <option value="all">All pages</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.pageName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {syncStatus && (
            <p className="text-xs text-green-400 mb-4">{syncStatus}</p>
          )}

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-[var(--card)] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-12 text-center text-[var(--muted)]">
              <p className="mb-4">
                {selectedPlatform === "linkedin"
                  ? "No LinkedIn posts yet"
                  : "No posts cached yet"}
              </p>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="text-[var(--primary)] hover:underline text-sm"
              >
                Sync from {selectedPlatform === "linkedin" ? "LinkedIn" : "Meta"}
              </button>
            </div>
          ) : (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="hidden sm:grid grid-cols-[28px_100px_140px_1fr_100px_80px] gap-4 px-4 py-2.5 border-b border-[var(--border)] text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
                <span />
                <span>Platform</span>
                <span>Page</span>
                <span>Post</span>
                <span>Date</span>
                <span className="text-right">Comments</span>
              </div>
              {posts.map((post) => (
                <PostListItem
                  key={post.id}
                  post={post}
                  showPageName={selectedAccount === "all" || selectedPlatform === "linkedin"}
                  canBoost={post.platform !== "linkedin"}
                  onBoost={() => setBoostPost(post)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === "scheduled" && (
        <div className="space-y-4">
          {scheduled.length === 0 ? (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-12 text-center text-[var(--muted)]">
              No scheduled posts yet. Use Compose to schedule content.
            </div>
          ) : (
            scheduled.map((item) => {
              let results: Array<{ pageName: string; success: boolean; error?: string }> = [];
              if (item.publishResults) {
                try {
                  results = JSON.parse(item.publishResults);
                } catch {
                  results = [];
                }
              }
              const accountCount = (() => {
                try {
                  return (JSON.parse(item.accountIds) as string[]).length;
                } catch {
                  return 0;
                }
              })();

              return (
                <div
                  key={item.id}
                  className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm whitespace-pre-wrap line-clamp-3">{item.message}</p>
                      <p className="text-xs text-[var(--muted)] mt-2">
                        {item.platform} · {accountCount} page(s)
                        {item.scheduledAt && ` · ${formatDate(item.scheduledAt)}`}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full shrink-0 ${
                        item.status === "PUBLISHED"
                          ? "bg-green-500/10 text-green-400"
                          : item.status === "FAILED"
                            ? "bg-red-500/10 text-red-400"
                            : "bg-yellow-500/10 text-yellow-400"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  {results.length > 0 && (
                    <div className="mt-3 text-xs text-[var(--muted)] space-y-1">
                      {results.map((r, i) => (
                        <p key={i}>
                          {r.pageName}: {r.success ? "OK" : r.error || "Failed"}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {boostPost && boostAccountId && boostAccountId !== "all" && (
        <BoostModal
          accountId={boostAccountId}
          postId={boostPost.id}
          metaPostId={boostPost.metaPostId}
          postPreview={boostPost.message || undefined}
          onClose={() => setBoostPost(null)}
          onSuccess={() => loadPosts(selectedAccount, selectedPlatform)}
        />
      )}
    </div>
  );
}
