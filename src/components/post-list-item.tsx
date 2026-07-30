"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  Rocket,
  Send,
  CheckCircle,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

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
  metaAccount?: { pageName: string };
  _count?: { comments: number };
}

const PLATFORM_COLORS: Record<string, string> = {
  facebook: "bg-blue-500/15 text-blue-400",
  instagram: "bg-pink-500/15 text-pink-400",
  linkedin: "bg-sky-500/15 text-sky-400",
};

interface LinkedInComment {
  id: string;
  message: string;
  authorName: string | null;
  createdAt: string;
}

interface PostListItemProps {
  post: Post;
  showPageName: boolean;
  canBoost: boolean;
  onBoost: () => void;
}

export function PostListItem({ post, showPageName, canBoost, onBoost }: PostListItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<LinkedInComment[]>([]);
  const [metaComments, setMetaComments] = useState<
    Array<{
      id: string;
      metaCommentId: string;
      message: string;
      authorName: string | null;
      isReplied: boolean;
      createdAt: string;
    }>
  >([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [repairUrl, setRepairUrl] = useState("");
  const [repairing, setRepairing] = useState(false);
  const [repairError, setRepairError] = useState("");

  const commentCount = post._count?.comments ?? 0;
  const preview = post.message?.replace(/\s+/g, " ").trim() || "(No text)";
  const isLinkedIn = post.platform === "linkedin";
  const linkedInUrnMissing =
    isLinkedIn && Boolean(post.linkedInPostId) && !post.metaPostId?.startsWith("urn:li:");
  const platformLabel = post.platform || "facebook";

  const loadComments = useCallback(async () => {
    if (isLinkedIn && post.linkedInPostId) {
      setLoadingComments(true);
      try {
        const res = await fetch(
          `/api/linkedin/comments?postId=${post.linkedInPostId}&sync=true`
        );
        const data = await res.json();
        setComments(data.comments || []);
      } finally {
        setLoadingComments(false);
      }
      return;
    }
    if (isLinkedIn) return;
    setLoadingComments(true);
    try {
      const res = await fetch(
        `/api/comments?accountId=${post.metaAccountId}&postId=${post.metaPostId}&sync=true`
      );
      const data = await res.json();
      setMetaComments(data.comments || []);
    } finally {
      setLoadingComments(false);
    }
  }, [post.metaAccountId, post.metaPostId, isLinkedIn, post.linkedInPostId]);

  useEffect(() => {
    if (expanded) loadComments();
  }, [expanded, loadComments]);

  function toggle() {
    setExpanded((prev) => !prev);
    if (expanded) {
      setReplyingTo(null);
      setReplyText("");
    }
  }

  async function handleRepairUrn() {
    if (!post.linkedInPostId || !repairUrl.trim()) return;
    setRepairing(true);
    setRepairError("");
    try {
      const res = await fetch("/api/linkedin/posts/repair-urn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.linkedInPostId, urlOrUrn: repairUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRepairError(data.error || "Failed to link post");
        return;
      }
      setRepairUrl("");
      await loadComments();
    } finally {
      setRepairing(false);
    }
  }

  async function handleReply(commentId: string) {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: post.metaAccountId,
          commentId,
          message: replyText,
        }),
      });
      if (res.ok) {
        setReplyingTo(null);
        setReplyText("");
        setMetaComments((prev) =>
          prev.map((c) =>
            c.metaCommentId === commentId ? { ...c, isReplied: true } : c
          )
        );
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-b border-[var(--border)] last:border-b-0">
      <button
        type="button"
        onClick={toggle}
        className="w-full grid grid-cols-[28px_1fr_auto] sm:grid-cols-[28px_100px_140px_1fr_100px_80px] gap-2 sm:gap-4 px-4 py-3 text-left hover:bg-[var(--card-hover)] transition-colors items-center"
      >
        <span className="text-[var(--muted)]">
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </span>

        <span className="hidden sm:block">
          <span
            className={`inline-block text-xs px-2 py-0.5 rounded-full capitalize ${PLATFORM_COLORS[platformLabel] || "bg-gray-500/15 text-gray-400"}`}
          >
            {platformLabel}
          </span>
        </span>

        {showPageName && (
          <span className="hidden sm:block text-xs font-medium text-[var(--primary)] truncate">
            {post.metaAccount?.pageName || "Unknown"}
          </span>
        )}

        <div className="min-w-0 col-span-1 sm:col-span-1">
          <span className="sm:hidden text-xs capitalize mb-0.5 inline-block px-1.5 py-0.5 rounded bg-[var(--card)]">
            {platformLabel}
          </span>
          {showPageName && (
            <span className="sm:hidden text-xs text-[var(--primary)] block mb-0.5">
              {post.metaAccount?.pageName}
            </span>
          )}
          <p className="text-sm truncate">{preview}</p>
        </div>

        <span className="hidden sm:block text-xs text-[var(--muted)]">
          {formatDate(post.publishedAt)}
        </span>

        <span className="flex items-center justify-end gap-2 text-xs text-[var(--muted)]">
          {isLinkedIn && (post.impressions ?? 0) > 0 && (
            <span title="Impressions">{post.impressions?.toLocaleString()} views</span>
          )}
          {!isLinkedIn && (
            <>
              <MessageSquare className="w-3.5 h-3.5" />
              {commentCount}
            </>
          )}
          {isLinkedIn && (
            <>
              <MessageSquare className="w-3.5 h-3.5" />
              {commentCount}
            </>
          )}
          {isLinkedIn && post.linkedInStatus && (
            <span className="capitalize hidden sm:inline">· {post.linkedInStatus}</span>
          )}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pl-12 border-t border-[var(--border)] bg-[var(--background)]/50">
          <div className="pt-4 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {post.mediaUrl && (
                <Image
                  src={post.mediaUrl}
                  alt=""
                  width={200}
                  height={200}
                  className="rounded-lg object-cover flex-shrink-0 max-h-48 w-auto"
                  loading="lazy"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm whitespace-pre-wrap">{post.message || "(No text)"}</p>
                <p className="text-xs text-[var(--muted)] mt-2 sm:hidden">
                  {formatDate(post.publishedAt)}
                </p>
                {linkedInUrnMissing && (
                  <div className="mt-3 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
                    <p className="text-xs text-yellow-400 mb-2">
                      This post is missing its LinkedIn ID. Paste the post URL from LinkedIn to load comments and impressions.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={repairUrl}
                        onChange={(e) => setRepairUrl(e.target.value)}
                        placeholder="https://www.linkedin.com/feed/update/..."
                        className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[var(--primary)]"
                      />
                      <button
                        type="button"
                        onClick={handleRepairUrn}
                        disabled={repairing}
                        className="text-xs px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white disabled:opacity-50"
                      >
                        {repairing ? "Linking..." : "Link post"}
                      </button>
                    </div>
                    {repairError && (
                      <p className="text-xs text-red-400 mt-2">{repairError}</p>
                    )}
                  </div>
                )}
                {isLinkedIn && !linkedInUrnMissing && (
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-[var(--muted)]">
                    <span>{(post.impressions ?? 0).toLocaleString()} impressions</span>
                    <span>{commentCount} comments</span>
                    {(post.reactionCount ?? 0) > 0 && (
                      <span>{post.reactionCount} reactions</span>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  {post.permalink && (
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs text-[var(--primary)] hover:underline"
                    >
                      View on {isLinkedIn ? "LinkedIn" : "Meta"} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {!isLinkedIn && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onBoost();
                      }}
                      className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        canBoost
                          ? "border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/10"
                          : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--muted)]"
                      }`}
                    >
                      <Rocket className="w-3 h-3" />
                      {canBoost ? "Boost" : "Check Boost"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-2">
                Comments ({isLinkedIn ? comments.length : metaComments.length})
              </h4>
              {loadingComments ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-12 bg-[var(--card)] rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : isLinkedIn ? (
                comments.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    No comments loaded. Analytics permission may be required — reconnect LinkedIn in Settings.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2.5"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium">
                            {comment.authorName || "LinkedIn member"}
                          </span>
                          <span className="text-xs text-[var(--muted)]">
                            {formatDate(comment.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm mt-0.5">{comment.message}</p>
                      </div>
                    ))}
                  </div>
                )
              ) : metaComments.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No comments on this post</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {metaComments.map((comment) => (
                    <div
                      key={comment.id}
                      className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium">
                              {comment.authorName || "Unknown"}
                            </span>
                            <span className="text-xs text-[var(--muted)]">
                              {formatDate(comment.createdAt)}
                            </span>
                            {comment.isReplied && (
                              <span className="flex items-center gap-0.5 text-xs text-[var(--success)]">
                                <CheckCircle className="w-3 h-3" /> Replied
                              </span>
                            )}
                          </div>
                          <p className="text-sm mt-0.5">{comment.message}</p>
                        </div>
                        {!comment.isReplied && (
                          <button
                            type="button"
                            onClick={() =>
                              setReplyingTo(
                                replyingTo === comment.metaCommentId
                                  ? null
                                  : comment.metaCommentId
                              )
                            }
                            className="text-xs text-[var(--primary)] hover:underline shrink-0"
                          >
                            Reply
                          </button>
                        )}
                      </div>
                      {replyingTo === comment.metaCommentId && (
                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Write a reply..."
                            className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--primary)]"
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleReply(comment.metaCommentId)
                            }
                          />
                          <button
                            type="button"
                            onClick={() => handleReply(comment.metaCommentId)}
                            disabled={sending}
                            className="bg-[var(--primary)] text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
