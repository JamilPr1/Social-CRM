import { withAuth, apiSuccess, apiError } from "@/lib/api-helpers";
import {
  getLinkedInAuthStatus,
  deleteLinkedInConnection,
  syncLinkedInOrganizations,
  resolveLinkedInOwnerId,
} from "@/lib/linkedin-api";
import { getLinkedInConfigStatus } from "@/lib/linkedin-config";

export async function GET() {
  return withAuth(async (user) => {
    const ownerId = await resolveLinkedInOwnerId(user.id);
    if (ownerId && user.role === "ADMIN" && ownerId === user.id) {
      try {
        await syncLinkedInOrganizations(ownerId);
      } catch {
        /* org pages optional until scope approved */
      }
    }

    const [auth, config] = await Promise.all([
      getLinkedInAuthStatus(user.id),
      Promise.resolve(getLinkedInConfigStatus()),
    ]);
    return apiSuccess({ auth, config });
  });
}

export async function DELETE() {
  return withAuth(async (user) => {
    if (user.role !== "ADMIN") {
      return apiError("Only admins can disconnect LinkedIn", 403);
    }
    await deleteLinkedInConnection(user.id);
    return apiSuccess({ disconnected: true });
  });
}
