import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import {
  getAccountWithAccess,
  getAccessibleAccounts,
  getDecryptedToken,
  logActivity,
} from "@/lib/accounts";
import { replyToComment } from "@/lib/meta-api";
import { prisma } from "@/lib/prisma";
import { syncCommentsForPost } from "@/lib/sync";

const commentSelect = {
  id: true,
  metaAccountId: true,
  metaCommentId: true,
  metaPostId: true,
  message: true,
  authorName: true,
  isReplied: true,
  createdAt: true,
} as const;

export async function GET(request: NextRequest) {
  return withAuth(async (user) => {
    const accountId = request.nextUrl.searchParams.get("accountId");
    const postId = request.nextUrl.searchParams.get("postId");
    const sync = request.nextUrl.searchParams.get("sync") === "true";
    if (!accountId) return apiError("accountId required");

    if (accountId === "all") {
      const accounts = await getAccessibleAccounts(user);
      const accountIds = accounts.map((a) => a.id);
      if (accountIds.length === 0) return apiSuccess({ comments: [] });

      const comments = await prisma.comment.findMany({
        where: {
          metaAccountId: { in: accountIds },
          ...(postId ? { metaPostId: postId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: commentSelect,
      });
      return apiSuccess({ comments });
    }

    const account = await getAccountWithAccess(user, accountId, "VIEW");
    if (!account) return apiError("Account not found or access denied", 403);

    if (postId) {
      if (sync && accountId !== "all") {
        await syncCommentsForPost(accountId, postId, true);
      }

      const comments = await prisma.comment.findMany({
        where: { metaPostId: postId },
        orderBy: { createdAt: "desc" },
        select: commentSelect,
      });
      return apiSuccess({ comments });
    }

    const comments = await prisma.comment.findMany({
      where: { metaAccountId: account.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: commentSelect,
    });

    return apiSuccess({ comments });
  });
}

const replySchema = z.object({
  accountId: z.string(),
  commentId: z.string(),
  message: z.string().min(1),
});

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    try {
      const body = await request.json();
      const data = replySchema.parse(body);

      const account = await getAccountWithAccess(user, data.accountId, "REPLY");
      if (!account) return apiError("Account not found or no reply permission", 403);

      const token = getDecryptedToken(account);
      const result = await replyToComment(data.commentId, token, data.message);

      await prisma.comment.updateMany({
        where: { metaCommentId: data.commentId },
        data: { isReplied: true },
      });

      logActivity(user.id, "REPLY_COMMENT", `Replied on ${account.pageName}`);

      return apiSuccess({ reply: result });
    } catch (err) {
      if (err instanceof z.ZodError) return apiError("Invalid input");
      return apiError(err instanceof Error ? err.message : "Failed to reply", 500);
    }
  });
}
