import "server-only";

/** Primary admin / system sender email — used for all outbound mail. */
export function getAdminEmail(): string {
  return (
    process.env.ADMIN_EMAIL?.trim() ||
    process.env.LEGAL_CONTACT_EMAIL?.trim() ||
    "aarfa.developers@gmail.com"
  );
}

export function getAppName(): string {
  return process.env.LEGAL_APP_NAME?.trim() || "Social CRM";
}
