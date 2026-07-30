import "server-only";

import { prisma } from "./prisma";
import { decryptToken } from "./encryption";
import { parsePermissions, hasPermission } from "./utils";
import type { SafeAccount } from "@/types/account";
import type { SessionUser } from "@/types/session";

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

export async function getAccessibleAccounts(user: SessionUser): Promise<SafeAccount[]> {
  if (user.role === "ADMIN") {
    return prisma.metaAccount.findMany({
      where: { isActive: true },
      select: safeAccountSelect,
      orderBy: { pageName: "asc" },
    });
  }

  const access = await prisma.accountAccess.findMany({
    where: { userId: user.id },
    select: {
      metaAccount: { select: safeAccountSelect },
    },
  });

  return access
    .filter((a) => a.metaAccount.isActive)
    .map((a) => a.metaAccount);
}

export async function getAccessibleAccountIds(user: SessionUser): Promise<string[]> {
  const accounts = await getAccessibleAccounts(user);
  return accounts.map((a) => a.id);
}

export async function getAccountWithAccess(
  user: SessionUser,
  accountId: string,
  requiredPermission: "VIEW" | "POST" | "REPLY" | "BOOST" | "MANAGE" = "VIEW"
) {
  if (user.role === "ADMIN") {
    return prisma.metaAccount.findFirst({
      where: { id: accountId, isActive: true },
    });
  }

  const access = await prisma.accountAccess.findUnique({
    where: {
      userId_metaAccountId: { userId: user.id, metaAccountId: accountId },
    },
    include: {
      metaAccount: true,
    },
  });

  if (!access?.metaAccount.isActive) return null;

  const permissions = parsePermissions(access.permissions);
  if (!hasPermission(permissions, requiredPermission)) return null;

  return access.metaAccount;
}

export function getDecryptedToken(account: { pageAccessToken: string }) {
  return decryptToken(account.pageAccessToken);
}

export function logActivity(userId: string, action: string, details?: string) {
  void prisma.activityLog
    .create({ data: { userId, action, details } })
    .catch(() => {});
}
