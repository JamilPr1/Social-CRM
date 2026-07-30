import "server-only";

import { prisma } from "./prisma";
import { encryptToken, decryptToken } from "./encryption";
import { linkedInEnv, getLinkedInScopes } from "./linkedin-config";

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_API = "https://api.linkedin.com/rest";

export function getLinkedInAuthUrl(state: string, redirectUri?: string) {
  const uri = redirectUri || linkedInEnv.redirectUri;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: linkedInEnv.clientId,
    redirect_uri: uri,
    scope: getLinkedInScopes().join(" "),
    state,
  });
  return `${LINKEDIN_AUTH_URL}?${params}`;
}

export async function exchangeLinkedInCode(code: string, redirectUri?: string) {
  const uri = redirectUri || linkedInEnv.redirectUri;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: linkedInEnv.clientId,
    client_secret: linkedInEnv.clientSecret,
    redirect_uri: uri,
  });

  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${await res.text()}`);
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }>;
}

export async function fetchLinkedInProfile(accessToken: string) {
  const res = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ sub?: string; name?: string; email?: string }>;
}

export async function saveLinkedInConnection(
  userId: string,
  tokenData: { access_token: string; refresh_token?: string; expires_in?: number },
  profile?: { sub?: string; name?: string; email?: string; personUrn?: string }
) {
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000)
    : null;
  const personUrn = profile?.personUrn || (profile?.sub ? `urn:li:person:${profile.sub}` : null);

  return prisma.linkedInConnection.upsert({
    where: { userId },
    create: {
      userId,
      accessToken: encryptToken(tokenData.access_token),
      refreshToken: tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null,
      expiresAt,
      personUrn,
      personName: profile?.name || null,
      personEmail: profile?.email || null,
    },
    update: {
      accessToken: encryptToken(tokenData.access_token),
      refreshToken: tokenData.refresh_token
        ? encryptToken(tokenData.refresh_token)
        : undefined,
      expiresAt,
      personUrn: personUrn || undefined,
      personName: profile?.name || undefined,
      personEmail: profile?.email || undefined,
    },
  });
}

export async function deleteLinkedInConnection(userId: string) {
  await prisma.linkedInConnection.deleteMany({ where: { userId } });
}

export async function getLinkedInConnection(userId: string) {
  return prisma.linkedInConnection.findUnique({ where: { userId } });
}

/** Admin-connected LinkedIn is shared with the team for publishing. */
export async function resolveLinkedInOwnerId(actingUserId: string): Promise<string | null> {
  const own = await getLinkedInConnection(actingUserId);
  if (own) return actingUserId;

  const admin = await prisma.user.findFirst({
    where: {
      role: "ADMIN",
      isActive: true,
      linkedInConnection: { isNot: null },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  return admin?.id ?? null;
}

async function refreshLinkedInToken(userId: string, refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: linkedInEnv.clientId,
    client_secret: linkedInEnv.clientSecret,
  });

  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) return null;

  const data = await res.json();
  const existing = await getLinkedInConnection(userId);
  await saveLinkedInConnection(userId, data, {
    personUrn: existing?.personUrn || undefined,
    name: existing?.personName || undefined,
    email: existing?.personEmail || undefined,
  });
  return data.access_token as string;
}

export async function ensureLinkedInPersonUrn(userId: string): Promise<string | null> {
  const conn = await getLinkedInConnection(userId);
  if (!conn) return null;
  if (conn.personUrn) return conn.personUrn;

  try {
    const token = await getValidLinkedInAccessToken(userId);
    if (!token) return null;
    const profile = await fetchLinkedInProfile(token);
    if (!profile?.sub) return null;
    await saveLinkedInConnection(userId, { access_token: token }, profile);
    return `urn:li:person:${profile.sub}`;
  } catch {
    return null;
  }
}

export async function getValidLinkedInAccessToken(userId: string) {
  const conn = await getLinkedInConnection(userId);
  if (!conn) return null;

  let accessToken: string;
  try {
    accessToken = decryptToken(conn.accessToken);
  } catch {
    throw new Error(
      "LinkedIn token could not be decrypted. Disconnect and reconnect LinkedIn on this environment."
    );
  }

  if (conn.expiresAt && Date.now() < conn.expiresAt.getTime() - 60000) {
    return accessToken;
  }

  if (!conn.refreshToken) return accessToken;

  const refreshed = await refreshLinkedInToken(userId, decryptToken(conn.refreshToken));
  return refreshed || accessToken;
}

async function linkedInRawRequest(userId: string, path: string, options: RequestInit = {}) {
  const accessToken = await getValidLinkedInAccessToken(userId);
  if (!accessToken) throw new Error("Not authenticated with LinkedIn");

  const res = await fetch(`${LINKEDIN_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": linkedInEnv.apiVersion,
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`LinkedIn API error (${res.status}): ${await res.text()}`);
  }

  const text = await res.text();
  return {
    data: text ? JSON.parse(text) : null,
    restliId: res.headers.get("x-restli-id"),
  };
}

