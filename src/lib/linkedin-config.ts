import "server-only";

import { getLinkedInRedirectUri } from "./app-url";
import { isAnyAiConfigured, getAiConfigStatus } from "./ai-config";
import { existsSync } from "fs";
import { join } from "path";
const PLACEHOLDER_PATTERNS = [/^your_/i, /^sk-your/i, /^change_me/i, /^example/i, /^placeholder/i];

function isPlaceholder(value: string | undefined) {
  if (!value) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value.trim()));
}

export const linkedInEnv = {
  clientId: process.env.LINKEDIN_CLIENT_ID || "",
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET || "",
  redirectUri: getLinkedInRedirectUri(),
  apiVersion: process.env.LINKEDIN_API_VERSION || "202601",
  extraScopes: process.env.LINKEDIN_EXTRA_SCOPES || "",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  notionApiKey: process.env.NOTION_API_KEY || "",
  notionDatabaseId: process.env.NOTION_DATABASE_ID || "",
  googleCredentialsPath:
    process.env.GOOGLE_SHEETS_CREDENTIALS_PATH ||
    join(process.cwd(), "credentials", "google-service-account.json"),
  googleSpreadsheetId: process.env.GOOGLE_SHEETS_ID || "",
  googleRange: process.env.GOOGLE_SHEETS_RANGE || "Posts!A:D",
  userFullName: process.env.USER_FULL_NAME || "",
  userEmail: process.env.USER_EMAIL || "",
  userPhone: process.env.USER_PHONE || "",
  userLinkedInUrl: process.env.USER_LINKEDIN_URL || "",
  userResumePath: process.env.USER_RESUME_PATH || join(process.cwd(), "data", "resume.txt"),
};

