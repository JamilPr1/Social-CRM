export const SUGGESTED_PAGES = [
  {
    name: "Arfa AI Solutions",
    about: "AI and machine learning services for modern businesses.",
    category: "Science & Technology",
  },
  {
    name: "Arfa Automation Hub",
    about: "Business process automation, workflows, and CRM integrations.",
    category: "Business Service",
  },
  {
    name: "Arfa ML Services",
    about: "Custom ML models, data pipelines, and intelligent analytics.",
    category: "Science & Technology",
  },
  {
    name: "Arfa Tech Services",
    about: "Software development, cloud services, and digital transformation.",
    category: "Information Technology Company",
  },
] as const;

export const META_SETUP_LINKS = {
  createPage: "https://www.facebook.com/pages/create",
  businessSuite: "https://business.facebook.com/",
  createBusiness: "https://business.facebook.com/overview",
  linkInstagram: "https://business.facebook.com/latest/settings/instagram_account",
  developerConfig: "https://developers.facebook.com/apps/",
  appRoles: (appId: string) => `https://developers.facebook.com/apps/${appId}/roles/roles/`,
  loginConfig: (appId: string, configId: string) =>
    `https://developers.facebook.com/apps/${appId}/fb-login/settings/?business_config_id=${configId}`,
} as const;
