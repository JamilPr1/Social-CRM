import "server-only";

import { buildSeoPost, normalizeKeyword } from "./seo-post";
import { isAnyAiConfigured } from "./ai-config";
import { aiChat } from "./ai-chat";

export type PostAiProvider = "gemini" | "groq" | "kimi" | "template";

export async function generatePostCopy(options: {
  topic: string;
  keywords: string[];
  callToAction?: string;
  brandName?: string;
  platform?: string;
}): Promise<{
  message: string;
  hashtags: string[];
  provider: PostAiProvider;
}> {
  const { topic, keywords, callToAction, brandName, platform } = options;
  const uniqueKeywords = [...new Set(keywords.map(normalizeKeyword).filter(Boolean))];

  if (!isAnyAiConfigured()) {
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

  try {
    const { content, provider } = await aiChat(
      [
        { role: "system", content: system },
        { role: "user", content: userParts.join("\n") },
      ],
      { temperature: 0.75, maxTokens: 800 }
    );

    const hashtagMatches = content.match(/#[\w]+/g) || [];
    const hashtags = [...new Set(hashtagMatches.map((h) => h.toLowerCase()))];
    return { message: content.trim(), hashtags, provider };
  } catch {
    const fallback = buildSeoPost({ topic, keywords: uniqueKeywords, callToAction, brandName });
    return { ...fallback, provider: "template" };
  }
}

export async function generateImagePrompt(options: {
  topic: string;
  keywords?: string[];
}): Promise<string> {
  const { topic, keywords = [] } = options;
  const fallback = `Professional social media marketing image about ${topic}${keywords.length ? `, ${keywords.slice(0, 3).join(", ")}` : ""}, clean modern design, high quality, no text overlay`;

  if (!isAnyAiConfigured()) return fallback;

  try {
    const { content } = await aiChat(
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
    return content;
  } catch {
    return fallback;
  }
}
