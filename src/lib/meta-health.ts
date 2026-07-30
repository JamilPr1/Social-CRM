import "server-only";

const GRAPH_API = "https://graph.facebook.com/v21.0";

export interface AccountHealth {
  canPostFacebook: boolean;
  canPostInstagram: boolean;
  hasInstagramLinked: boolean;
  issues: string[];
  scopes: string[];
}

export async function checkPageTokenHealth(
  pageToken: string,
  hasInstagramId: boolean
): Promise<AccountHealth> {
  const appToken = `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`;
  const res = await fetch(
    `${GRAPH_API}/debug_token?input_token=${encodeURIComponent(pageToken)}&access_token=${encodeURIComponent(appToken)}`
  );
  const data = await res.json();
  const scopes: string[] = data.data?.scopes || [];
  const granular = data.data?.granular_scopes || [];

  const hasManagePosts =
    scopes.includes("pages_manage_posts") ||
    granular.some((g: { scope: string }) => g.scope === "pages_manage_posts");

  const hasIgPublish =
    scopes.includes("instagram_content_publish") ||
    scopes.includes("instagram_basic") ||
    granular.some((g: { scope: string }) =>
      ["instagram_content_publish", "instagram_basic"].includes(g.scope)
    );

  const issues: string[] = [];
  if (!hasManagePosts) {
    issues.push(
      "Missing pages_manage_posts — add “Manage your Pages” use case in Meta Developer Console, then reconnect the account."
    );
  }
  if (!hasInstagramId) {
    issues.push(
      "Instagram not linked — connect @arfadevelopers to your Facebook Page in Meta Business Suite, then reconnect."
    );
  } else if (!hasIgPublish) {
    issues.push(
      "Missing Instagram publish permission — add Instagram use case in Meta Developer Console, then reconnect."
    );
  }

  return {
    canPostFacebook: hasManagePosts,
    canPostInstagram: hasInstagramId && hasIgPublish,
    hasInstagramLinked: hasInstagramId,
    issues,
    scopes,
  };
}
