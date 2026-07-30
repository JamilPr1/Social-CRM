import { withAuth, apiSuccess } from "@/lib/api-helpers";
import { getLinkedInAuthStatus, deleteLinkedInConnection } from "@/lib/linkedin-api";
import { getLinkedInConfigStatus } from "@/lib/linkedin-config";

export async function GET() {
  return withAuth(async (user) => {
    const [auth, config] = await Promise.all([
      getLinkedInAuthStatus(user.id),
      Promise.resolve(getLinkedInConfigStatus()),
    ]);
    return apiSuccess({ auth, config });
  });
}

export async function DELETE() {
  return withAuth(async (user) => {
    await deleteLinkedInConnection(user.id);
    return apiSuccess({ disconnected: true });
  });
}
