import { NextRequest } from "next/server";
import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { getAccessibleAccountIds, getAccountWithAccess } from "@/lib/accounts";
import { syncAllForAccount } from "@/lib/sync";

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    const accountId = request.nextUrl.searchParams.get("accountId");
    if (!accountId) return apiError("accountId required");

    if (accountId === "all") {
      const ids = await getAccessibleAccountIds(user);
      if (ids.length === 0) return apiSuccess({ results: [] });

      const results = await Promise.all(
        ids.map(async (id) => {
          const result = await syncAllForAccount(id, true);
          return { accountId: id, ...result };
        })
      );

      const totals = {
        posts: results.reduce((n, r) => n + (r.posts.count || 0), 0),
        comments: results.reduce((n, r) => n + (r.comments.count || 0), 0),
        messages: results.reduce((n, r) => n + (r.messages.count || 0), 0),
      };

      return apiSuccess({ results, totals, synced: true });
    }

    const account = await getAccountWithAccess(user, accountId, "VIEW");
    if (!account) return apiError("Account not found or access denied", 403);

    const result = await syncAllForAccount(account.id, true);
    return apiSuccess({
      ...result,
      synced: true,
      totals: {
        posts: result.posts.count || 0,
        comments: result.comments.count || 0,
        messages: result.messages.count || 0,
      },
    });
  });
}
