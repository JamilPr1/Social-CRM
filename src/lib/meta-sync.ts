import "server-only";

import { prisma } from "./prisma";
import { encryptToken } from "./encryption";
import { getUserPages, getInstagramAccount } from "./meta-api";
import { getPageAdAccounts } from "./meta-ads-api";

export async function saveMetaUserToken(
  userId: string,
  accessToken: string,
  expiresIn?: number
) {
  const tokenExpiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000)
    : null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      metaUserAccessToken: encryptToken(accessToken),
      metaUserTokenExpiresAt: tokenExpiresAt,
    },
  });
}

export async function upsertMetaPagesFromToken(
  userId: string,
  userToken: string,
  tokenExpiresAt?: Date | null
) {
  const pages = await getUserPages(userToken);
  let synced = 0;

  for (const page of pages) {
    const instagram = await getInstagramAccount(page.id, page.access_token);
    const adAccounts = await getPageAdAccounts(page.id, page.access_token);
    const primaryAdAccount = adAccounts.find((a) => a.account_status === 1) || adAccounts[0];

    await prisma.metaAccount.upsert({
      where: { pageId: page.id },
      create: {
        pageId: page.id,
        pageName: page.name,
        pageUsername: page.username || null,
        pagePicture: page.picture?.data?.url || null,
        pageAccessToken: encryptToken(page.access_token),
        instagramId: instagram?.id || null,
        instagramUsername: instagram?.username || null,
        connectedById: userId,
        tokenExpiresAt: tokenExpiresAt || null,
        adAccountId: primaryAdAccount?.id || null,
        adAccountName: primaryAdAccount?.name || null,
      },
      update: {
        pageName: page.name,
        pageUsername: page.username || null,
        pagePicture: page.picture?.data?.url || null,
        pageAccessToken: encryptToken(page.access_token),
        instagramId: instagram?.id || null,
        instagramUsername: instagram?.username || null,
        tokenExpiresAt: tokenExpiresAt || null,
        isActive: true,
        adAccountId: primaryAdAccount?.id || null,
        adAccountName: primaryAdAccount?.name || null,
      },
    });
    synced++;
  }

  return { synced, pageNames: pages.map((p) => p.name) };
}
