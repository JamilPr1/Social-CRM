import "server-only";

import { prisma } from "./prisma";
import { getLinkedInConnection, resolveLinkedInOwnerId } from "./linkedin-api";

/** Meta accounts connected by admin are shared with the whole team. */
export async function getOrganizationMetaAccounts() {
  return prisma.metaAccount.findMany({
    where: { isActive: true },
    orderBy: { pageName: "asc" },
  });
}

/** Default permissions for team members on shared org accounts. */
export const TEAM_DEFAULT_PERMISSIONS = ["VIEW", "POST", "REPLY"] as const;

export async function hasOrganizationLinkedIn(actingUserId: string): Promise<boolean> {
  const ownerId = await resolveLinkedInOwnerId(actingUserId);
  if (!ownerId) return false;
  const conn = await getLinkedInConnection(ownerId);
  return Boolean(conn);
}
