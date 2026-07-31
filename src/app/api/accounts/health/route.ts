import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { getAccessibleAccounts, getDecryptedToken } from "@/lib/accounts";
import { checkPageTokenHealth } from "@/lib/meta-health";
import { getInstagramAccount } from "@/lib/meta-api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  return withAuth(async (user) => {
    const accounts = await getAccessibleAccounts(user);
    const health = await Promise.all(
      accounts.map(async (account) => {
        try {
          const full = await prisma.metaAccount.findUnique({ where: { id: account.id } });
          if (!full) return null;
          const token = getDecryptedToken(full);
          const status = await checkPageTokenHealth(token, !!full.instagramId);
          return {
            accountId: account.id,
            pageName: account.pageName,
            instagramUsername: account.instagramUsername,
            ...status,
          };
        } catch (err) {
          return {
            accountId: account.id,
            pageName: account.pageName,
            instagramUsername: account.instagramUsername,
            canPostFacebook: false,
            canPostInstagram: false,
            hasInstagramLinked: !!account.instagramId,
            issues: [
              err instanceof Error
                ? err.message
                : "Could not read saved Meta token for this page",
            ],
          };
        }
      })
    );

    return apiSuccess({ health: health.filter(Boolean) });
  });
}

export async function POST() {
  return withAuth(async (user) => {
    if (user.role !== "ADMIN") {
      return apiError("Admin only", 403);
    }

    const accounts = await prisma.metaAccount.findMany({ where: { isActive: true } });
    const updated = [];

    for (const account of accounts) {
      const token = getDecryptedToken(account);
      const instagram = await getInstagramAccount(account.pageId, token);
      await prisma.metaAccount.update({
        where: { id: account.id },
        data: {
          instagramId: instagram?.id || null,
          instagramUsername: instagram?.username || null,
        },
      });
      updated.push({
        pageName: account.pageName,
        instagram: instagram?.username || null,
      });
    }

    return apiSuccess({ updated });
  });
}
