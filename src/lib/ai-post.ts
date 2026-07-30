import "server-only";

import { buildSeoPost, normalizeKeyword } from "./seo-post";
import { isKimiConfigured } from "./ai-config";
import { kimiChat } from "./kimi";

export async function generatePostCopy(options: {
  topic: string;
  keywords: string[];
  callToAction?: string;
  brandName?: string;
  platform?: string;
}): Promise<{
  message: string;
  hashtags: string[];
  provider: "kimi" | "template";
}> {
  const { topic, keywords, callToAction, brandName, platform } = options;
  const uniqueKeywords = [...new Set(keywords.map(normalizeKeyword).filter(Boolean))];

  if (!isKimiConfigured()) {
    const fallback = buildSeoPost({ topic, keywords: uniqueKeywords, callToAction, brandName });
    return { ...fallback, provider: "template" };
  }

  const platformHint = platform
    ? `Optimize for ${platform}.`
    : "Optimize for Facebook, Instagram, and LinkedIn.";

  const system = `You are an expert social media copywriter for a business CRM.
Write engaging, professional posts. Use short paragraphs, emojis sparingly, and end with 3-8 relevant hashtags on the last line.
${platformHint}
Return ONLY the post text — no titles, quotes, or markdown fences.`;

  const userParts = [`Topic: ${topic.trim()}`];
  if (uniqueKeywords.length > 0) {
    userParts.push(`Keywords to weave in naturally: ${uniqueKeywords.join(", ")}`);
  }
  if (brandName?.trim()) userParts.push(`Brand: ${brandName.trim()}`);
  if (callToAction?.trim()) userParts.push(`Call to action: ${callToAction.trim()}`);

  const message = await kimiChat(
    [
      { role: "system", content: system },
      { role: "user", content: userParts.join("\n") },
    ],
    { temperature: 0.75, maxTokens: 800 }
  );

  const hashtagMatches = message.match(/#[\w]+/g) || [];
  const hashtags = [...new Set(hashtagMatches.map((h) => h.toLowerCase()))];

  return { message: message.trim(), hashtags, provider: "kimi" };
}

export async function generateImagePrompt(options: {
  topic: string;
  keywords?: string[];
}): Promise<string> {
  const { topic, keywords = [] } = options;

  if (!isKimiConfigured()) {
    const kw = keywords.slice(0, 3).join(", ");
    return `Professional social media marketing image about ${topic}${kw ? `, ${kw}` : ""}, clean modern design, high quality, no text overlay`;
  }

  return kimiChat(
    [
      {
        role: "system",
        content:
          "You write short image generation prompts for social media marketing visuals. Output one English prompt only, under 40 words, photorealistic or clean illustration style, no text in image.",
      },
      {
        role: "user",
        content: `Topic: ${topic}\nKeywords: ${keywords.join(", ") || "none"}`,
      },
    ],
    { temperature: 0.8, maxTokens: 120 }
  );
}
