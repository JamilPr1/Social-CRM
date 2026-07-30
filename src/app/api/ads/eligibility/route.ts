import { NextRequest } from "next/server";
import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { getAccountWithAccess, getDecryptedToken } from "@/lib/accounts";
import { checkPostBoostEligibility } from "@/lib/meta-ads-api";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  return withAuth(async (user) => {
    const accountId = request.nextUrl.searchParams.get("accountId");
    const postId = request.nextUrl.searchParams.get("postId");
    const metaPostId = request.nextUrl.searchParams.get("metaPostId");

    if (!accountId) return apiError("accountId required");
    if (!postId && !metaPostId) return apiError("postId or metaPostId required");

    const account = await getAccountWithAccess(user, accountId, "VIEW");
    if (!account) return apiError("Account not found or access denied", 403);

    let resolvedMetaPostId = metaPostId;
    if (!resolvedMetaPostId && postId) {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { metaPostId: true, metaAccountId: true },
      });
      if (!post || post.metaAccountId !== account.id) {
        return apiError("Post not found", 404);
      }
      resolvedMetaPostId = post.metaPostId;
    }

    if (!resolvedMetaPostId) return apiError("Could not resolve post");

    const token = getDecryptedToken(account);
    const eligibility = await checkPostBoostEligibility(
      resolvedMetaPostId,
      account.pageId,
      token,
      account.instagramId
    );

    const hasAdAccount = !!account.adAccountId;

    return apiSuccess({
      ...eligibility,
      hasAdAccount,
      adAccountId: account.adAccountId,
      adAccountName: account.adAccountName,
      canBoost: eligibility.eligible && hasAdAccount,
    });
  });
}