/** Read at call time so Vercel runtime env vars are always picked up. */
function readEnv(name: string): string {
  const raw = process.env[name];
  if (!raw) return "";
  return raw.trim().replace(/^["']|["']$/g, "");
}

function isTruthyEnv(name: string): boolean {
  const value = readEnv(name).toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

export function getLinkedInClientId(): string {
  return readEnv("LINKEDIN_CLIENT_ID");
}

export function getLinkedInClientSecret(): string {
  return readEnv("LINKEDIN_CLIENT_SECRET");
}

export function getLinkedInClientCredentials() {
  return {
    clientId: getLinkedInClientId(),
    clientSecret: getLinkedInClientSecret(),
  };
}

export function getLinkedInCredentialsStatus() {
  const { clientId, clientSecret } = getLinkedInClientCredentials();
  const looksLikePlaceholder =
    isPlaceholder(clientSecret) ||
    clientSecret.includes("PASTE_") ||
    clientSecret.toLowerCase().includes("your_");
  return {
    clientId,
    clientIdSuffix: clientId.length >= 4 ? clientId.slice(-4) : clientId,
    secretConfigured: clientSecret.length > 8 && !looksLikePlaceholder,
    secretLength: clientSecret.length,
    looksLikePlaceholder,
    expectedNewAppClientId: "78x7byxctnebwz",
    clientIdMatchesNewApp: clientId === "78x7byxctnebwz",
    redirectUri:
      readEnv("LINKEDIN_REDIRECT_URI") ||
      "https://social-crm-five.vercel.app/api/social/linkedin/callback",
    organizationIds: getLinkedInOrganizationIds(),
    orgScopesReady: isLinkedInOrgScopesReady(),
    requestsOrgScopes: shouldRequestLinkedInOrgScopes(),
  };
}

export function getLinkedInOrganizationIds(): string[] {
  const raw =
    readEnv("LINKEDIN_ORGANIZATION_IDS") ||
    readEnv("LINKEDIN_ORGANIZATION_ID") ||
    readEnv("LINKEDIN_ORG_IDS");
  return raw
    .split(/[\s,]+/)
    .map((id) => id.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

/** Org page IDs for publishing config (does not imply OAuth org scopes are approved). */
export function hasLinkedInOrganizationConfigured() {
  return getLinkedInOrganizationIds().length > 0;
}

/**
 * Request w_organization_social in OAuth only when LinkedIn has approved Community Management API.
 * Set LINKEDIN_ORG_SCOPES_READY=true on Vercel after approval — until then profile-only connect works.
 */
export function shouldRequestLinkedInOrgScopes() {
  return isTruthyEnv("LINKEDIN_ORG_SCOPES_READY");
}

export function isLinkedInOrgScopesReady() {
  return shouldRequestLinkedInOrgScopes();
}

export function getLinkedInScopes() {
  // Arfa CRM Community is CMA-only until approved — w_member_social needs Share on LinkedIn or approved CMA.
  const base = ["openid", "profile", "email"];
  const postingScopes = isLinkedInOrgScopesReady()
    ? ["w_member_social", "w_organization_social", "r_organization_social"]
    : isTruthyEnv("LINKEDIN_INCLUDE_MEMBER_SCOPE")
      ? ["w_member_social"]
      : [];
  const extra = linkedInEnv.extraScopes
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...base, ...postingScopes, ...extra])];
}

export function isLinkedInConfigured() {
  const clientId = getLinkedInClientId();
  const clientSecret = getLinkedInClientSecret();
  return Boolean(
    clientId &&
      clientSecret &&
      !isPlaceholder(clientId) &&
      !isPlaceholder(clientSecret) &&
      !clientSecret.includes("PASTE_")
  );
}

export function getLinkedInSetupIssue() {
  const clientId = getLinkedInClientId();
  const clientSecret = getLinkedInClientSecret();
  if (!clientId || isPlaceholder(clientId)) {
    return "LINKEDIN_CLIENT_ID is missing in .env";
  }
  if (!clientSecret || isPlaceholder(clientSecret) || clientSecret.includes("PASTE_")) {
    return "LINKEDIN_CLIENT_SECRET is missing or invalid on the server";
  }
  return null;
}

export function isOpenAIConfigured() {
  return isAnyAiConfigured();
}

export function isNotionConfigured() {  return Boolean(
    linkedInEnv.notionApiKey &&
      linkedInEnv.notionDatabaseId &&
      !isPlaceholder(linkedInEnv.notionApiKey) &&
      !isPlaceholder(linkedInEnv.notionDatabaseId)
  );
}

export function isGoogleSheetsConfigured() {
  return Boolean(
    linkedInEnv.googleSpreadsheetId &&
      !isPlaceholder(linkedInEnv.googleSpreadsheetId) &&
      existsSync(linkedInEnv.googleCredentialsPath)
  );
}

export function getGoogleSheetsSetupIssue() {
  if (!linkedInEnv.googleSpreadsheetId || isPlaceholder(linkedInEnv.googleSpreadsheetId)) {
    return "GOOGLE_SHEETS_ID is not set in .env";
  }
  if (!existsSync(linkedInEnv.googleCredentialsPath)) {
    return `Google credentials not found at ${linkedInEnv.googleCredentialsPath}`;
  }
  return null;
}

export function getLinkedInConfigStatus() {
  const requestedScopes = getLinkedInScopes();
  const organizationIds = getLinkedInOrganizationIds();
  return {
    linkedin: {
      configured: isLinkedInConfigured(),
      issue: getLinkedInSetupIssue(),
      redirectUri: linkedInEnv.redirectUri,
      organizationIds,
      orgScopesReady: isLinkedInOrgScopesReady(),
      enableOrgScopesEnv: readEnv("LINKEDIN_ORG_SCOPES_READY"),
      requestsOrgScopes: shouldRequestLinkedInOrgScopes(),
      requestedScopes,
    },
    openai: { configured: isAnyAiConfigured() },
    ai: getAiConfigStatus(),    notion: { configured: isNotionConfigured() },
    sheets: {
      configured: isGoogleSheetsConfigured(),
      issue: getGoogleSheetsSetupIssue(),
    },
    user: {
      fullName: linkedInEnv.userFullName,
      email: linkedInEnv.userEmail,
      resumeExists: existsSync(linkedInEnv.userResumePath),
    },
  };
}
