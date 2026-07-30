import "server-only";

const PLACEHOLDER_PATTERNS = [/^your_/i, /^sk-your/i, /^change_me/i, /^example/i, /^placeholder/i];

function isPlaceholder(value: string | undefined) {
  if (!value) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value.trim()));
}

export const aiEnv = {
  kimiApiKey:
    process.env.KIMI_API_KEY ||
    process.env.MOONSHOT_API_KEY ||
    process.env.OPENAI_API_KEY ||
    "",
  kimiBaseUrl:
    process.env.KIMI_API_BASE_URL ||
    process.env.MOONSHOT_API_BASE_URL ||
    "https://api.moonshot.ai/v1",
  kimiModel: process.env.KIMI_MODEL || "kimi-k2.5",
  imageProvider: (process.env.IMAGE_GEN_PROVIDER || "pollinations").toLowerCase(),
};

export function isKimiConfigured() {
  const key = aiEnv.kimiApiKey;
  return Boolean(key && !isPlaceholder(key) && !key.startsWith("sk-proj-"));
}

export function getAiConfigStatus() {
  return {
    kimi: {
      configured: isKimiConfigured(),
      model: aiEnv.kimiModel,
      baseUrl: aiEnv.kimiBaseUrl,
    },
    image: {
      provider: aiEnv.imageProvider,
      note:
        "Kimi does not generate images. CRM uses Pollinations (free) for image URLs when enabled.",
    },
  };
}
