import { NextRequest } from "next/server";
import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { getAccountWithAccess } from "@/lib/accounts";
import { syncPostsForAccount } from "@/lib/sync";

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    const accountId = request.nextUrl.searchParams.get("accountId");
    if (!accountId) return apiError("accountId required");

    const account = await getAccountWithAccess(user, accountId, "VIEW");
    if (!account) return apiError("Account not found or access denied", 403);

    const result = await syncPostsForAccount(account.id, true);
    return apiSuccess(result);
  });
}
