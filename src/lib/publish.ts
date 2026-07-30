import "server-only";

import { prisma } from "./prisma";
import { getAccessibleAccounts, getAccountWithAccess, getDecryptedToken, logActivity } from "./accounts";
import { createPagePost, createInstagramPost } from "./meta-api";
import { syncPostsForAccount } from "./sync";
import { getLinkedInConnection, resolveLinkedInOwnerId, getLinkedInPublishTargets } from "./linkedin-api";
import { addLinkedInPost, publishLinkedInPost } from "./linkedin-posts";
import type { SessionUser } from "@/types/session";

export type PublishPlatform = "facebook" | "instagram" | "both" | "linkedin" | "all";

export type MetaSubPlatform = "facebook" | "instagram";

/** Which Meta surfaces to publish to for a given compose platform choice. */
export function resolveMetaSubPlatforms(platform: PublishPlatform): MetaSubPlatform[] {
  switch (platform) {
    case "facebook":
      return ["facebook"];
    case "instagram":
      return ["instagram"];
    case "both":
    case "all":
      return ["facebook", "instagram"];
    default:
      return [];
  }
}

/** LinkedIn is only included for linkedin-only or explicit all-platforms flows. */
export function shouldPublishLinkedIn(
  platform: PublishPlatform,
  linkedInOptIn?: boolean
): boolean {
  if (platform === "linkedin") return true;
  if (platform === "all") return linkedInOptIn !== false;
  return false;
}

export function resolvePublishPlan(
  platform: PublishPlatform,
  linkedInOptIn?: boolean
): {
  metaTargets: MetaSubPlatform[];
  publishLinkedIn: boolean;
} {
  return {
    metaTargets: resolveMetaSubPlatforms(platform),
    publishLinkedIn: shouldPublishLinkedIn(platform, linkedInOptIn),
  };
}

export type PublishResult = {
  accountId: string;
  pageName: string;
  platform: string;
  success: boolean;
  error?: string;
  metaPostId?: string;
};

export async function publishLinkedInForUser(
  userId: string,
  message: string,
  scheduledAt?: string | null,
  imageUrl?: string
): Promise<PublishResult[]> {
  const linkedInOwnerId = await resolveLinkedInOwnerId(userId);
  const conn = linkedInOwnerId
    ? await getLinkedInConnection(linkedInOwnerId)
    : null;
  if (!conn || !linkedInOwnerId) {
    return [
      {
        accountId: "linkedin",
        pageName: "LinkedIn",
        platform: "linkedin",
        success: false,
        error: "LinkedIn not connected",
      },
    ];
  }

  const targets = await getLinkedInPublishTargets(linkedInOwnerId);
  if (targets.length === 0) {
    return [
      {
        accountId: "linkedin",
        pageName: conn.personName || "LinkedIn",
        platform: "linkedin",
        success: false,
        error: "No LinkedIn publish targets (profile or company pages)",
      },
    ];
  }

  const results: PublishResult[] = [];

  for (const target of targets) {
    try {
      if (scheduledAt) {
        const post = await addLinkedInPost(linkedInOwnerId, {
          content: message,
          scheduledAt,
          source: "crm_compose",
          sourceId: target.urn,
        });
        results.push({
          accountId: target.urn,
          pageName: target.name,
          platform: "linkedin",
          success: true,
          metaPostId: post.id,
        });
        continue;
      }

      const post = await addLinkedInPost(linkedInOwnerId, {
        content: message,
        scheduledAt: null,
        source: "crm_compose",
        sourceId: target.urn,
      });
      const published = await publishLinkedInPost(linkedInOwnerId, post.id, imageUrl);
      results.push({
        accountId: target.urn,
        pageName: target.name,
        platform: "linkedin",
        success: true,
        metaPostId: published.linkedinPostUrn || post.id,
      });
    } catch (err) {
      results.push({
        accountId: target.urn,
        pageName: target.name,
        platform: "linkedin",
        success: false,
        error: err instanceof Error ? err.message : "LinkedIn publish failed",
      });
    }
  }

  return results;
}

