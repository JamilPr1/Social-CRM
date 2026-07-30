export function normalizeKeyword(keyword: string): string {
  return keyword.trim().toLowerCase().replace(/^#/, "");
}

export function keywordToHashtag(keyword: string): string {
  const clean = normalizeKeyword(keyword);
  if (!clean) return "";
  const tag = clean.replace(/[^a-z0-9]+/gi, "");
  return tag ? `#${tag}` : "";
}

export function buildSeoPost(options: {
  topic: string;
  keywords: string[];
  callToAction?: string;
  brandName?: string;
}): { message: string; hashtags: string[] } {
  const { topic, keywords, callToAction, brandName } = options;
  const uniqueKeywords = [...new Set(keywords.map(normalizeKeyword).filter(Boolean))];
  const hashtags = uniqueKeywords.map(keywordToHashtag).filter(Boolean).slice(0, 12);

  const intro = topic.trim();
  const cta =
    callToAction?.trim() ||
    (brandName
      ? `Follow ${brandName} for more updates.`
      : "Like, share, and follow for more updates.");

  const keywordLine =
    uniqueKeywords.length > 0
      ? `Keywords: ${uniqueKeywords.slice(0, 6).join(" • ")}`
      : "";

  const parts = [intro, "", cta];
  if (keywordLine) parts.push("", keywordLine);
  if (hashtags.length > 0) parts.push("", hashtags.join(" "));

  return {
    message: parts.join("\n").trim(),
    hashtags,
  };
}

export function appendKeywordsToMessage(message: string, keywords: string[]): string {
  const { message: generated } = buildSeoPost({
    topic: message,
    keywords,
  });
  return generated;
}
