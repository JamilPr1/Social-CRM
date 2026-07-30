import { NextRequest } from "next/server";
import { withAuth, apiSuccess } from "@/lib/api-helpers";
import { getAccessibleAccounts, getDecryptedToken } from "@/lib/accounts";
import { prisma } from "@/lib/prisma";
import { syncAllForAccount } from "@/lib/sync";
import { getPageConversations } from "@/lib/meta-api";
import { conversationsCache } from "@/lib/cache";

export interface ActivityItem {
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

export async function GET(request: NextRequest) {
  return withAuth(async (user) => {
    const sync = request.nextUrl.searchParams.get("sync") === "true";
    const typeFilter = request.nextUrl.searchParams.get("type");

    const accounts = await getAccessibleAccounts(user);
    const accountIds = accounts.map((a) => a.id);
    const pageNameMap = Object.fromEntries(accounts.map((a) => [a.id, a.pageName]));

    if (sync && accountIds.length > 0) {
      await Promise.all(accountIds.map((id) => syncAllForAccount(id, true)));
    }

    const items: ActivityItem[] = [];

    if (!typeFilter || typeFilter === "post" || typeFilter === "all") {
      const posts = await prisma.post.findMany({
        where: { metaAccountId: { in: accountIds } },
        orderBy: { publishedAt: "desc" },
        take: 100,
        select: {
          id: true,
          metaAccountId: true,
          message: true,
          mediaUrl: true,
          permalink: true,
          publishedAt: true,
        },
      });
      for (const post of posts) {
        items.push({
          id: `post-${post.id}`,
          type: "post",
          accountId: post.metaAccountId,
          pageName: pageNameMap[post.metaAccountId] || "Unknown",
          title: "Post published",
          body: post.message || "(No text)",
          timestamp: post.publishedAt.toISOString(),
          url: post.permalink || undefined,
        });
      }
    }

    if (!typeFilter || typeFilter === "comment" || typeFilter === "all") {
      const comments = await prisma.comment.findMany({
        where: { metaAccountId: { in: accountIds } },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          metaAccountId: true,
          message: true,
          authorName: true,
          isReplied: true,
          createdAt: true,
        },
      });
      for (const comment of comments) {
        items.push({
          id: `comment-${comment.id}`,
          type: "comment",
          accountId: comment.metaAccountId,
          pageName: pageNameMap[comment.metaAccountId] || "Unknown",
          title: comment.isReplied ? "Comment (replied)" : "New comment",
          body: comment.message,
          timestamp: comment.createdAt.toISOString(),
          author: comment.authorName || "Unknown",
          status: comment.isReplied ? "replied" : "pending",
        });
      }
    }

    if (!typeFilter || typeFilter === "boost" || typeFilter === "all") {
      const boosts = await prisma.boostRecord.findMany({
        where: { metaAccountId: { in: accountIds } },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { post: { select: { message: true } } },
      });
      for (const boost of boosts) {
        items.push({
          id: `boost-${boost.id}`,
          type: "boost",
          accountId: boost.metaAccountId,
          pageName: pageNameMap[boost.metaAccountId] || "Unknown",
          title: `Ad boost — $${(boost.dailyBudget / 100).toFixed(2)}/day`,
          body: boost.post?.message || boost.metaPostId,
          timestamp: boost.createdAt.toISOString(),
          status: boost.status,
        });
      }
    }

    if (!typeFilter || typeFilter === "scheduled" || typeFilter === "all") {
      const scheduled = await prisma.scheduledPost.findMany({
        where: user.role === "ADMIN" ? {} : { createdById: user.id },
        orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
        take: 50,
      });
      for (const item of scheduled) {
        let pageNames = "Multiple pages";
        try {
          const ids = JSON.parse(item.accountIds) as string[];
          pageNames = ids.map((id) => pageNameMap[id] || id).join(", ");
        } catch {
          /* ignore */
        }
        items.push({
          id: `scheduled-${item.id}`,
          type: "scheduled",
          accountId: "",
          pageName: pageNames,
          title: `Scheduled post (${item.platform})`,
          body: item.message,
          timestamp: (item.scheduledAt || item.createdAt).toISOString(),
          status: item.status,
        });
      }
    }

    if ((!typeFilter || typeFilter === "message" || typeFilter === "all") && accountIds.length > 0) {
      if (sync) {
        const fullAccounts = await prisma.metaAccount.findMany({
          where: { id: { in: accountIds }, isActive: true },
          select: { id: true, pageId: true, pageName: true, pageAccessToken: true },
        });

        for (const account of fullAccounts) {
          try {
            const token = getDecryptedToken(account);
            const conversations = await getPageConversations(account.pageId, token);
            conversationsCache.set(`conversations:${account.id}`, conversations, 30_000);
            for (const convo of conversations.slice(0, 15)) {
              const participant = convo.participants?.data?.[0];
              const lastMsg = convo.messages?.data?.[0];
              if (!lastMsg) continue;
              items.push({
                id: `message-${convo.id}`,
                type: "message",
                accountId: account.id,
                pageName: account.pageName,
                title: `Message from ${participant?.name || "Unknown"}`,
                body: lastMsg.message,
                timestamp: lastMsg.created_time,
                author: lastMsg.from?.name,
              });
            }
          } catch {
            /* skip account if messages fail */
          }
        }
      } else {
        const cached = await prisma.metaAccount.findMany({
          where: { id: { in: accountIds }, isActive: true },
          select: { id: true, pageName: true },
        });
        for (const account of cached) {
          const conversations = conversationsCache.get(`conversations:${account.id}`) as
            | Array<{
                id: string;
                participants?: { data: Array<{ name?: string }> };
                messages?: {
                  data: Array<{
                    message: string;
                    from?: { name?: string };
                    created_time: string;
                  }>;
                };
              }>
            | undefined;
          if (!conversations) continue;
          for (const convo of conversations.slice(0, 10)) {
            const participant = convo.participants?.data?.[0];
            const lastMsg = convo.messages?.data?.[0];
            if (!lastMsg) continue;
            items.push({
              id: `message-${convo.id}`,
              type: "message",
              accountId: account.id,
              pageName: account.pageName,
              title: `Message from ${participant?.name || "Unknown"}`,
              body: lastMsg.message,
              timestamp: lastMsg.created_time,
              author: lastMsg.from?.name,
            });
          }
        }
      }
    }

    items.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const [postCount, commentCount, boostCount, scheduledCount] = await Promise.all([
      prisma.post.count({ where: { metaAccountId: { in: accountIds } } }),
      prisma.comment.count({ where: { metaAccountId: { in: accountIds } } }),
      prisma.boostRecord.count({ where: { metaAccountId: { in: accountIds } } }),
      prisma.scheduledPost.count({
        where: user.role === "ADMIN" ? {} : { createdById: user.id },
      }),
    ]);

    const messageCount = items.filter((i) => i.type === "message").length;

    const counts = {
      posts: postCount,
      comments: commentCount,
      boosts: boostCount,
      scheduled: scheduledCount,
      messages: messageCount,
      total: postCount + commentCount + boostCount + scheduledCount + messageCount,
    };

    const filtered =
      typeFilter && typeFilter !== "all"
        ? items.filter((i) => i.type === typeFilter)
        : items;

    return apiSuccess({ items: filtered, counts });
  });
}
