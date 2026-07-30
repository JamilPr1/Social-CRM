import "server-only";

import { buildMarketingPost, normalizeKeyword } from "./seo-post";
import { isAnyAiConfigured } from "./ai-config";
import { aiChat } from "./ai-chat";

export type PostAiProvider = "gemini" | "groq" | "kimi" | "template";

function templateFallback(options: {
  topic: string;
  keywords: string[];
  callToAction?: string;
  brandName?: string;
  warning?: string;
}) {
  const uniqueKeywords = [...new Set(options.keywords.map(normalizeKeyword).filter(Boolean))];
  const fallback = buildMarketingPost({
    topic: options.topic,
    keywords: uniqueKeywords,
    callToAction: options.callToAction,
    brandName: options.brandName || process.env.LEGAL_COMPANY_NAME,
    contactEmail: process.env.LEGAL_CONTACT_EMAIL || process.env.USER_EMAIL,
  });
  return {
    ...fallback,
    provider: "template" as const,
    warning: options.warning,
  };
}

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
  warning?: string;
}> {
  const { topic, keywords, callToAction, brandName, platform } = options;
  const uniqueKeywords = [...new Set(keywords.map(normalizeKeyword).filter(Boolean))];

  if (!isAnyAiConfigured()) {
    return templateFallback({
      topic,
      keywords: uniqueKeywords,
      callToAction,
      brandName,
      warning: "AI writing is not configured. Edit this draft or try again later.",
    });
  }

  const platformHint = platform
    ? `Optimize for ${platform}.`
    : "Optimize for Facebook, Instagram, and LinkedIn.";

  const system = `You are an expert social media copywriter.
Write a complete, ready-to-publish post (120-220 words) with:
- A strong opening hook (do NOT just repeat the headline verbatim)
- 2-3 short paragraphs explaining the value
- 3-5 bullet points with benefits
- A clear call to action
- 5-8 relevant hashtags on the last line
${platformHint}
Use emojis sparingly (2-4 max). Return ONLY the post text — no titles, quotes, or markdown.`;

  const userParts = [`Topic/headline: ${topic.trim()}`];
  if (uniqueKeywords.length > 0) {
    userParts.push(`Keywords: ${uniqueKeywords.join(", ")}`);
  }
  if (brandName?.trim()) userParts.push(`Brand: ${brandName.trim()}`);
  if (callToAction?.trim()) userParts.push(`Call to action: ${callToAction.trim()}`);

  try {
    const { content, provider } = await aiChat(
      [
        { role: "system", content: system },
        { role: "user", content: userParts.join("\n") },
      ],
      { temperature: 0.8, maxTokens: 1200 }
    );

    const hashtagMatches = content.match(/#[\w]+/g) || [];
    const hashtags = [...new Set(hashtagMatches.map((h) => h.toLowerCase()))];
    return { message: content.trim(), hashtags, provider };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "AI unavailable";
    const shortReason = reason.includes("429")
      ? "AI quota limit reached."
      : reason.includes("403") || reason.includes("401")
        ? "AI API key issue."
        : "AI service unavailable.";

    return templateFallback({
      topic,
      keywords: uniqueKeywords,
      callToAction,
      brandName,
      warning: `${shortReason} We created a full draft you can edit below.`,
    });
  }
}

export async function generateImagePrompt(options: {
  topic: string;
  keywords?: string[];
}): Promise<string> {
  const { topic, keywords = [] } = options;
  const fallback = `Professional social media marketing image about ${topic}${keywords.length ? `, ${keywords.slice(0, 3).join(", ")}` : ""}, modern SaaS dashboard on laptop screen, clean blue and white design, high quality, no text overlay`;

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
