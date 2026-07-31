import "server-only";

import { prisma } from "./prisma";
import { encryptToken, decryptToken } from "./encryption";
import { linkedInEnv, getLinkedInScopes, shouldRequestLinkedInOrgScopes, getLinkedInOrganizationIds, getLinkedInClientCredentials } from "./linkedin-config";

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_API = "https://api.linkedin.com/rest";

export type LinkedInManagedOrg = { id: string; urn: string; name: string };

const LINKEDIN_POST_ROLES = new Set([
  "ADMINISTRATOR",
  "CONTENT_ADMIN",
  "DIRECT_SPONSORED_CONTENT_POSTER",
]);

export function parseManagedOrganizations(json: string | null | undefined): LinkedInManagedOrg[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as LinkedInManagedOrg[];
    return Array.isArray(parsed) ? parsed.filter((o) => o.urn && o.name) : [];
  } catch {
    return [];
  }
}

export async function fetchLinkedInOrganizations(userId: string): Promise<LinkedInManagedOrg[]> {
  const fromApi = await fetchLinkedInOrganizationsFromApi(userId);
  if (fromApi.length > 0) return fromApi;
  return fetchLinkedInOrganizationsFromEnv(userId);
}

async function fetchLinkedInOrganizationsFromApi(userId: string): Promise<LinkedInManagedOrg[]> {
  try {
    const data = (await linkedInRequest(
      userId,
      "/organizationAcls?q=roleAssignee&count=100"
    )) as {
      elements?: Array<Record<string, unknown>>;
    };

    const orgs: LinkedInManagedOrg[] = [];
    const seen = new Set<string>();

    for (const el of data?.elements || []) {
      const role = typeof el.role === "string" ? el.role : undefined;
      if (role && !LINKEDIN_POST_ROLES.has(role)) continue;

      const orgRef =
        (typeof el.organization === "string" && el.organization) ||
        (typeof el.organizationalTarget === "string" && el.organizationalTarget) ||
        null;

      const expanded = el["organization~"] as { id?: number; localizedName?: string } | undefined;
      const urn =
        orgRef ||
        (expanded?.id ? `urn:li:organization:${expanded.id}` : null);
      if (!urn || !urn.includes("organization:") || seen.has(urn)) continue;

      const id = expanded?.id ? String(expanded.id) : urn.split(":").pop() || urn;
      seen.add(urn);
      orgs.push({
        id,
        urn,
        name: expanded?.localizedName || `Company Page ${id}`,
      });
    }

    return orgs;
  } catch (err) {
    console.warn("LinkedIn organizations fetch failed:", err);
    return [];
  }
}

async function fetchLinkedInOrganizationById(
  userId: string,
  orgId: string
): Promise<LinkedInManagedOrg | null> {
  const urn = `urn:li:organization:${orgId}`;
  const fallbacks: LinkedInManagedOrg = {
    id: orgId,
    urn,
    name: orgId === "102438302" ? "Arfa Developers" : `Company Page ${orgId}`,
  };

  try {
    const data = (await linkedInRequest(userId, `/organizations/${orgId}`)) as {
      id?: number;
      localizedName?: string;
      vanityName?: string;
    };
    const id = data?.id ? String(data.id) : orgId;
    return {
      id,
      urn: `urn:li:organization:${id}`,
      name: data?.localizedName || data?.vanityName || fallbacks.name,
    };
  } catch {
    return fallbacks;
  }
}

async function fetchLinkedInOrganizationsFromEnv(userId: string): Promise<LinkedInManagedOrg[]> {
  const ids = getLinkedInOrganizationIds();
  if (ids.length === 0) return [];

  const orgs: LinkedInManagedOrg[] = [];
  for (const orgId of ids) {
    const org = await fetchLinkedInOrganizationById(userId, orgId);
    if (org) orgs.push(org);
  }
  return orgs;
}

export async function syncLinkedInOrganizations(userId: string): Promise<LinkedInManagedOrg[]> {
  const fromApi = await fetchLinkedInOrganizationsFromApi(userId);
  const envOrgs = await fetchLinkedInOrganizationsFromEnv(userId);
  const merged = new Map<string, LinkedInManagedOrg>();
  for (const org of [...fromApi, ...envOrgs]) merged.set(org.urn, org);
  const orgs = [...merged.values()];

  await prisma.linkedInConnection.update({
    where: { userId },
    data: { managedOrganizations: JSON.stringify(orgs) },
  });
  return orgs;
}

