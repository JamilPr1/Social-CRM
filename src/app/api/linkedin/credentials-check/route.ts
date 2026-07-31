import { withAuth, apiSuccess, apiError } from "@/lib/api-helpers";
import { getLinkedInCredentialsStatus, getLinkedInOAuthDebugInfo } from "@/lib/linkedin-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Admin-only: verify LinkedIn OAuth credentials loaded on server (no secrets exposed). */
export async function GET() {
  return withAuth(async (user) => {
    if (user.role !== "ADMIN") {
      return apiError("Admin only", 403);
    }
    return apiSuccess({
      ...getLinkedInCredentialsStatus(),
      ...getLinkedInOAuthDebugInfo(),
    });
  });
}
