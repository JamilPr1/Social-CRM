import { NextRequest } from "next/server";
import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { getAccountWithAccess, getAccessibleAccountIds } from "@/lib/accounts";
import { syncAllForAccount, syncPostsForAccount } from "@/lib/sync";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createPagePost, createInstagramPost } from "@/lib/meta-api";
import { getDecryptedToken, logActivity } from "@/lib/accounts";
import {
  listLinkedInPosts,
  syncLinkedInPosts,
  mapLinkedInPostToUnified,
} from "@/lib/linkedin-posts";
import { getLinkedInConnection } from "@/lib/linkedin-api";

type PlatformFilter = "all" | "facebook" | "instagram" | "linkedin";

export async function GET(request: NextRequest) {
  return withAuth(async (user) => {
    const accountId = request.nextUrl.searchParams.get("accountId") || "all";
    const platform = (request.nextUrl.searchParams.get("platform") || "all") as PlatformFilter;
    const sync = request.nextUrl.searchParams.get("sync") === "true";

    const postSelect = {
      id: true,
      metaPostId: true,
      message: true,
      mediaUrl: true,
      mediaType: true,
      permalink: true,
      platform: true,
      publishedAt: true,
      metaAccountId: true,
      metaAccount: { select: { pageName: true } },
      _count: { select: { comments: true } },
    } as const;

    const results: Array<Record<string, unknown>> = [];
    let linkedInSyncNote: string | null = null;

    if (platform === "linkedin" || platform === "all") {
      if (sync) {
        const syncResult = await syncLinkedInPosts(user.id, true);
        if (syncResult.apiError && syncResult.imported === 0 && (syncResult.dbCount ?? 0) === 0) {
          linkedInSyncNote = syncResult.apiError;
        } else if (syncResult.apiError && syncResult.imported === 0) {
          linkedInSyncNote = `${syncResult.apiError} Showing ${syncResult.dbCount} post(s) from CRM.`;
        }
      }

      const conn = await getLinkedInConnection(user.id);
      const personName = conn?.personName || "LinkedIn";
      const liPosts = await listLinkedInPosts(user.id);
      const published = liPosts.filter((p) =>
        platform === "all" ? true : p.status === "published" || p.status === "scheduled" || p.status === "draft"
      );

      for (const post of published) {
        results.push(mapLinkedInPostToUnified(post, personName));
      }
    }

    if (platform !== "linkedin") {
      const ids = await getAccessibleAccountIds(user);
      const accountFilter =
        accountId !== "all" && accountId !== "linkedin" ? accountId : null;

      if (accountFilter) {
        const account = await getAccountWithAccess(user, accountFilter, "VIEW");
        if (!account) return apiError("Account not found or access denied", 403);
      }

      if (ids.length > 0) {
        const targetIds = accountFilter ? [accountFilter] : ids;

        if (sync) {
          await Promise.all(targetIds.map((id) => syncAllForAccount(id, true)));
        }

        const where: {
          metaAccountId: { in: string[] };
          platform?: string;
        } = { metaAccountId: { in: targetIds } };

        if (platform === "facebook" || platform === "instagram") {
          where.platform = platform;
        }

        const metaPosts = await prisma.post.findMany({
          where,
          orderBy: { publishedAt: "desc" },
          take: 100,
          select: postSelect,
        });

        for (const post of metaPosts) {
          results.push({
            ...post,
            platform: post.platform || "facebook",
            publishedAt: post.publishedAt.toISOString(),
          });
        }
      }
    }

    results.sort(
      (a, b) =>
        new Date(b.publishedAt as string).getTime() -
        new Date(a.publishedAt as string).getTime()
    );

    return apiSuccess({
      posts: results,
      synced: sync,
      linkedInSyncNote,
      counts: {
        total: results.length,
        facebook: results.filter((p) => p.platform === "facebook").length,
        instagram: results.filter((p) => p.platform === "instagram").length,
        linkedin: results.filter((p) => p.platform === "linkedin").length,
      },
    });
  });
}

const createPostSchema = z.object({
  accountId: z.string(),
  message: z.string().min(1),
  platform: z.enum(["facebook", "instagram"]).default("facebook"),
  imageUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    try {
      const body = await request.json();
      const data = createPostSchema.parse(body);

      const account = await getAccountWithAccess(user, data.accountId, "POST");
      if (!account) return apiError("Account not found or no post permission", 403);

      const token = getDecryptedToken(account);
      let result;

      if (data.platform === "instagram") {
        if (!account.instagramId) return apiError("No Instagram account linked");
        if (!data.imageUrl) return apiError("Image URL required for Instagram posts");
        result = await createInstagramPost(
          account.instagramId,
          token,
          data.imageUrl,
          data.message
        );
      } else {
        result = await createPagePost(account.pageId, token, data.message, data.imageUrl);
      }

      logActivity(user.id, "CREATE_POST", `Posted to ${data.platform} on ${account.pageName}`);
      void syncPostsForAccount(account.id, true);

      return apiSuccess({ post: result });
    } catch (err) {
      if (err instanceof z.ZodError) return apiError("Invalid input");
      return apiError(err instanceof Error ? err.message : "Failed to create post", 500);
    }
  });
}
