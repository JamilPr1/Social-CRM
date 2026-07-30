export function normalizeKeyword(keyword: string): string {
  return keyword.trim().toLowerCase().replace(/^#/, "");
}

export function keywordToHashtag(keyword: string): string {
  const clean = normalizeKeyword(keyword);
  if (!clean) return "";
  const tag = clean.replace(/[^a-z0-9]+/gi, "");
  return tag ? `#${tag}` : "";
}

function defaultHashtags(topic: string): string[] {
  const base = [
    "socialcrm",
    "marketingautomation",
    "digitalagency",
    "smallbusiness",
    "facebookmarketing",
    "instagrammarketing",
    "linkedinmarketing",
  ];
  const fromTopic = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .slice(0, 4);
  return [...new Set([...fromTopic, ...base])].slice(0, 10).map((t) => `#${t}`);
}

/** Rich marketing post when AI APIs are unavailable */
export function buildMarketingPost(options: {
  topic: string;
  keywords: string[];
  callToAction?: string;
  brandName?: string;
  contactEmail?: string;
}): { message: string; hashtags: string[] } {
  const { topic, keywords, callToAction, brandName, contactEmail } = options;
  const brand = brandName?.trim() || "Arfa Developers";
  const email = contactEmail?.trim() || "aarfa.developers@gmail.com";
  const headline = topic.trim();

  const keywordTags = keywords.map(keywordToHashtag).filter(Boolean);
  const hashtags =
    keywordTags.length > 0 ? keywordTags.slice(0, 10) : defaultHashtags(headline);

  const priceMatch = headline.match(/\$[\d,]+/);
  const price = priceMatch?.[0] || "$999";

  const cta =
    callToAction?.trim() ||
    `DM us or email ${email} for a live demo.`;

  const message = [
    headline,
    "",
    "Managing Facebook, Instagram, and LinkedIn shouldn't mean three tabs, three tools, and three headaches.",
    "",
    `${brand} Social CRM gives your team one dashboard to:`,
    "• Connect Meta & LinkedIn accounts",
    "• Publish to every platform from one compose screen",
    "• Track posts, comments, and messages in one place",
    "• Deploy ready for clients — no months of custom dev",
    "",
    `Ready-to-deploy package: ${price}`,
    "",
    "Built for agencies, real estate teams, and businesses that want to move fast.",
    "",
    cta,
    "",
    hashtags.join(" "),
  ].join("\n");

  return { message, hashtags };
}

export function buildSeoPost(options: {
  topic: string;
  keywords: string[];
  callToAction?: string;
  brandName?: string;
}): { message: string; hashtags: string[] } {
  return buildMarketingPost(options);
}

export function appendKeywordsToMessage(message: string, keywords: string[]): string {
  const { message: generated } = buildMarketingPost({
    topic: message,
    keywords,
  });
  return generated;
}
