const GRAPH_API = "https://graph.facebook.com/v21.0";

export interface MetaPage {
  id: string;
  name: string;
  username?: string;
  access_token: string;
  picture?: { data: { url: string } };
  instagram_business_account?: { id: string };
}

export interface MetaPost {
  id: string;
  message?: string;
  full_picture?: string;
  permalink_url?: string;
  created_time: string;
  attachments?: {
    data: Array<{
      media_type?: string;
      media?: { image?: { src: string } };
    }>;
  };
}

export interface MetaComment {
  id: string;
  message: string;
  created_time: string;
  from?: { id: string; name: string };
  comments?: { data: MetaComment[] };
}

export function getMetaOAuthUrl(
  state: string,
  options?: { reauth?: boolean; standard?: boolean }
): string {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: process.env.META_REDIRECT_URI!,
    state,
    response_type: "code",
  });

  if (options?.reauth) {
    params.set("auth_type", "rerequest");
  }

  const configId = process.env.META_LOGIN_CONFIG_ID;
  const useStandard = options?.standard || process.env.META_LOGIN_MODE === "standard";

  if (!useStandard && configId) {
    params.set("config_id", configId);
  } else {
    // Minimal scopes only — must match permissions enabled on your Meta app.
    // pages_manage_posts / instagram_* require Business Login config_id, not scope param.
    params.set(
      "scope",
      [
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_metadata",
        "pages_messaging",
        "business_management",
        "ads_management",
        "ads_read",
      ].join(",")
    );
  }

  return `https://www.facebook.com/v21.0/dialog/oauth?${params}`;
}

interface TokenDebugInfo {
  is_valid?: boolean;
  scopes?: string[];
  granular_scopes?: Array<{ scope: string; target_ids?: string[] }>;
  error?: { message: string };
}

async function debugAccessToken(userToken: string): Promise<TokenDebugInfo> {
  const appToken = `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`;
  const res = await fetch(
    `${GRAPH_API}/debug_token?input_token=${encodeURIComponent(userToken)}&access_token=${encodeURIComponent(appToken)}`
  );
  const data = await res.json();
  return data.data || { error: data.error };
}

async function fetchGraphPages(
  url: string,
  userToken: string
): Promise<{ pages: MetaPage[]; error?: string }> {
  const pages: MetaPage[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const fetchUrl = nextUrl.includes("access_token=")
      ? nextUrl
      : `${nextUrl}&access_token=${userToken}`;
    const res: Response = await fetch(fetchUrl);
    const data = await res.json();
    if (!res.ok) {
      return {
        pages,
        error: data.error?.message || `Graph API error (${res.status})`,
      };
    }
    if (data.data?.length) pages.push(...data.data);
    nextUrl = data.paging?.next || null;
  }

  return { pages };
}

async function fetchPagesByIds(
  pageIds: string[],
  userToken: string,
  fields: string
): Promise<MetaPage[]> {
  const pages: MetaPage[] = [];
  await Promise.all(
    pageIds.map(async (pageId) => {
      const res = await fetch(
        `${GRAPH_API}/${pageId}?fields=${fields}&access_token=${userToken}`
      );
      const data = await res.json();
      if (!res.ok || !data.id) return;

      if (data.access_token) {
        pages.push(data as MetaPage);
        return;
      }

      const tokenRes = await fetch(
        `${GRAPH_API}/${pageId}?fields=access_token&access_token=${userToken}`
      );
      const tokenData = await tokenRes.json();
      if (tokenRes.ok && tokenData.access_token) {
        pages.push({ ...data, access_token: tokenData.access_token } as MetaPage);
      }
    })
  );
  return pages;
}

export interface PageAccessDiagnosis {
  tokenValid: boolean;
  scopes: string[];
  granularScopes: Array<{ scope: string; target_ids?: string[] }>;
  pagesFound: number;
  pageNames: string[];
  errors: string[];
  meAccountsCount: number;
  assignedPagesCount: number;
  businessCount: number;
  granularPageIds: string[];
  hint: string | null;
}