async function linkedInRequest(userId: string, path: string, options: RequestInit = {}) {
  const { data } = await linkedInRawRequest(userId, path, options);
  return data;
}

export function isValidLinkedInPostUrn(urn: string | null | undefined): urn is string {
  return Boolean(urn && urn.startsWith("urn:li:"));
}

export async function createLinkedInPost(
  userId: string,
  content: string,
  visibility = "PUBLIC",
  imageUrl?: string
) {
  let conn = await getLinkedInConnection(userId);
  if (!conn?.personUrn) {
    const token = await getValidLinkedInAccessToken(userId);
    if (token) {
      const profile = await fetchLinkedInProfile(token);
      if (profile?.sub) {
        await saveLinkedInConnection(userId, { access_token: token }, profile);
        conn = await getLinkedInConnection(userId);
      }
    }
  }

  const author = conn?.personUrn;
  if (!author) throw new Error("Could not determine LinkedIn person URN. Re-authenticate.");

  const postBody: Record<string, unknown> = {
    author,
    commentary: content,
    visibility,
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  if (imageUrl) {
    const imageUrn = await uploadLinkedInImageFromUrl(userId, author, imageUrl);
    postBody.content = { media: { id: imageUrn } };
  }

  const { data, restliId } = await linkedInRawRequest(userId, "/posts", {
    method: "POST",
    body: JSON.stringify(postBody),
  });

  const id =
    restliId ||
    (data as { id?: string } | null)?.id ||
    null;
  if (!isValidLinkedInPostUrn(id)) {
    throw new Error("LinkedIn did not return a post URN. Try syncing posts from LinkedIn.");
  }

  return { ...(data || {}), id };
}

async function uploadLinkedInImageFromUrl(
  userId: string,
  ownerUrn: string,
  imageUrl: string
): Promise<string> {
  const init = (await linkedInRequest(userId, "/images?action=initializeUpload", {
    method: "POST",
    body: JSON.stringify({
      initializeUploadRequest: { owner: ownerUrn },
    }),
  })) as { value?: { uploadUrl?: string; image?: string } };

  const uploadUrl = init?.value?.uploadUrl;
  const imageUrn = init?.value?.image;
  if (!uploadUrl || !imageUrn) {
    throw new Error("LinkedIn image upload initialization failed");
  }

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error("Could not download image for LinkedIn upload");
  }
  const bytes = await imgRes.arrayBuffer();
  const token = await getValidLinkedInAccessToken(userId);
  if (!token) throw new Error("LinkedIn not authenticated");

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
    },
    body: bytes,
  });

  if (!uploadRes.ok) {
    throw new Error("LinkedIn image upload failed");
  }

  return imageUrn;
}

export async function getLinkedInAuthStatus(actingUserId: string) {
  const ownerId = await resolveLinkedInOwnerId(actingUserId);
  if (!ownerId) {
    return {
      authenticated: false,
      shared: false,
      profile: null,
      expiresAt: null,
      personName: null,
    };
  }

  const conn = await getLinkedInConnection(ownerId);
  const authenticated = Boolean(conn?.accessToken);
  const shared = ownerId !== actingUserId;

  let profile: { name?: string; email?: string } | null = null;
  if (authenticated) {
    try {
      const token = await getValidLinkedInAccessToken(ownerId);
      if (token) {
        const p = await fetchLinkedInProfile(token);
        profile = p ? { name: p.name, email: p.email } : { name: conn?.personName || undefined };
      }
    } catch {
      profile = { name: conn?.personName || undefined };
    }
  }

  return {
    authenticated,
    shared,
    profile,
    expiresAt: conn?.expiresAt?.toISOString() || null,
    personName: conn?.personName || null,
  };
}

export interface LinkedInApiPost {
  id: string;
  commentary?: string;
  createdAt?: number;
  lifecycleState?: string;
}