export async function getLinkedInPublishTargets(userId: string) {
  const conn = await getLinkedInConnection(userId);
  if (!conn) return [];

  const { canPostToOrg } = await resolveLinkedInOrgCapabilities(userId);

  const targets: Array<{ urn: string; name: string; type: "person" | "organization" }> = [];
  if (conn.personUrn) {
    targets.push({
      urn: conn.personUrn,
      name: conn.personName || "LinkedIn Profile",
      type: "person",
    });
  }

  if (!canPostToOrg) {
    return targets;
  }

  const orgMap = new Map<string, LinkedInManagedOrg>();
  for (const org of parseManagedOrganizations(conn.managedOrganizations)) {
    orgMap.set(org.urn, org);
  }
  for (const org of getLinkedInOrganizationIds()) {
    const urn = `urn:li:organization:${org}`;
    if (!orgMap.has(urn)) {
      const displayName = org === "102438302" ? "Arfa Developers" : `Company Page ${org}`;
      orgMap.set(urn, { id: org, urn, name: displayName });
    }
  }
  for (const org of orgMap.values()) {
    targets.push({ urn: org.urn, name: org.name, type: "organization" });
  }

  return targets;
}

export function connectionHasOrgScopes(
  conn: { grantedScopes?: string | null } | null
): boolean {
  if (!conn?.grantedScopes) return false;
  try {
    const scopes = JSON.parse(conn.grantedScopes) as string[];
    return scopes.includes("w_organization_social");
  } catch {
    return false;
  }
}

export function linkedInNeedsOrgReconnect(
  conn: { grantedScopes?: string | null } | null
): boolean {
  return shouldRequestLinkedInOrgScopes() && !connectionHasOrgScopes(conn);
}

export function linkedInOrgReconnectMessage(missingFromToken = false) {
  if (missingFromToken) {
    return "LinkedIn did not grant organization posting permission. In LinkedIn Developer Portal, enable Share on LinkedIn with company-page access, redeploy Vercel with LINKEDIN_ORGANIZATION_IDS=102438302, then reconnect.";
  }
  return "Reconnect LinkedIn on the Accounts page to enable company page posting (requires organization permission).";
}

/** Live check — tries org media init (requires w_organization_social). Updates DB if successful. */
export async function probeLinkedInOrgPostingEnabled(userId: string): Promise<boolean> {
  const conn = await getLinkedInConnection(userId);
  if (!conn) return false;
  if (connectionHasOrgScopes(conn)) return true;
  if (!shouldRequestLinkedInOrgScopes()) return false;

  const orgId = getLinkedInOrganizationIds()[0];
  if (!orgId) return false;

  try {
    const ownerUrn = `urn:li:organization:${orgId}`;
    await linkedInRequest(userId, "/images?action=initializeUpload", {
      method: "POST",
      body: JSON.stringify({ initializeUploadRequest: { owner: ownerUrn } }),
    });

    const scopes = new Set(scopesFromTokenData({ scope: undefined }));
    try {
      const existing = conn.grantedScopes ? (JSON.parse(conn.grantedScopes) as string[]) : [];
      for (const s of existing) scopes.add(s);
    } catch {
      /* ignore */
    }
    scopes.add("w_organization_social");
    scopes.add("r_organization_social");

    await prisma.linkedInConnection.update({
      where: { userId },
      data: { grantedScopes: JSON.stringify([...scopes]) },
    });
    return true;
  } catch {
    return false;
  }
}

export async function resolveLinkedInOrgCapabilities(userId: string) {
  const conn = await getLinkedInConnection(userId);
  const wantsOrg = shouldRequestLinkedInOrgScopes();
  const configuredOrgIds = getLinkedInOrganizationIds();
  let canPostToOrg = connectionHasOrgScopes(conn);
  if (!canPostToOrg && wantsOrg) {
    canPostToOrg = await probeLinkedInOrgPostingEnabled(userId);
  }
  const missingFromToken =
    wantsOrg && !canPostToOrg && Boolean(conn?.grantedScopes) && !connectionHasOrgScopes(conn);
  const hasKnownOrg =
    configuredOrgIds.length > 0 ||
    parseManagedOrganizations(conn?.managedOrganizations).length > 0;
  const awaitingApiApproval =
    configuredOrgIds.length > 0 && !wantsOrg && !canPostToOrg;
  return {
    canPostToOrg,
    needsReconnect: wantsOrg && !canPostToOrg,
    needsServerConfig: configuredOrgIds.length === 0 && hasKnownOrg && !canPostToOrg,
    awaitingApiApproval,
    missingFromToken,
  };
}

