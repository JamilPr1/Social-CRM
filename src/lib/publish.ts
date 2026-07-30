import "server-only";

import { prisma } from "./prisma";
import { getAccessibleAccounts, getAccountWithAccess, getDecryptedToken, logActivity } from "./accounts";
import { createPagePost, createInstagramPost } from "./meta-api";
import { syncPostsForAccount } from "./sync";
import { getLinkedInConnection } from "./linkedin-api";
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
  includeLinkedIn?: boolean
): boolean {
  if (platform === "linkedin") return true;
  if (platform === "all") return includeLinkedIn !== false;
  return false;
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
): Promise<PublishResult> {
  const conn = await getLinkedInConnection(userId);
  const pageName = conn?.personName || "LinkedIn";
  if (!conn) {
    return {
      accountId: "linkedin",
      pageName,
      platform: "linkedin",
      success: false,
      error: "LinkedIn not connected",
    };
  }

  try {
    const post = await addLinkedInPost(userId, {
      content: message,
      scheduledAt: scheduledAt || null,
      source: "crm_compose",
    });

    if (scheduledAt) {
      return {
        accountId: "linkedin",
        pageName,
        platform: "linkedin",
        success: true,
        metaPostId: post.id,
      };
    }

    const published = await publishLinkedInPost(userId, post.id, imageUrl);
    return {
      accountId: "linkedin",
      pageName,
      platform: "linkedin",
      success: true,
      metaPostId: published.linkedinPostUrn || post.id,
    };
  } catch (err) {
    return {
      accountId: "linkedin",
      pageName,
      platform: "linkedin",
      success: false,
      error: err instanceof Error ? err.message : "LinkedIn publish failed",
    };
  }
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
    includeLinkedIn?: boolean;
  }
): Promise<PublishResult[]> {
  const results: PublishResult[] = [];
  const metaTargets = resolveMetaSubPlatforms(options.platform);
  const publishLinkedIn = shouldPublishLinkedIn(
    options.platform,
    options.includeLinkedIn
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
    results.push(
      await publishLinkedInForUser(
        user.id,
        options.message,
        options.scheduledAt,
        options.imageUrl
      )
    );
  }

  return results;
}

export async function getPostableAccountIds(user: SessionUser): Promise<string[]> {  if (user.role === "ADMIN") {
    const accounts = await getAccessibleAccounts(user);
    return accounts.map((a) => a.id);
  }

  const access = await prisma.accountAccess.findMany({
    where: { userId: user.id },
    select: { metaAccountId: true, permissions: true },
  });

  return access
    .filter((a) => {
      try {
        const perms = JSON.parse(a.permissions) as string[];
        return perms.includes("POST") || perms.includes("MANAGE");
      } catch {
        return false;
      }
    })
    .map((a) => a.metaAccountId);
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
          includeLinkedIn: shouldPublishLinkedIn(platform),
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
