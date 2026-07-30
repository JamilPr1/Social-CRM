"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  RefreshCw,
  FileText,
  MessageSquare,
  Rocket,
  Inbox,
  Calendar,
  ExternalLink,
  LayoutList,
} from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

interface ActivityItem {
  id: string;
  type: "post" | "comment" | "boost" | "scheduled" | "message";
  accountId: string;
  pageName: string;
  title: string;
  body: string;
  timestamp: string;
  url?: string;
  status?: string;
  author?: string;
}

type Tab = "all" | "post" | "comment" | "boost" | "message" | "scheduled";

const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: "all", label: "All", icon: LayoutList },
  { id: "post", label: "Posts", icon: FileText },
  { id: "comment", label: "Comments", icon: MessageSquare },
  { id: "boost", label: "Ads & Boosts", icon: Rocket },
  { id: "message", label: "Messages", icon: Inbox },
  { id: "scheduled", label: "Scheduled", icon: Calendar },
];

const TYPE_COLORS: Record<ActivityItem["type"], string> = {
  post: "bg-blue-500/15 text-blue-400",
  comment: "bg-pink-500/15 text-pink-400",
  boost: "bg-purple-500/15 text-purple-400",
  message: "bg-green-500/15 text-green-400",
  scheduled: "bg-yellow-500/15 text-yellow-400",
};

export default function ActivityPageClient() {
  const [tab, setTab] = useState<Tab>("all");
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, startSync] = useTransition();

  const load = useCallback(async (type: Tab, sync = false) => {
    const typeParam = type === "all" ? "all" : type;
    const res = await fetch(`/api/activity?type=${typeParam}${sync ? "&sync=true" : ""}`);
    const data = await res.json();
    setItems(data.items || []);
    setCounts(data.counts || {});
  }, []);

  useEffect(() => {
    setLoading(true);
    load(tab).finally(() => setLoading(false));
  }, [tab, load]);

  function handleSync() {
    startSync(async () => {
      await load(tab, true);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Activity</h1>
          <p className="text-[var(--muted)] mt-1">
            All posts, comments, ads, messages, and scheduled content in one place
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 border border-[var(--border)] hover:bg-[var(--card-hover)] px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync from Meta"}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: "Posts", key: "posts", color: "#1877f2" },
          { label: "Comments", key: "comments", color: "#e1306c" },
          { label: "Boosts", key: "boosts", color: "#a855f7" },
          { label: "Messages", key: "messages", color: "#22c55e" },
          { label: "Scheduled", key: "scheduled", color: "#f59e0b" },
          { label: "Total", key: "total", color: "#9ca3af" },
        ].map((stat) => (
          <div
            key={stat.key}
            className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4"
          >
            <p className="text-2xl font-bold" style={{ color: stat.color }}>
              {counts[stat.key] ?? "—"}
            </p>
            <p className="text-xs text-[var(--muted)] mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-[var(--border)]">
        {TABS.map(({ id, label, icon: Icon }) => (
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

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-[var(--card)] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-12 text-center text-[var(--muted)]">
          <p className="mb-4">No {tab === "all" ? "activity" : tab + "s"} yet</p>
          <button
            onClick={handleSync}
            className="text-[var(--primary)] hover:underline text-sm"
          >
            Sync from Meta
          </button>
        </div>
      ) : (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-[100px_140px_1fr_160px_80px] gap-4 px-5 py-3 border-b border-[var(--border)] text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
            <span>Type</span>
            <span>Page</span>
            <span>Content</span>
            <span>Date</span>
            <span>Action</span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-1 sm:grid-cols-[100px_140px_1fr_160px_80px] gap-2 sm:gap-4 px-5 py-4 hover:bg-[var(--card-hover)] transition-colors"
              >
                <div>
                  <span
                    className={`inline-block text-xs px-2 py-1 rounded-full font-medium capitalize ${TYPE_COLORS[item.type]}`}
                  >
                    {item.type}
                  </span>
                  {item.status && (
                    <p className="text-xs text-[var(--muted)] mt-1 capitalize">{item.status}</p>
                  )}
                </div>
                <div className="text-sm font-medium truncate">{item.pageName}</div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.author && (
                    <p className="text-xs text-[var(--muted)]">by {item.author}</p>
                  )}
                  <p className="text-sm text-[var(--muted)] line-clamp-2 mt-0.5">{item.body}</p>
                </div>
                <div className="text-xs text-[var(--muted)]">{formatDate(item.timestamp)}</div>
                <div className="flex items-center gap-2">
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--primary)] hover:underline text-xs flex items-center gap-1"
                    >
                      View <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {item.type === "comment" && (
                    <Link href="/comments" className="text-[var(--primary)] hover:underline text-xs">
                      Reply
                    </Link>
                  )}
                  {item.type === "message" && (
                    <Link href="/messages" className="text-[var(--primary)] hover:underline text-xs">
                      Open
                    </Link>
                  )}
                  {item.type === "post" && (
                    <Link href="/posts" className="text-[var(--primary)] hover:underline text-xs">
                      Posts
                    </Link>
                  )}
                  {item.type === "boost" && (
                    <Link href="/ads" className="text-[var(--primary)] hover:underline text-xs">
                      Ads
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