export function getLinkedInAuthUrl(state: string, redirectUri?: string, forceConsent = false) {
  const { clientId } = getLinkedInClientCredentials();
  const uri = redirectUri || linkedInEnv.redirectUri;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: uri,
    scope: getLinkedInScopes().join(" "),
    state,
  });
  if (forceConsent) {
    // LinkedIn does not support OAuth prompt=consent reliably — revoke app access instead.
  }
  return `${LINKEDIN_AUTH_URL}?${params}`;
}

export async function exchangeLinkedInCode(code: string, redirectUri?: string) {
  const uri = redirectUri || linkedInEnv.redirectUri;
  const { clientId, clientSecret } = getLinkedInClientCredentials();

  if (!clientId || !clientSecret) {
    throw new Error(
      "LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET is missing on the server. Update Vercel env and redeploy."
    );
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: uri,
  });

  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body,
  });

  if (!res.ok) {
    const detail = await res.text();
    if (detail.includes("invalid_client")) {
      throw new Error(
        `Token exchange failed: invalid_client — LINKEDIN_CLIENT_SECRET does not match LINKEDIN_CLIENT_ID (${clientId}). In Vercel, edit both from Arfa CRM Community → Auth, then redeploy.`
      );
    }
    throw new Error(`Token exchange failed: ${detail}`);
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  }>;
}

function scopesFromTokenData(tokenData: { scope?: string }): string[] {
  if (tokenData.scope) {
    return tokenData.scope.split(/\s+/).filter(Boolean);
  }
  // LinkedIn often omits scope in token response — never assume posting scopes were granted.
  return ["openid", "profile", "email"];
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
  tokenData: {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  },
  profile?: { sub?: string; name?: string; email?: string; personUrn?: string }
) {
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000)
    : null;
  const personUrn = profile?.personUrn || (profile?.sub ? `urn:li:person:${profile.sub}` : null);
  const grantedScopes = JSON.stringify(scopesFromTokenData(tokenData));

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
      grantedScopes,
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
      grantedScopes,
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
  const { clientId, clientSecret } = getLinkedInClientCredentials();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
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
  imageUrl?: string,
  authorUrn?: string
) {
  let conn = await getLinkedInConnection(userId);
  if (!conn?.personUrn && !authorUrn) {
    const token = await getValidLinkedInAccessToken(userId);
    if (token) {
      const profile = await fetchLinkedInProfile(token);
      if (profile?.sub) {
        await saveLinkedInConnection(userId, { access_token: token }, profile);
        conn = await getLinkedInConnection(userId);
      }
    }
  }

  const author = authorUrn || conn?.personUrn;
  if (!author) throw new Error("Could not determine LinkedIn author URN. Re-authenticate.");

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
  const organizations = parseManagedOrganizations(conn?.managedOrganizations);
  const orgCaps = await resolveLinkedInOrgCapabilities(ownerId);
  const publishTargets = await getLinkedInPublishTargets(ownerId);
  const grantedScopeList = (() => {
    try {
      return conn?.grantedScopes ? (JSON.parse(conn.grantedScopes) as string[]) : [];
    } catch {
      return [];
    }
  })();

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
    organizations,
    orgPostingEnabled: orgCaps.canPostToOrg,
    needsOrgReconnect: orgCaps.needsReconnect,
    needsServerConfig: orgCaps.needsServerConfig,
    awaitingApiApproval: orgCaps.awaitingApiApproval,
    orgReconnectMessage: orgCaps.needsReconnect
      ? linkedInOrgReconnectMessage(orgCaps.missingFromToken)
      : orgCaps.needsServerConfig
        ? "LINKEDIN_ORGANIZATION_IDS is not loaded on the server. Add it in Vercel (Production), redeploy, then reconnect LinkedIn."
        : orgCaps.awaitingApiApproval
          ? "Waiting for LinkedIn Community Management API approval. Connect your profile now; set LINKEDIN_ORG_SCOPES_READY=true on Vercel after approval, then reconnect for company pages."
          : null,
    grantedScopes: grantedScopeList,
    requestedScopes: getLinkedInScopes(),
    serverRequestsOrgScopes: shouldRequestLinkedInOrgScopes(),
    configuredOrganizationIds: getLinkedInOrganizationIds(),
    publishTargetCount: publishTargets.length,
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
