import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { getSessionUser } from "@/lib/auth";
import { getLinkedInAuthUrl, exchangeLinkedInCode, fetchLinkedInProfile, saveLinkedInConnection } from "@/lib/linkedin-api";
import { isLinkedInConfigured, getLinkedInSetupIssue } from "@/lib/linkedin-config";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!isLinkedInConfigured()) {
    const issue = getLinkedInSetupIssue() || "LinkedIn not configured";
    return NextResponse.redirect(
      new URL(`/accounts?error=${encodeURIComponent(issue)}`, request.url)
    );
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

  return NextResponse.redirect(getLinkedInAuthUrl(state));
}
