import { apiSuccess } from "@/lib/api-helpers";
import { getLinkedInOAuthDebugInfo } from "@/lib/linkedin-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Public: which OAuth scopes/products production will use (no secrets). */
export async function GET() {
  return apiSuccess(getLinkedInOAuthDebugInfo());
}
