import "server-only";

import { prisma } from "./prisma";
import { decryptToken } from "./encryption";
import { parsePermissions, hasPermission } from "./utils";
import type { SafeAccount } from "@/types/account";
import type { SessionUser } from "@/types/session";
import { TEAM_DEFAULT_PERMISSIONS } from "./org-resources";

export const safeAccountSelect = {
  id: true,
  pageId: true,
  pageName: true,
  pageUsername: true,
  pagePicture: true,
  instagramId: true,
  instagramUsername: true,
  isActive: true,
  lastSyncedAt: true,
  adAccountId: true,
  adAccountName: true,
  createdAt: true,
} as const;

/** All active Meta pages connected by admin — shared with the team. */
export async function getAccessibleAccounts(user: SessionUser): Promise<SafeAccount[]> {
  void user;
  return prisma.metaAccount.findMany({
    where: { isActive: true },
    select: safeAccountSelect,
    orderBy: { pageName: "asc" },
  });
}

export async function getAccessibleAccountIds(user: SessionUser): Promise<string[]> {
  const accounts = await getAccessibleAccounts(user);
  return accounts.map((a) => a.id);
}

function memberHasPermission(
  explicitPermissions: string[] | null,
  required: "VIEW" | "POST" | "REPLY" | "BOOST" | "MANAGE"
): boolean {
  if (required === "MANAGE" || required === "BOOST") {
    if (!explicitPermissions) return false;
    return hasPermission(explicitPermissions, required);
  }
  if (explicitPermissions) {
    return hasPermission(explicitPermissions, required);
  }
  return (TEAM_DEFAULT_PERMISSIONS as readonly string[]).includes(required);
}

export async function getAccountWithAccess(
  user: SessionUser,
  accountId: string,
  requiredPermission: "VIEW" | "POST" | "REPLY" | "BOOST" | "MANAGE" = "VIEW"
) {
  const account = await prisma.metaAccount.findFirst({
    where: { id: accountId, isActive: true },
  });
  if (!account) return null;

  if (user.role === "ADMIN") return account;

  const access = await prisma.accountAccess.findUnique({
    where: {
      userId_metaAccountId: { userId: user.id, metaAccountId: accountId },
    },
  });

  const permissions = access ? parsePermissions(access.permissions) : null;
  if (!memberHasPermission(permissions, requiredPermission)) return null;

  return account;
}

export function getDecryptedToken(account: { pageAccessToken: string }) {
  return decryptToken(account.pageAccessToken);
}

export function logActivity(userId: string, action: string, details?: string) {
  void prisma.activityLog
    .create({ data: { userId, action, details } })
    .catch(() => {});
}
