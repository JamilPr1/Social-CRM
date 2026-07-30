import "server-only";

const PLACEHOLDER_PATTERNS = [/^your_/i, /^sk-your/i, /^change_me/i, /^example/i, /^placeholder/i];

function isPlaceholder(value: string | undefined) {
  if (!value) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value.trim()));
}

function cleanKey(value: string | undefined) {
  const key = value?.trim() || "";
  if (!key || isPlaceholder(key)) return "";
  return key;
}

export type AiProvider = "gemini" | "groq" | "kimi" | "template" | "auto";

export const aiEnv = {
  provider: (process.env.AI_PROVIDER || "auto").toLowerCase() as AiProvider,
  geminiApiKey: cleanKey(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY),
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash-lite",
  groqApiKey: cleanKey(process.env.GROQ_API_KEY),
  groqModel: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  kimiApiKey: cleanKey(process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY),
  kimiBaseUrl:
    process.env.KIMI_API_BASE_URL ||
    process.env.MOONSHOT_API_BASE_URL ||
    "https://api.moonshot.ai/v1",
  kimiModel: process.env.KIMI_MODEL || "kimi-k2.5",
  imageProvider: (process.env.IMAGE_GEN_PROVIDER || "pollinations").toLowerCase(),
};

export function isGeminiConfigured() {
  return Boolean(aiEnv.geminiApiKey);
}

export function isGroqConfigured() {
  return Boolean(aiEnv.groqApiKey);
}

export function isKimiConfigured() {
  const key = aiEnv.kimiApiKey;
  return Boolean(key && !key.startsWith("sk-proj-"));
}

export function isAnyAiConfigured() {
  return isGeminiConfigured() || isGroqConfigured() || isKimiConfigured();
}

/** Providers to try in order when AI_PROVIDER=auto */
export function getActiveProviderOrder(): Array<"gemini" | "groq" | "kimi"> {
  const fixed = aiEnv.provider;
  if (fixed === "gemini" && isGeminiConfigured()) return ["gemini"];
  if (fixed === "groq" && isGroqConfigured()) return ["groq"];
  if (fixed === "kimi" && isKimiConfigured()) return ["kimi"];
  if (fixed === "template") return [];

  const order: Array<"gemini" | "groq" | "kimi"> = [];
  if (isGeminiConfigured()) order.push("gemini");
  if (isGroqConfigured()) order.push("groq");
  if (isKimiConfigured()) order.push("kimi");
  return order;
}

export function getAiConfigStatus() {
  const order = getActiveProviderOrder();
  return {
    provider: aiEnv.provider,
    activeProvider: order[0] || "template",
    gemini: { configured: isGeminiConfigured(), model: aiEnv.geminiModel },
    groq: { configured: isGroqConfigured(), model: aiEnv.groqModel },
    kimi: {
      configured: isKimiConfigured(),
      model: aiEnv.kimiModel,
      baseUrl: aiEnv.kimiBaseUrl,
    },
    template: { configured: true },
    image: {
      provider: aiEnv.imageProvider,
      note: "Images use Pollinations (free). Kimi/Gemini/Groq write the prompt only.",
    },
    recommendation:
      "For free AI writing, use Google Gemini (aistudio.google.com) or Groq (console.groq.com).",
  };
}

// Back-compat for UI checks
export function isKimiConfiguredLegacy() {
  return isAnyAiConfigured();
}