export async function diagnosePageAccess(userToken: string): Promise<PageAccessDiagnosis> {
  const debug = await debugAccessToken(userToken);
  const errors: string[] = [];
  const fields = "id,name,username,access_token,picture,instagram_business_account";

  const meAccounts = await fetchGraphPages(
    `${GRAPH_API}/me/accounts?fields=${fields}&limit=100`,
    userToken
  );
  if (meAccounts.error) errors.push(`me/accounts: ${meAccounts.error}`);

  const assigned = await fetchGraphPages(
    `${GRAPH_API}/me/assigned_pages?fields=${fields}&limit=100`,
    userToken
  );
  if (assigned.error) errors.push(`me/assigned_pages: ${assigned.error}`);

  const bizRes = await fetch(
    `${GRAPH_API}/me/businesses?fields=id,name&limit=50&access_token=${userToken}`
  );
  const bizData = await bizRes.json();
  if (!bizRes.ok) {
    errors.push(`me/businesses: ${bizData.error?.message || "failed"}`);
  }

  const granularPageIds = new Set<string>();
  for (const gs of debug.granular_scopes || []) {
    if (gs.scope.startsWith("pages_") && gs.target_ids?.length) {
      for (const id of gs.target_ids) granularPageIds.add(id);
    }
  }

  const pages = await getUserPages(userToken);

  return {
    tokenValid: debug.is_valid === true,
    scopes: debug.scopes || [],
    granularScopes: debug.granular_scopes || [],
    pagesFound: pages.length,
    pageNames: pages.map((p) => p.name),
    errors,
    meAccountsCount: meAccounts.pages.length,
    assignedPagesCount: assigned.pages.length,
    businessCount: bizData.data?.length || 0,
    granularPageIds: [...granularPageIds],
    hint:
      pages.length > 0
        ? null
        : granularPageIds.size > 0
          ? "Meta granted page permissions but page tokens could not be loaded. Try Standard Login or reconnect with Edit settings."
          : "No Facebook Pages exist on this account yet. Create Pages in Meta Business Suite first, then connect again.",
  };
}

