import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import {
  getAccountWithAccess,
  getAccessibleAccounts,
  getDecryptedToken,
  logActivity,
} from "@/lib/accounts";
import { checkPostBoostEligibility, boostPost } from "@/lib/meta-ads-api";
import { prisma } from "@/lib/prisma";

const boostSchema = z.object({
  accountId: z.string(),
  postId: z.string().optional(),
  metaPostId: z.string().optional(),
  dailyBudget: z.number().min(1).max(10000),
  durationDays: z.number().min(1).max(30),
  countries: z.array(z.string()).default(["US"]),
  adAccountId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  return withAuth(async (user) => {
    const accountId = request.nextUrl.searchParams.get("accountId");
    if (!accountId) return apiError("accountId required");

    if (accountId === "all") {
      const accounts = await getAccessibleAccounts(user);
      const accountIds = accounts.map((a) => a.id);
      if (accountIds.length === 0) return apiSuccess({ boosts: [] });

      const boosts = await prisma.boostRecord.findMany({
        where: { metaAccountId: { in: accountIds } },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          post: { select: { message: true, mediaUrl: true } },
        },
      });
      return apiSuccess({ boosts });
    }

    const account = await getAccountWithAccess(user, accountId, "VIEW");
    if (!account) return apiError("Account not found or access denied", 403);

    const boosts = await prisma.boostRecord.findMany({
      where: { metaAccountId: account.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        post: { select: { message: true, mediaUrl: true } },
      },
    });

    return apiSuccess({ boosts });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    try {
      const body = await request.json();
      const data = boostSchema.parse(body);

      const account = await getAccountWithAccess(user, data.accountId, "BOOST");
      if (!account) return apiError("Account not found or no boost permission", 403);

      const adAccountId = data.adAccountId || account.adAccountId;
      if (!adAccountId) {
        return apiError("No ad account linked. Link an ad account in Ads settings first.", 400);
      }

      let resolvedMetaPostId = data.metaPostId;
      let internalPostId = data.postId;

      if (!resolvedMetaPostId && data.postId) {
        const post = await prisma.post.findUnique({
          where: { id: data.postId },
          select: { id: true, metaPostId: true, metaAccountId: true },
        });
        if (!post || post.metaAccountId !== account.id) {
          return apiError("Post not found", 404);
        }
        resolvedMetaPostId = post.metaPostId;
        internalPostId = post.id;
      }

      if (!resolvedMetaPostId) return apiError("postId or metaPostId required");

      const token = getDecryptedToken(account);
      const eligibility = await checkPostBoostEligibility(
        resolvedMetaPostId,
        account.pageId,
        token,
        account.instagramId
      );

      if (!eligibility.eligible || !eligibility.objectStoryId) {
        return apiError(eligibility.reason || "Post is not eligible for boosting", 400);
      }

      const record = await prisma.boostRecord.create({
        data: {
          metaAccountId: account.id,
          postId: internalPostId || null,
          metaPostId: resolvedMetaPostId,
          dailyBudget: Math.round(data.dailyBudget * 100),
          durationDays: data.durationDays,
          targeting: JSON.stringify({ countries: data.countries }),
          status: "PENDING",
          createdById: user.id,
        },
      });

      try {
        const result = await boostPost({
          adAccountId,
          pageId: account.pageId,
          objectStoryId: eligibility.objectStoryId,
          accessToken: token,
          dailyBudgetCents: Math.round(data.dailyBudget * 100),
          durationDays: data.durationDays,
          countries: data.countries,
        });

        const updated = await prisma.boostRecord.update({
          where: { id: record.id },
          data: {
            status: "ACTIVE",
            metaCampaignId: result.campaignId,
            metaAdSetId: result.adSetId,
            metaCreativeId: result.creativeId,
            metaAdId: result.adId,
          },
        });

        logActivity(
          user.id,
          "BOOST_POST",
          `Boosted post ${resolvedMetaPostId} on ${account.pageName} ($${data.dailyBudget}/day)`
        );

        return apiSuccess({ boost: updated });
      } catch (err) {
        await prisma.boostRecord.update({
          where: { id: record.id },
          data: {
            status: "FAILED",
            errorMessage: err instanceof Error ? err.message : "Boost failed",
          },
        });
        throw err;
      }
    } catch (err) {
      if (err instanceof z.ZodError) return apiError("Invalid input");
      return apiError(err instanceof Error ? err.message : "Failed to boost post", 500);
    }
  });
}
