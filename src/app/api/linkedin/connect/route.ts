import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { getSessionUser } from "@/lib/auth";
import { getLinkedInAuthUrl } from "@/lib/linkedin-api";
import { isLinkedInConfigured, getLinkedInSetupIssue } from "@/lib/linkedin-config";
import { getRequestOrigin, getLinkedInRedirectUri } from "@/lib/app-url";

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
  const redirectUri = getLinkedInRedirectUri(origin);
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

  return NextResponse.redirect(getLinkedInAuthUrl(state, redirectUri));
}
