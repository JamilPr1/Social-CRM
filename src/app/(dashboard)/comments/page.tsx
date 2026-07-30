"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Send, CheckCircle, RefreshCw } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { fetchAccounts } from "@/lib/client-cache";

interface MetaAccount {
  id: string;
  pageName: string;
}

interface Comment {
  id: string;
  metaAccountId: string;
  metaCommentId: string;
  metaPostId: string;
  message: string;
  authorName: string | null;
  isReplied: boolean;
  createdAt: string;
}

export default function CommentsPage() {
  const [accounts, setAccounts] = useState<MetaAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [syncing, startSync] = useTransition();

  useEffect(() => {
    fetchAccounts<MetaAccount>().then((accs) => {
      setAccounts(accs);
      if (accs.length > 0) setSelectedAccount(accs.length > 1 ? "all" : accs[0].id);
    });
  }, []);

  const loadComments = useCallback(async (accountId: string) => {
    const res = await fetch(`/api/comments?accountId=${accountId}`);
    const data = await res.json();
    setComments(data.comments || []);
  }, []);

  useEffect(() => {
    if (!selectedAccount) return;
    setLoading(true);
    loadComments(selectedAccount).finally(() => setLoading(false));
  }, [selectedAccount, loadComments]);

  async function handleReply(commentId: string, accountId: string) {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          commentId,
          message: replyText,
        }),
      });
      if (res.ok) {
        setReplyingTo(null);
        setReplyText("");
        setComments((prev) =>
          prev.map((c) =>
            c.metaCommentId === commentId ? { ...c, isReplied: true } : c
          )
        );
      }
    } finally {
      setSending(false);
    }
  }

  function handleSync() {
    startSync(async () => {
      await fetch(`/api/sync/all?accountId=${selectedAccount}`, { method: "POST" });
      await loadComments(selectedAccount);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Comments</h1>
          <p className="text-[var(--muted)] mt-1">View and reply to comments across accounts</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing || !selectedAccount}
          className="flex items-center gap-2 border border-[var(--border)] hover:bg-[var(--card-hover)] px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync"}
        </button>
      </div>

      {accounts.length > 0 && (
        <div className="mb-6">
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--primary)]"
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

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-[var(--card)] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-12 text-center text-[var(--muted)]">
          No comments yet
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">
                      {comment.authorName || "Unknown"}
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {formatDate(comment.createdAt)}
                    </span>
                    {comment.isReplied && (
                      <span className="flex items-center gap-1 text-xs text-[var(--success)]">
                        <CheckCircle className="w-3 h-3" /> Replied
                      </span>
                    )}
                  </div>
                  <p className="text-sm">{comment.message}</p>
                </div>
                {!comment.isReplied && (
                  <button
                    onClick={() =>
                      setReplyingTo(
                        replyingTo === comment.metaCommentId ? null : comment.metaCommentId
                      )
                    }
                    className="text-sm text-[var(--primary)] hover:underline flex-shrink-0"
                  >
                    Reply
                  </button>
                )}
              </div>

              {replyingTo === comment.metaCommentId && (
                <div className="mt-4 flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a reply..."
                    className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[var(--primary)]"
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleReply(comment.metaCommentId, comment.metaAccountId)
                    }
                  />
                  <button
                    onClick={() => handleReply(comment.metaCommentId, comment.metaAccountId)}
                    disabled={sending}
                    className="bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
