import { withAuth, apiSuccess } from "@/lib/api-helpers";
import { getAccessibleAccounts } from "@/lib/accounts";

export async function GET() {
  return withAuth(async (user) => {
    const accounts = await getAccessibleAccounts(user);
    return apiSuccess(
      { accounts },
      200,
      { "Cache-Control": "private, max-age=30" }
    );
  });
}
