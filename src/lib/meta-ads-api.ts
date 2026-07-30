import "server-only";

const GRAPH_API = "https://graph.facebook.com/v21.0";

export interface AdAccount {
  id: string;
  name: string;
  account_status: number;
  currency: string;
  amount_spent?: string;
}

export interface BoostEligibility {
  eligible: boolean;
  reason?: string;
  objectStoryId?: string;
  isInstagram?: boolean;
}

export interface BoostResult {
  campaignId: string;
  adSetId: string;
  creativeId: string;
  adId: string;
}

async function metaPost(
  path: string,
  accessToken: string,
  params: Record<string, string | number | boolean>
) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    body.set(key, String(value));
  }
  body.set("access_token", accessToken);

  const res = await fetch(`${GRAPH_API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || `Meta API error on ${path}`);
  }
  return data;
}

async function metaGet(path: string, accessToken: string, fields?: string) {
  const params = new URLSearchParams({ access_token: accessToken });
  if (fields) params.set("fields", fields);
  const res = await fetch(`${GRAPH_API}${path}?${params}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || `Meta API error on ${path}`);
  }
  return data;
}

export async function getPageAdAccounts(
  pageId: string,
  pageToken: string
): Promise<AdAccount[]> {
  try {
    const data = await metaGet(`/${pageId}/adaccounts`, pageToken, "id,name,account_status,currency,amount_spent");
    return data.data || [];
  } catch {
    return [];
  }
}

export async function getUserAdAccounts(userToken: string): Promise<AdAccount[]> {
  try {
    const data = await metaGet("/me/adaccounts", userToken, "id,name,account_status,currency,amount_spent");
    return data.data || [];
  } catch {
    return [];
  }
}

export async function getPromotablePostIds(
  pageId: string,
  pageToken: string
): Promise<Set<string>> {
  try {
    const params = new URLSearchParams({
      access_token: pageToken,
      include_inline: "true",
      limit: "50",
    });
    const res = await fetch(`${GRAPH_API}/${pageId}/promotable_posts?${params}`);
    const data = await res.json();
    if (!res.ok) return new Set();
    const ids = new Set<string>();
    for (const post of data.data || []) {
      if (post.id) ids.add(post.id);
    }
    return ids;
  } catch {
    return new Set();
  }
}

export async function checkPostBoostEligibility(
  metaPostId: string,
  pageId: string,
  pageToken: string,
  instagramId?: string | null
): Promise<BoostEligibility> {
  const isInstagram = metaPostId.startsWith(instagramId || "___") ||
    (!metaPostId.includes("_") && !!instagramId);

  if (isInstagram) {
    return {
      eligible: false,
      isInstagram: true,
      reason: "Instagram post boosting requires Meta Ads Manager. Use Facebook posts from this dashboard.",
    };
  }

  const objectStoryId = metaPostId.includes("_") ? metaPostId : `${pageId}_${metaPostId}`;

  try {
    const postData = await metaGet(
      `/${objectStoryId}`,
      pageToken,
      "id,is_published,is_eligible_for_promotion,status_type"
    );

    if (postData.is_published === false) {
      return { eligible: false, objectStoryId, reason: "Post is not published" };
    }

    if (postData.is_eligible_for_promotion === false) {
      return { eligible: false, objectStoryId, reason: "Post is not eligible for promotion" };
    }

    const promotable = await getPromotablePostIds(pageId, pageToken);
    if (promotable.size > 0 && !promotable.has(objectStoryId) && !promotable.has(metaPostId)) {
      return {
        eligible: false,
        objectStoryId,
        reason: "Post is not in the promotable posts list. It may be restricted or already boosted.",
      };
    }

    return { eligible: true, objectStoryId };
  } catch (err) {
    const promotable = await getPromotablePostIds(pageId, pageToken);
    if (promotable.has(objectStoryId) || promotable.has(metaPostId)) {
      return { eligible: true, objectStoryId };
    }
    return {
      eligible: false,
      objectStoryId,
      reason: err instanceof Error ? err.message : "Unable to verify boost eligibility",
    };
  }
}

export async function boostPost(params: {
  adAccountId: string;
  pageId: string;
  objectStoryId: string;
  accessToken: string;
  dailyBudgetCents: number;
  durationDays: number;
  countries?: string[];
  objective?: string;
}): Promise<BoostResult> {
  const {
    adAccountId,
    pageId,
    objectStoryId,
    accessToken,
    dailyBudgetCents,
    durationDays,
    countries = ["US"],
    objective = "OUTCOME_ENGAGEMENT",
  } = params;

  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const timestamp = Date.now();

  const campaign = await metaPost(`/${actId}/campaigns`, accessToken, {
    name: `CRM Boost ${timestamp}`,
    objective,
    status: "PAUSED",
    special_ad_categories: "[]",
  });

  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + durationDays * 24 * 60 * 60 * 1000);

  const adSet = await metaPost(`/${actId}/adsets`, accessToken, {
    name: `CRM Boost Set ${timestamp}`,
    campaign_id: campaign.id,
    daily_budget: dailyBudgetCents,
    billing_event: "IMPRESSIONS",
    optimization_goal: "POST_ENGAGEMENT",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting: JSON.stringify({ geo_locations: { countries } }),
    promoted_object: JSON.stringify({ page_id: pageId }),
    status: "PAUSED",
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
  });

  const creative = await metaPost(`/${actId}/adcreatives`, accessToken, {
    name: `CRM Boost Creative ${timestamp}`,
    object_story_id: objectStoryId,
  });

  const ad = await metaPost(`/${actId}/ads`, accessToken, {
    name: `CRM Boost Ad ${timestamp}`,
    adset_id: adSet.id,
    creative: JSON.stringify({ creative_id: creative.id }),
    status: "ACTIVE",
  });

  await metaPost(`/${campaign.id}`, accessToken, { status: "ACTIVE" });
  await metaPost(`/${adSet.id}`, accessToken, { status: "ACTIVE" });

  return {
    campaignId: campaign.id,
    adSetId: adSet.id,
    creativeId: creative.id,
    adId: ad.id,
  };
}

export async function getAdCampaigns(
  adAccountId: string,
  accessToken: string
) {
  const actId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  try {
    const data = await metaGet(
      `/${actId}/campaigns`,
      accessToken,
      "id,name,status,objective,created_time"
    );
    return data.data || [];
  } catch {
    return [];
  }
}

export async function pauseBoostAd(adId: string, accessToken: string) {
  return metaPost(`/${adId}`, accessToken, { status: "PAUSED" });
}

export async function resumeBoostAd(adId: string, accessToken: string) {
  return metaPost(`/${adId}`, accessToken, { status: "ACTIVE" });
}
