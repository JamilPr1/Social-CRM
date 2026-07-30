import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth";
import { exchangeLinkedInCode, fetchLinkedInProfile, saveLinkedInConnection, syncLinkedInOrganizations, getLinkedInConnection } from "@/lib/linkedin-api";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/accounts?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("linkedin_oauth_state")?.value;
  const redirectUri = cookieStore.get("linkedin_oauth_redirect")?.value;
  cookieStore.delete("linkedin_oauth_state");
  cookieStore.delete("linkedin_oauth_redirect");

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(new URL("/accounts?error=invalid_state", request.url));
  }

  try {
    const tokenData = await exchangeLinkedInCode(code, redirectUri);
    const profile = await fetchLinkedInProfile(tokenData.access_token);
    await saveLinkedInConnection(user.id, tokenData, profile || undefined);
    try {
      await syncLinkedInOrganizations(user.id);
    } catch {
      /* org scope may not be approved yet */
    }
    const conn = await getLinkedInConnection(user.id);
    const hasOrgScope = conn?.grantedScopes?.includes("w_organization_social");
    const redirect = hasOrgScope
      ? "/accounts?connected=linkedin"
      : "/accounts?connected=linkedin&org_warning=1";
    return NextResponse.redirect(new URL(redirect, request.url));
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth failed";
    return NextResponse.redirect(
      new URL(`/accounts?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
