import "server-only";

import { prisma } from "./prisma";
import { getDecryptedToken } from "./accounts";
import {
  getPagePosts,
  getInstagramMedia,
  getPostComments,
  getPageConversations,
  type MetaPost,
} from "./meta-api";
import { isStale, conversationsCache } from "./cache";

const accountSelect = {
  id: true,
  pageId: true,
  pageName: true,
  pageAccessToken: true,
  instagramId: true,
  lastSyncedAt: true,
} as const;

export async function syncPostsForAccount(accountId: string, force = false) {
  const account = await prisma.metaAccount.findUnique({
    where: { id: accountId },
    select: accountSelect,
  });
  if (!account) return { synced: false, count: 0 };

  if (!force && !isStale(account.lastSyncedAt)) {
    return { synced: false, count: 0 };
  }

  const token = getDecryptedToken(account);
  const [fbPosts, igPosts] = await Promise.all([
    getPagePosts(account.pageId, token),
    account.instagramId
      ? getInstagramMedia(account.instagramId, token)
      : Promise.resolve([] as MetaPost[]),
  ]);

  const now = new Date();

  const upsertPost = (post: MetaPost, platform: "facebook" | "instagram") =>
    prisma.post.upsert({
      where: {
        metaAccountId_metaPostId: {
          metaAccountId: account.id,
          metaPostId: post.id,
        },
      },
      create: {
        metaAccountId: account.id,
        metaPostId: post.id,
        message: post.message || null,
        mediaUrl: post.full_picture || null,
        mediaType: post.attachments?.data?.[0]?.media_type || null,
        permalink: post.permalink_url || null,
        platform,
        publishedAt: new Date(post.created_time),
        syncedAt: now,
      },
      update: {
        message: post.message || null,
        mediaUrl: post.full_picture || null,
        permalink: post.permalink_url || null,
        platform,
        syncedAt: now,
      },
    });

  if (fbPosts.length > 0 || igPosts.length > 0) {
    await prisma.$transaction([
      ...fbPosts.map((post) => upsertPost(post, "facebook")),
      ...igPosts.map((post) => upsertPost(post, "instagram")),
    ]);
  }

  await prisma.metaAccount.update({
    where: { id: accountId },
    data: { lastSyncedAt: now },
  });

  return { synced: true, count: fbPosts.length + igPosts.length };
}

export async function syncCommentsForPost(
  accountId: string,
  metaPostId: string,
  force = false
) {
  const account = await prisma.metaAccount.findUnique({
    where: { id: accountId },
    select: { id: true, pageAccessToken: true },
  });
  if (!account) return { synced: false, count: 0 };

  const existing = await prisma.comment.findFirst({
    where: { metaPostId },
    select: { syncedAt: true },
    orderBy: { syncedAt: "desc" },
  });

  if (!force && existing && !isStale(existing.syncedAt, 2 * 60 * 1000)) {
    return { synced: false, count: 0 };
  }

  const token = getDecryptedToken(account);
  const comments = await getPostComments(metaPostId, token);
  const now = new Date();

  if (comments.length > 0) {
    await prisma.$transaction(
      comments.map((comment) =>
        prisma.comment.upsert({
          where: { metaCommentId: comment.id },
          create: {
            metaAccountId: account.id,
            metaCommentId: comment.id,
            metaPostId,
            message: comment.message,
            authorName: comment.from?.name || null,
            authorId: comment.from?.id || null,
            createdAt: new Date(comment.created_time),
            syncedAt: now,
          },
          update: {
            message: comment.message,
            authorName: comment.from?.name || null,
            syncedAt: now,
          },
        })
      )
    );
  }

  return { synced: true, count: comments.length };
}

export async function syncCommentsForAccount(accountId: string, force = false) {
  const posts = await prisma.post.findMany({
    where: { metaAccountId: accountId },
    select: { metaPostId: true },
    orderBy: { publishedAt: "desc" },
    take: 25,
  });

  let count = 0;
  for (const post of posts) {
    const result = await syncCommentsForPost(accountId, post.metaPostId, force);
    count += result.count;
  }
  return { synced: true, count };
}

export async function syncMessagesForAccount(accountId: string) {
  const account = await prisma.metaAccount.findUnique({
    where: { id: accountId },
    select: { id: true, pageId: true, pageAccessToken: true },
  });
  if (!account) return { synced: false, count: 0 };

  const token = getDecryptedToken(account);
  const conversations = await getPageConversations(account.pageId, token);
  conversationsCache.set(`conversations:${accountId}`, conversations, 5 * 60 * 1000);

  return { synced: true, count: conversations.length };
}

export async function syncAllForAccount(accountId: string, force = false) {
  const posts = await syncPostsForAccount(accountId, force);
  const comments = await syncCommentsForAccount(accountId, force);
  const messages = await syncMessagesForAccount(accountId);
  return { posts, comments, messages };
}