export async function fetchLinkedInMemberPosts(userId: string, count = 50) {
  const personUrn = await ensureLinkedInPersonUrn(userId);
  if (!personUrn) {
    return {
      posts: [] as LinkedInApiPost[],
      error: "LinkedIn profile URN missing — disconnect and reconnect LinkedIn.",
    };
  }

  try {
    const author = encodeURIComponent(personUrn);
    const result = (await linkedInRequest(
      userId,
      `/posts?q=author&author=${author}&count=${count}&sortBy=LAST_MODIFIED`
    )) as { elements?: LinkedInApiPost[] };
    const posts = result?.elements || [];
    return { posts, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch LinkedIn posts";
    const hint = message.includes("403") || message.includes("ACCESS_DENIED")
      ? " LinkedIn post import needs Community Management API on your developer app."
      : "";
    return {
      posts: [] as LinkedInApiPost[],
      error: message + hint,
    };
  }
}

export function linkedInPostPermalink(urn: string | null | undefined) {
  if (!isValidLinkedInPostUrn(urn)) return null;
  return `https://www.linkedin.com/feed/update/${encodeURIComponent(urn)}`;
}

export function parseLinkedInUrnFromUrl(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.startsWith("urn:li:")) return trimmed;

  const urnMatch = trimmed.match(/urn:li:(?:ugcPost|share|activity):[A-Za-z0-9_-]+/);
  if (urnMatch) return urnMatch[0];

  try {
    const url = new URL(trimmed);
    const pathMatch = url.pathname.match(/urn:li:(?:ugcPost|share|activity):[A-Za-z0-9_-]+/);
    if (pathMatch) return decodeURIComponent(pathMatch[0]);
    const decoded = decodeURIComponent(url.pathname + url.search);
    const decodedMatch = decoded.match(/urn:li:(?:ugcPost|share|activity):[A-Za-z0-9_-]+/);
    if (decodedMatch) return decodedMatch[0];
  } catch {
    return null;
  }

  return null;
}

function buildAnalyticsEntity(urn: string) {
  if (urn.includes("ugcPost")) {
    return `(ugc:${encodeURIComponent(urn)})`;
  }
  return `(share:${encodeURIComponent(urn)})`;
}

export async function fetchLinkedInPostMetric(
  userId: string,
  postUrn: string,
  queryType: "IMPRESSION" | "COMMENT" | "REACTION" | "RESHARE" | "MEMBERS_REACHED"
): Promise<number> {
  try {
    const entity = buildAnalyticsEntity(postUrn);
    const result = (await linkedInRequest(
      userId,
      `/memberCreatorPostAnalytics?q=entity&entity=${entity}&queryType=${queryType}&aggregation=TOTAL`
    )) as { elements?: Array<{ count?: number }> };
    return result?.elements?.[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

export async function fetchLinkedInPostAnalytics(userId: string, postUrn: string) {
  const [impressions, commentCount, reactionCount, reshareCount, membersReached] =
    await Promise.all([
      fetchLinkedInPostMetric(userId, postUrn, "IMPRESSION"),
      fetchLinkedInPostMetric(userId, postUrn, "COMMENT"),
      fetchLinkedInPostMetric(userId, postUrn, "REACTION"),
      fetchLinkedInPostMetric(userId, postUrn, "RESHARE"),
      fetchLinkedInPostMetric(userId, postUrn, "MEMBERS_REACHED"),
    ]);

  return { impressions, commentCount, reactionCount, reshareCount, membersReached };
}

export async function probeLinkedInAnalyticsAccess(userId: string): Promise<boolean> {
  try {
    await linkedInRawRequest(
      userId,
      `/memberCreatorPostAnalytics?q=me&queryType=IMPRESSION&aggregation=TOTAL`
    );
    return true;
  } catch (err) {
    return !(err instanceof Error && err.message.includes("ACCESS_DENIED"));
  }
}

export async function fetchLinkedInMemberAnalytics(
  userId: string,
  queryType: "IMPRESSION" | "COMMENT" | "REACTION" | "RESHARE" | "MEMBERS_REACHED"
): Promise<number> {
  try {
    const result = (await linkedInRequest(
      userId,
      `/memberCreatorPostAnalytics?q=me&queryType=${queryType}&aggregation=TOTAL`
    )) as { elements?: Array<{ count?: number }> };
    return result?.elements?.[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

export interface LinkedInApiComment {
  id?: string;
  message?: { text?: string };
  actor?: string;
  created?: { time?: number };
  commentUrn?: string;
}

export async function fetchLinkedInPostComments(userId: string, postUrn: string) {
  try {
    const encoded = encodeURIComponent(postUrn);
    const result = (await linkedInRequest(
      userId,
      `/socialActions/${encoded}/comments`
    )) as { elements?: LinkedInApiComment[] };
    return { comments: result?.elements || [], error: null };
  } catch (err) {
    return {
      comments: [] as LinkedInApiComment[],
      error: err instanceof Error ? err.message : "Failed to fetch comments",
    };
  }
}
