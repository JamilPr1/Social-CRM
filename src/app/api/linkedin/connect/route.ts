import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { getSessionUser } from "@/lib/auth";
import { getLinkedInAuthUrl, deleteLinkedInConnection } from "@/lib/linkedin-api";
import { isLinkedInConfigured, getLinkedInSetupIssue, getLinkedInScopes, shouldRequestLinkedInOrgScopes } from "@/lib/linkedin-config";
import { getRequestOrigin, getLinkedInOAuthRedirectUri } from "@/lib/app-url";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user.role !== "ADMIN") {
    return NextResponse.redirect(
      new URL("/accounts?error=unauthorized", request.url)
    );
  }

  if (!isLinkedInConfigured()) {
    const issue = getLinkedInSetupIssue() || "LinkedIn not configured";
    return NextResponse.redirect(
      new URL(`/accounts?error=${encodeURIComponent(issue)}`, request.url)
    );
  }

  const origin = getRequestOrigin(request);
  const redirectUri = getLinkedInOAuthRedirectUri(origin);
  const forceConsent = request.nextUrl.searchParams.get("consent") === "1";

  if (forceConsent) {
    await deleteLinkedInConnection(user.id);
  }

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("linkedin_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  cookieStore.set("linkedin_oauth_redirect", redirectUri, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  if (forceConsent) {
    cookieStore.set("linkedin_force_consent", "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
  }

  const requestedScopes = getLinkedInScopes();
  if (forceConsent && !shouldRequestLinkedInOrgScopes()) {
    return NextResponse.redirect(
      new URL(
        `/accounts?error=${encodeURIComponent("LINKEDIN_ORGANIZATION_IDS is not set on the server. Add it in Vercel env, redeploy, then reconnect.")}`,
        request.url
      )
    );
  }
  if (forceConsent && !requestedScopes.includes("w_organization_social")) {
    return NextResponse.redirect(
      new URL(
        `/accounts?error=${encodeURIComponent("Server is not requesting company-page scopes. Set LINKEDIN_ORGANIZATION_IDS=102438302 on Vercel and redeploy.")}`,
        request.url
      )
    );
  }

  return NextResponse.redirect(getLinkedInAuthUrl(state, redirectUri, forceConsent));
}
