import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/encryption";
import { logActivity } from "@/lib/accounts";
import { upsertMetaPagesFromToken } from "@/lib/meta-sync";

export async function POST() {
  return withAuth(async (user) => {
    if (user.role !== "ADMIN") {
      return apiError("Only admins can sync Meta pages", 403);
    }

    const admin = await prisma.user.findUnique({
      where: { id: user.id },
      select: { metaUserAccessToken: true, metaUserTokenExpiresAt: true },
    });

    if (!admin?.metaUserAccessToken) {
      return apiError("Reconnect Meta first to enable page sync", 400);
    }

    try {
      const userToken = decryptToken(admin.metaUserAccessToken);
      const { synced, pageNames } = await upsertMetaPagesFromToken(
        user.id,
        userToken,
        admin.metaUserTokenExpiresAt
      );

      logActivity(user.id, "SYNC_META_PAGES", `Synced ${synced} page(s)`);

      return apiSuccess({
        synced,
        pageNames,
        message:
          synced > 0
            ? `Synced ${synced} page(s) from Meta`
            : "No Facebook Pages found on your Meta account",
      });
    } catch (err) {
      return apiError(
        err instanceof Error ? err.message : "Failed to sync Meta pages",
        500
      );
    }
  });
}
