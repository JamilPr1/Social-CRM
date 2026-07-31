import { getSessionUser } from "@/lib/auth";
import { getAccessibleAccounts } from "@/lib/accounts";
import { getLinkedInOrganizationIds, shouldRequestLinkedInOrgScopes } from "@/lib/linkedin-config";
import { getExtraMetaPageIds } from "@/lib/meta-api";
import { AccountsClient } from "./accounts-client";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  no_pages:
    "No Facebook Pages were found on your Meta account. Create pages in Meta Business Suite, then connect again.",
  oauth_failed: "Failed to connect Meta account. Please try again.",
  access_denied: "Meta login was cancelled or access was denied.",
  no_business_access:
    "Your Facebook account does not have access to Business Login for this app. Add your account as App Admin/Tester in Meta Developer Console, or use Basic Login below.",
  invalid_state: "Session expired. Please try connecting again.",
  unauthorized: "You must be logged in as admin to connect accounts.",
};

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; org_warning?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) return null;

  const params = await searchParams;
  const accounts = await getAccessibleAccounts(user);
  const linkedInOrgIds = getLinkedInOrganizationIds();
  const serverRequestsOrgScopes = shouldRequestLinkedInOrgScopes();

  let notice: { type: "success" | "error"; message: string } | null = null;
  if (params.connected === "true" || params.connected === "linkedin") {
    notice = {
      type: params.org_warning === "1" && serverRequestsOrgScopes ? "error" : "success",
      message:
        params.connected === "linkedin"
          ? params.org_warning === "1" && serverRequestsOrgScopes
            ? "LinkedIn connected for your profile, but company-page permission was not granted. Revoke the app at LinkedIn Permitted Services, then click Reconnect for company pages."
            : params.org_warning === "1"
              ? "LinkedIn connected, but LINKEDIN_ORGANIZATION_IDS is not loaded on the server. Redeploy Vercel after setting env vars."
              : "LinkedIn connected successfully!"
          : "Account connected successfully!",
    };
  } else if (params.error) {
    notice = {
      type: "error",
      message: ERROR_MESSAGES[params.error] || `Connection error: ${params.error}`,
    };
  }

  return (
    <AccountsClient
      accounts={accounts}
      isAdmin={user.role === "ADMIN"}
      notice={notice}
      errorCode={params.error}
      serverRuntimeConfig={{
        linkedInOrganizationIds: linkedInOrgIds,
        metaExtraPageIds: getExtraMetaPageIds(),
        serverRequestsOrgScopes,
      }}
    />
  );
}
