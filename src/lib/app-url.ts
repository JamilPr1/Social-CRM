import "server-only";

function stripTrailingSlash(url: string) {
  return url.replace(/\/$/, "");
}

/** Canonical app URL — prefers explicit production URL, then Vercel host. */
export function getAppBaseUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const vercelUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : null;

  if (appUrl && !appUrl.includes("localhost")) {
    return stripTrailingSlash(appUrl);
  }

  if (process.env.VERCEL === "1" && vercelUrl) {
    return stripTrailingSlash(vercelUrl);
  }

  return stripTrailingSlash(appUrl || vercelUrl || "http://localhost:3000");
}

function resolveRedirectUri(explicit: string | undefined, callbackPath: string) {
  if (explicit && !explicit.includes("localhost")) {
    return explicit;
  }
  return `${getAppBaseUrl()}${callbackPath}`;
}

export function getMetaRedirectUri() {
  return resolveRedirectUri(process.env.META_REDIRECT_URI, "/api/meta/callback");
}

export function getLinkedInRedirectUri() {
  return resolveRedirectUri(process.env.LINKEDIN_REDIRECT_URI, "/api/linkedin/callback");
}