export async function publishToAccounts(
  user: SessionUser,
  options: {
    accountIds: string[];
    message: string;
    targets: readonly MetaSubPlatform[];
    imageUrl?: string;
  }
) {
  const results: PublishResult[] = [];
  for (const accountId of options.accountIds) {
    const account = await getAccountWithAccess(user, accountId, "POST");
    if (!account) {
      for (const platform of options.targets) {
        results.push({
          accountId,
          pageName: "Unknown",
          platform,
          success: false,
          error: "No post permission",
        });
      }
      continue;
    }

    const token = getDecryptedToken(account);

    for (const platform of options.targets) {
      try {
        if (platform === "instagram") {
          if (!account.instagramId) {
            results.push({
              accountId,
              pageName: account.pageName,
              platform,
              success: false,
              error: "No Instagram linked",
            });
            continue;
          }
          if (!options.imageUrl) {
            results.push({
              accountId,
              pageName: account.pageName,
              platform,
              success: false,
              error: "Image URL required for Instagram",
            });
            continue;
          }
          const result = await createInstagramPost(
            account.instagramId,
            token,
            options.imageUrl,
            options.message
          );
          results.push({
            accountId,
            pageName: account.pageName,
            platform,
            success: true,
            metaPostId: result.id,
          });
        } else {
          const result = await createPagePost(
            account.pageId,
            token,
            options.message,
            options.imageUrl
          );
          results.push({
            accountId,
            pageName: account.pageName,
            platform,
            success: true,
            metaPostId: result.id,
          });
        }
        void syncPostsForAccount(account.id, true);
      } catch (err) {
        results.push({
          accountId,
          pageName: account.pageName,
          platform,
          success: false,
          error: err instanceof Error ? err.message : "Publish failed",
        });
      }
    }
  }

  const successCount = results.filter((r) => r.success).length;
  logActivity(
    user.id,
    "BULK_CREATE_POST",
    `Published to ${successCount}/${results.length} targets`
  );

  return results;
}

export async function publishToAllPlatforms(
  user: SessionUser,
  options: {
    accountIds: string[];
    message: string;
    platform: PublishPlatform;
    imageUrl?: string;
    scheduledAt?: string | null;
    /** User opt-in for LinkedIn when platform is "all". Ignored for other platforms. */
    linkedInOptIn?: boolean;
  }
): Promise<PublishResult[]> {
  const results: PublishResult[] = [];
  const { metaTargets, publishLinkedIn } = resolvePublishPlan(
    options.platform,
    options.linkedInOptIn
  );

  if (metaTargets.length > 0 && options.accountIds.length > 0) {
    const metaResults = await publishToAccounts(user, {
      accountIds: options.accountIds,
      message: options.message,
      targets: metaTargets,
      imageUrl: options.imageUrl,
    });
    results.push(...metaResults);
  }

  if (publishLinkedIn) {
    const linkedInResults = await publishLinkedInForUser(
      user.id,
      options.message,
      options.scheduledAt,
      options.imageUrl
    );
    results.push(...linkedInResults);
  }

  return results;
}

export async function getPostableAccountIds(user: SessionUser): Promise<string[]> {
  const accounts = await getAccessibleAccounts(user);
  if (user.role === "ADMIN") {
    return accounts.map((a) => a.id);
  }

  const accessByAccount = await prisma.accountAccess.findMany({
    where: { userId: user.id },
    select: { metaAccountId: true, permissions: true },
  });
  const explicit = new Map(accessByAccount.map((a) => [a.metaAccountId, a.permissions]));

  return accounts
    .filter((account) => {
      const raw = explicit.get(account.id);
      if (!raw) return true;
      try {
        const perms = JSON.parse(raw) as string[];
        return perms.includes("POST") || perms.includes("MANAGE");
      } catch {
        return true;
      }
    })
    .map((a) => a.id);
}

export async function publishDueScheduledPosts() {
  const due = await prisma.scheduledPost.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: new Date() },
    },
    take: 20,
  });

  const published: string[] = [];

  for (const item of due) {
    await prisma.scheduledPost.update({
      where: { id: item.id },
      data: { status: "PUBLISHING" },
    });

    try {
      const user = await prisma.user.findUnique({ where: { id: item.createdById } });
      if (!user) throw new Error("User not found");

      const accountIds = JSON.parse(item.accountIds) as string[];
      const platform = item.platform as PublishPlatform;
      const results = await publishToAllPlatforms(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        {
          accountIds,
          message: item.message,
          platform,
          imageUrl: item.imageUrl || undefined,
        }
      );

      const allSuccess = results.every((r) => r.success);
      await prisma.scheduledPost.update({
        where: { id: item.id },
        data: {
          status: allSuccess ? "PUBLISHED" : "FAILED",
          publishResults: JSON.stringify(results),
        },
      });
      published.push(item.id);
    } catch (err) {
      await prisma.scheduledPost.update({
        where: { id: item.id },
        data: {
          status: "FAILED",
          publishResults: JSON.stringify({
            error: err instanceof Error ? err.message : "Failed",
          }),
        },
      });
    }
  }

  return published;
}
