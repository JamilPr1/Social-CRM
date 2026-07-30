import { NextRequest } from "next/server";
import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { getAccountWithAccess, getDecryptedToken } from "@/lib/accounts";
import { getPageAdAccounts } from "@/lib/meta-ads-api";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  return withAuth(async (user) => {
    const accountId = request.nextUrl.searchParams.get("accountId");
    if (!accountId) return apiError("accountId required");

    const account = await getAccountWithAccess(user, accountId, "VIEW");
    if (!account) return apiError("Account not found or access denied", 403);

    const token = getDecryptedToken(account);
    const adAccounts = await getPageAdAccounts(account.pageId, token);

    return apiSuccess({
      adAccounts,
      linkedAdAccountId: account.adAccountId,
      linkedAdAccountName: account.adAccountName,
    });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    if (user.role !== "ADMIN") return apiError("Only admins can link ad accounts", 403);

    const body = await request.json();
    const { accountId, adAccountId, adAccountName } = body;
    if (!accountId || !adAccountId) return apiError("accountId and adAccountId required");

    const account = await getAccountWithAccess(user, accountId, "MANAGE");
    if (!account) return apiError("Account not found", 403);

    await prisma.metaAccount.update({
      where: { id: accountId },
      data: { adAccountId, adAccountName: adAccountName || null },
    });

    return apiSuccess({ ok: true });
  });
}
