import "server-only";

import type { NextRequest } from "next/server";

function stripTrailingSlash(url: string) {
  return url.replace(/\/$/, "");
}

/** Origin from the incoming request (e.g. https://social-crm-five.vercel.app). */
export function getRequestOrigin(request: NextRequest) {
  return stripTrailingSlash(request.nextUrl.origin);
}

/**
 * Canonical app URL for OAuth and legal pages.
 * Never uses VERCEL_URL — that is a per-deployment preview host and breaks OAuth.
 */
export function getAppBaseUrl(requestOrigin?: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (appUrl && !appUrl.includes("localhost")) {
    return stripTrailingSlash(appUrl);
  }

  if (requestOrigin && !requestOrigin.includes("localhost")) {
    return stripTrailingSlash(requestOrigin);
  }

  return stripTrailingSlash(appUrl || "http://localhost:3000");
}

function resolveRedirectUri(
  explicit: string | undefined,
  callbackPath: string,
  requestOrigin?: string
) {
  if (explicit && !explicit.includes("localhost")) {
    return explicit;
  }
  return `${getAppBaseUrl(requestOrigin)}${callbackPath}`;
}

export function getMetaRedirectUri(requestOrigin?: string) {
  return resolveRedirectUri(
    process.env.META_REDIRECT_URI,
    "/api/meta/callback",
    requestOrigin
  );
}

export function getLinkedInRedirectUri(requestOrigin?: string) {
  return resolveRedirectUri(
    process.env.LINKEDIN_REDIRECT_URI,
    "/api/linkedin/callback",
    requestOrigin
  );
}
