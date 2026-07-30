import "server-only";

export function getLegalConfig() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return {
    appName: process.env.LEGAL_APP_NAME || "Arfa CRM",
    companyName: process.env.LEGAL_COMPANY_NAME || "Arfa Developers",
    contactName: process.env.USER_FULL_NAME || "Muhammad Arshad",
    contactEmail: process.env.LEGAL_CONTACT_EMAIL || process.env.USER_EMAIL || "aarfa.developers@gmail.com",
    contactPhone: process.env.USER_PHONE || "",
    appUrl,
    privacyUrl: `${appUrl}/privacy`,
    termsUrl: `${appUrl}/terms`,
    dataDeletionUrl: `${appUrl}/data-deletion`,
    effectiveDate: "July 30, 2026",
    metaAppId: process.env.META_APP_ID || "",
  };
}
