import "server-only";

import { prisma } from "./prisma";
import {
  linkedInStatusCache,
  linkedInSyncCache,
  LINKEDIN_STATUS_TTL_MS,
  LINKEDIN_SYNC_TTL_MS,
} from "./cache";
import {
  createLinkedInPost,
  fetchLinkedInMemberPosts,
  getLinkedInConnection,
  fetchLinkedInPostAnalytics,
  fetchLinkedInPostComments,
  isValidLinkedInPostUrn,
  parseLinkedInUrnFromUrl,
  linkedInPostPermalink,
  probeLinkedInAnalyticsAccess,
} from "./linkedin-api";

export async function addLinkedInPost(
  userId: string,
  data: {
    content: string;
    scheduledAt?: string | null;
    visibility?: string;
    source?: string;
    sourceId?: string | null;
  }
) {
  const status = data.scheduledAt ? "scheduled" : "draft";
  return prisma.linkedInPost.create({
    data: {
      userId,
      content: data.content,
      visibility: data.visibility || "PUBLIC",
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      status,
      source: data.source || "manual",
      sourceId: data.sourceId || null,
    },
  });
}

export async function listLinkedInPosts(userId: string, status?: string) {
  return prisma.linkedInPost.findMany({
    where: { userId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateLinkedInPost(
  userId: string,
  id: string,
  updates: {
    content?: string;
    scheduledAt?: string | null;
    visibility?: string;
    status?: string;
  }
) {
  const existing = await prisma.linkedInPost.findFirst({ where: { id, userId } });
  if (!existing) return null;

  return prisma.linkedInPost.update({
    where: { id },
    data: {
      content: updates.content,
      visibility: updates.visibility,
      status: updates.status,
      scheduledAt:
        updates.scheduledAt === undefined
          ? undefined
          : updates.scheduledAt
            ? new Date(updates.scheduledAt)
            : null,
    },
  });
}

export async function deleteLinkedInPost(userId: string, id: string) {
  const existing = await prisma.linkedInPost.findFirst({ where: { id, userId } });
  if (!existing) return false;
  await prisma.linkedInPost.delete({ where: { id } });
  return true;
}

export async function publishLinkedInPost(userId: string, id: string) {
  const post = await prisma.linkedInPost.findFirst({ where: { id, userId } });
  if (!post) throw new Error("Post not found");
  if (post.status === "published") throw new Error("Post already published");

  try {
    const result = await createLinkedInPost(userId, post.content, post.visibility);
    const urn = result.id;

    return prisma.linkedInPost.update({
      where: { id },
      data: {
        status: "published",
        linkedinPostUrn: urn,
        publishedAt: new Date(),
        errorMessage: null,
      },
    });
  } catch (err) {
    await prisma.linkedInPost.update({
      where: { id },
      data: {
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "Publish failed",
      },
    });
    throw err;
  }
}

export async function getDueLinkedInPosts() {
  return prisma.linkedInPost.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { lte: new Date() },
    },
    orderBy: { scheduledAt: "asc" },
    take: 20,
  });
}

export async function publishDueLinkedInPosts() {
  const due = await getDueLinkedInPosts();
  const results = [];

  for (const post of due) {
    try {
      const published = await publishLinkedInPost(post.userId, post.id);
      results.push({ id: post.id, success: true, post: published });
    } catch (err) {
      results.push({
        id: post.id,
        success: false,
        error: err instanceof Error ? err.message : "Failed",
      });
    }
  }

  return results;
}

export async function getLinkedInPostStats(userId: string) {
  const rows = await prisma.linkedInPost.groupBy({
    by: ["status"],
    where: { userId },
    _count: { status: true },
  });
  return Object.fromEntries(rows.map((r) => [r.status, r._count.status]));
}

export async function syncLinkedInPostAnalytics(userId: string, postId: string) {
  const post = await prisma.linkedInPost.findFirst({ where: { id: postId, userId } });
  if (!isValidLinkedInPostUrn(post?.linkedinPostUrn)) return null;

  const analytics = await fetchLinkedInPostAnalytics(userId, post.linkedinPostUrn);
  return prisma.linkedInPost.update({
    where: { id: post.id },
    data: {
      impressions: analytics.impressions,
      commentCount: analytics.commentCount,
      reactionCount: analytics.reactionCount,
      reshareCount: analytics.reshareCount,
      analyticsSyncedAt: new Date(),
    },
  });
}

export async function syncLinkedInPostComments(userId: string, postId: string) {
  const post = await prisma.linkedInPost.findFirst({ where: { id: postId, userId } });
  if (!isValidLinkedInPostUrn(post?.linkedinPostUrn)) {
    return { count: 0, error: "Post URN missing — sync posts from LinkedIn first" };
  }

  const { comments, error } = await fetchLinkedInPostComments(userId, post.linkedinPostUrn);
  const now = new Date();

  for (const comment of comments) {
    const commentId = comment.id || comment.commentUrn;
    if (!commentId) continue;
    const message = comment.message?.text || "";
    if (!message) continue;

    await prisma.linkedInComment.upsert({
      where: { linkedInCommentId: commentId },
      create: {
        linkedInPostId: post.id,
        linkedInCommentId: commentId,
        message,
        authorName: comment.actor?.split(":").pop() || null,
        createdAt: comment.created?.time ? new Date(comment.created.time) : now,
        syncedAt: now,
      },
      update: {
        message,
        syncedAt: now,
      },
    });
  }

  if (comments.length > 0) {
    await prisma.linkedInPost.update({
      where: { id: post.id },
      data: { commentCount: comments.length },
    });
  }

  return { count: comments.length, error };
}

export async function syncLinkedInPosts(userId: string, force = false) {
  if (!force) {
    const lastSync = linkedInSyncCache.get(userId);
    if (lastSync && Date.now() - lastSync < LINKEDIN_SYNC_TTL_MS) {
      const conn = await getLinkedInConnection(userId);
      const dbCount = await prisma.linkedInPost.count({ where: { userId } });
      return {
        imported: 0,
        apiError: null,
        personName: conn?.personName || "LinkedIn",
        skipped: true,
        dbCount,
      };
    }
  }

  const conn = await getLinkedInConnection(userId);
  const personName = conn?.personName || "LinkedIn";

  const { posts: apiPosts, error } = await fetchLinkedInMemberPosts(userId);
  let imported = 0;

  const invalidUrnPosts = await prisma.linkedInPost.findMany({
    where: {
      userId,
      status: "published",
      OR: [{ linkedinPostUrn: null }, { linkedinPostUrn: { not: { startsWith: "urn:li:" } } }],
    },
  });

  for (const item of apiPosts) {
    if (!item.id || !isValidLinkedInPostUrn(item.id)) continue;
    const content = item.commentary || "";
    const publishedAt = item.createdAt ? new Date(item.createdAt) : new Date();
    const status =
      item.lifecycleState === "PUBLISHED" ? "published" : item.lifecycleState?.toLowerCase() || "published";

    let existing = await prisma.linkedInPost.findFirst({
      where: { userId, sourceId: item.id },
    });

    if (!existing) {
      existing = await prisma.linkedInPost.findFirst({
        where: { userId, linkedinPostUrn: item.id },
      });
    }

    if (!existing && content) {
      const contentPrefix = content.slice(0, 120);
      existing = await prisma.linkedInPost.findFirst({
        where: {
          userId,
          content: { startsWith: contentPrefix },
          OR: [{ linkedinPostUrn: null }, { linkedinPostUrn: { not: { startsWith: "urn:li:" } } }],
        },
      });
    }

    if (existing) {
      await prisma.linkedInPost.update({
        where: { id: existing.id },
        data: {
          content: content || existing.content,
          linkedinPostUrn: item.id,
          sourceId: item.id,
          status,
          publishedAt,
        },
      });
    } else {
      await prisma.linkedInPost.create({
        data: {
          userId,
          content: content || "(LinkedIn post)",
          status,
          source: "linkedin_api",
          sourceId: item.id,
          linkedinPostUrn: item.id,
          publishedAt,
        },
      });
    }
    imported++;
  }

  for (const post of invalidUrnPosts) {
    if (apiPosts.length === 1 && isValidLinkedInPostUrn(apiPosts[0].id)) {
      const item = apiPosts[0];
      await prisma.linkedInPost.update({
        where: { id: post.id },
        data: {
          linkedinPostUrn: item.id,
          sourceId: item.id,
          content: item.commentary || post.content,
        },
      });
    }
  }

  const published = await prisma.linkedInPost.findMany({
    where: {
      userId,
      linkedinPostUrn: { startsWith: "urn:li:" },
      status: "published",
    },
    take: 25,
  });
  for (const post of published) {
    try {
      await syncLinkedInPostAnalytics(userId, post.id);
    } catch {
      /* skip if analytics permission missing */
    }
  }

  linkedInSyncCache.set(userId, Date.now(), LINKEDIN_SYNC_TTL_MS);
  const dbCount = await prisma.linkedInPost.count({ where: { userId } });
  return { imported, apiError: error, personName, dbCount };
}

export async function getLinkedInIntegrationStatus(userId: string) {
  const cached = linkedInStatusCache.get(userId);
  if (cached) return { connected: true, ...cached };

  const conn = await getLinkedInConnection(userId);
  if (!conn) {
    return { connected: false, analyticsAccess: false, postsListAccess: false, message: null };
  }

  let analyticsAccess = false;
  let postsListAccess = false;
  let message: string | null = null;

  try {
    const { error } = await fetchLinkedInMemberPosts(userId, 1);
    postsListAccess = !error;
    if (error?.includes("ACCESS_DENIED")) {
      message =
        "LinkedIn analytics need Community Management API approval in your LinkedIn Developer app.";
    }
  } catch {
    postsListAccess = false;
  }

  try {
    analyticsAccess = await probeLinkedInAnalyticsAccess(userId);
    if (!analyticsAccess && !message) {
      message =
        "Impressions need Community Management API + r_member_postAnalytics. Reconnect LinkedIn after approval.";
    }
  } catch {
    analyticsAccess = false;
  }

  const result = { analyticsAccess, postsListAccess, message };
  linkedInStatusCache.set(userId, result, LINKEDIN_STATUS_TTL_MS);
  return { connected: true, ...result };
}

export async function getLinkedInDashboardStats(userId: string) {
  const [agg, publishedCount] = await Promise.all([
    prisma.linkedInPost.aggregate({
      where: { userId },
      _sum: { impressions: true, commentCount: true, reactionCount: true, reshareCount: true },
      _count: { id: true },
    }),
    prisma.linkedInPost.count({ where: { userId, status: "published" } }),
  ]);

  return {
    postCount: agg._count.id,
    impressions: agg._sum.impressions || 0,
    comments: agg._sum.commentCount || 0,
    reactions: agg._sum.reactionCount || 0,
    reshares: agg._sum.reshareCount || 0,
    published: publishedCount,
  };
}
export async function repairLinkedInPostUrn(
  userId: string,
  postId: string,
  urlOrUrn: string
) {
  const urn = parseLinkedInUrnFromUrl(urlOrUrn);
  if (!urn) throw new Error("Could not parse a LinkedIn post URN from that URL");

  const post = await prisma.linkedInPost.findFirst({ where: { id: postId, userId } });
  if (!post) throw new Error("Post not found");

  const updated = await prisma.linkedInPost.update({
    where: { id: post.id },
    data: { linkedinPostUrn: urn, sourceId: urn },
  });

  try {
    await syncLinkedInPostAnalytics(userId, post.id);
    await syncLinkedInPostComments(userId, post.id);
  } catch {
    /* permissions may still be missing */
  }

  return updated;
}

export function mapLinkedInPostToUnified(
  post: {
    id: string;
    content: string;
    status: string;
    linkedinPostUrn: string | null;
    publishedAt: Date | null;
    createdAt: Date;
    scheduledAt: Date | null;
    errorMessage: string | null;
    impressions?: number;
    commentCount?: number;
    reactionCount?: number;
    reshareCount?: number;
  },
  personName: string
) {
  const publishedAt = post.publishedAt || post.scheduledAt || post.createdAt;
  return {
    id: `linkedin-${post.id}`,
    platform: "linkedin" as const,
    metaPostId: post.linkedinPostUrn || post.id,
    metaAccountId: "linkedin",
    message: post.content,
    mediaUrl: null,
    permalink: linkedInPostPermalink(post.linkedinPostUrn),
    publishedAt: publishedAt.toISOString(),
    metaAccount: { pageName: personName },
    linkedInStatus: post.status,
    linkedInPostId: post.id,
    errorMessage: post.errorMessage,
    impressions: post.impressions ?? 0,
    reactionCount: post.reactionCount ?? 0,
    reshareCount: post.reshareCount ?? 0,
    _count: { comments: post.commentCount ?? 0 },
  };
}