export async function createFacebookPage(
  userToken: string,
  options: { name: string; about: string; category?: string }
): Promise<{ id?: string; error?: string }> {
  const params = new URLSearchParams({
    name: options.name,
    about: options.about,
    access_token: userToken,
  });
  if (options.category) params.set("category_enum", options.category);

  const res = await fetch(`${GRAPH_API}/me/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    return { error: data.error?.message || "Failed to create page" };
  }
  return { id: data.id };
}

export async function getUserPages(userToken: string): Promise<MetaPage[]> {
  const fields = "id,name,username,access_token,picture,instagram_business_account";
  const pages: MetaPage[] = [];
  const seen = new Set<string>();
  const errors: string[] = [];

  function addPages(items: MetaPage[]) {
    for (const page of items) {
      if (page.id && page.access_token && !seen.has(page.id)) {
        seen.add(page.id);
        pages.push(page);
      }
    }
  }

  const endpoints = [
    `${GRAPH_API}/me/accounts?fields=${fields}&limit=100`,
    `${GRAPH_API}/me/assigned_pages?fields=${fields}&limit=100`,
  ];

  for (const endpoint of endpoints) {
    const result = await fetchGraphPages(endpoint, userToken);
    addPages(result.pages);
    if (result.error) errors.push(result.error);
  }

  const bizRes = await fetch(
    `${GRAPH_API}/me/businesses?fields=id,name&limit=50&access_token=${userToken}`
  );
  const bizData = await bizRes.json();
  if (bizRes.ok && bizData.data?.length) {
    for (const biz of bizData.data) {
      for (const edge of ["owned_pages", "client_pages"] as const) {
        const result = await fetchGraphPages(
          `${GRAPH_API}/${biz.id}/${edge}?fields=${fields}&limit=100`,
          userToken
        );
        addPages(result.pages);
        if (result.error) errors.push(result.error);
      }
    }
  } else if (!bizRes.ok) {
    errors.push(bizData.error?.message || "Could not load businesses");
  }

  if (pages.length === 0) {
    const debug = await debugAccessToken(userToken);
    const pageIds = new Set<string>();
    for (const gs of debug.granular_scopes || []) {
      if (gs.scope.startsWith("pages_") && gs.target_ids?.length) {
        for (const id of gs.target_ids) pageIds.add(id);
      }
    }

    if (pageIds.size > 0) {
      const granularPages = await fetchPagesByIds([...pageIds], userToken, fields);
      addPages(granularPages);
    }

    if (pages.length === 0) {
      console.error("No pages found.", {
        scopes: debug.scopes,
        granular_scopes: debug.granular_scopes,
        errors,
      });
    }
  }

  return pages;
}

export async function exchangeCodeForToken(code: string) {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    redirect_uri: process.env.META_REDIRECT_URI!,
    code,
  });
  const res = await fetch(`${GRAPH_API}/oauth/access_token?${params}`);
  if (!res.ok) throw new Error("Failed to exchange OAuth code");
  return res.json() as Promise<{ access_token: string; token_type: string }>;
}

export async function getLongLivedToken(shortToken: string) {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: shortToken,
  });
  const res = await fetch(`${GRAPH_API}/oauth/access_token?${params}`);
  if (!res.ok) throw new Error("Failed to get long-lived token");
  return res.json() as Promise<{ access_token: string; expires_in?: number }>;
}

export async function getInstagramAccount(
  pageId: string,
  pageToken: string
): Promise<{ id: string; username: string } | null> {
  const res = await fetch(
    `${GRAPH_API}/${pageId}?fields=instagram_business_account{id,username}&access_token=${pageToken}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.instagram_business_account || null;
}

export async function getPagePosts(
  pageId: string,
  pageToken: string,
  limit = 25
): Promise<MetaPost[]> {
  const fields = "id,message,full_picture,permalink_url,created_time,attachments";
  const res = await fetch(
    `${GRAPH_API}/${pageId}/posts?fields=${fields}&limit=${limit}&access_token=${pageToken}`
  );
  if (!res.ok) throw new Error("Failed to fetch posts");
  const data = await res.json();
  return data.data || [];
}

export async function getInstagramMedia(
  instagramId: string,
  pageToken: string,
  limit = 25
): Promise<MetaPost[]> {
  const fields = "id,caption,media_url,permalink,timestamp,media_type";
  const res = await fetch(
    `${GRAPH_API}/${instagramId}/media?fields=${fields}&limit=${limit}&access_token=${pageToken}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data || []).map((item: Record<string, string>) => ({
    id: item.id,
    message: item.caption,
    full_picture: item.media_url,
    permalink_url: item.permalink,
    created_time: item.timestamp,
    attachments: item.media_type ? { data: [{ media_type: item.media_type }] } : undefined,
  }));
}

export async function getPostComments(
  postId: string,
  pageToken: string
): Promise<MetaComment[]> {
  const fields = "id,message,created_time,from,comments{id,message,created_time,from}";
  const res = await fetch(
    `${GRAPH_API}/${postId}/comments?fields=${fields}&access_token=${pageToken}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

export async function createPagePost(
  pageId: string,
  pageToken: string,
  message: string
) {
  const res = await fetch(`${GRAPH_API}/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, access_token: pageToken }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to create post");
  }
  return res.json();
}

export async function createInstagramPost(
  instagramId: string,
  pageToken: string,
  imageUrl: string,
  caption: string
) {
  const containerRes = await fetch(`${GRAPH_API}/${instagramId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: imageUrl,
      caption,
      access_token: pageToken,
    }),
  });
  if (!containerRes.ok) {
    const err = await containerRes.json();
    throw new Error(err.error?.message || "Failed to create Instagram media container");
  }
  const { id: containerId } = await containerRes.json();

  const publishRes = await fetch(`${GRAPH_API}/${instagramId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: pageToken,
    }),
  });
  if (!publishRes.ok) {
    const err = await publishRes.json();
    throw new Error(err.error?.message || "Failed to publish Instagram post");
  }
  return publishRes.json();
}

export async function replyToComment(
  commentId: string,
  pageToken: string,
  message: string
) {
  const res = await fetch(`${GRAPH_API}/${commentId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, access_token: pageToken }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to reply to comment");
  }
  return res.json();
}

export async function getPageConversations(pageId: string, pageToken: string) {
  const res = await fetch(
    `${GRAPH_API}/${pageId}/conversations?fields=participants,messages{message,from,created_time}&access_token=${pageToken}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

export async function sendPageMessage(
  pageId: string,
  pageToken: string,
  recipientId: string,
  message: string
) {
  const res = await fetch(`${GRAPH_API}/${pageId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: message },
      access_token: pageToken,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to send message");
  }
  return res.json();
}
