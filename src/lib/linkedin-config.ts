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

export function getLinkedInScopes() {
  const base = [
    "openid",
    "profile",
    "email",
    "w_member_social",
    "w_organization_social",
    "r_organization_social",
  ];
  const extra = linkedInEnv.extraScopes
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...base, ...extra])];
}

export function isLinkedInConfigured() {
  return Boolean(
    linkedInEnv.clientId &&
      linkedInEnv.clientSecret &&
      !isPlaceholder(linkedInEnv.clientId) &&
      !isPlaceholder(linkedInEnv.clientSecret)
  );
}

export function getLinkedInSetupIssue() {
  if (!linkedInEnv.clientId || isPlaceholder(linkedInEnv.clientId)) {
    return "LINKEDIN_CLIENT_ID is missing in .env";
  }
  if (!linkedInEnv.clientSecret || isPlaceholder(linkedInEnv.clientSecret)) {
    return "LINKEDIN_CLIENT_SECRET is missing in .env";
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
  return {
    linkedin: {
      configured: isLinkedInConfigured(),
      issue: getLinkedInSetupIssue(),
      redirectUri: linkedInEnv.redirectUri,
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
