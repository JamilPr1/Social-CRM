import "server-only";

import { aiEnv } from "./ai-config";
import { generateImagePrompt } from "./ai-post";

/** Kimi has no image API — use Pollinations (free, no key) for social post images. */
export async function generatePostImageUrl(options: {
  topic: string;
  keywords?: string[];
}): Promise<{ imageUrl: string; prompt: string; provider: string }> {
  const prompt = await generateImagePrompt(options);

  if (aiEnv.imageProvider === "pollinations") {
    const encoded = encodeURIComponent(prompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&enhance=true`;
    return { imageUrl, prompt, provider: "pollinations" };
  }

  throw new Error(`Unsupported image provider: ${aiEnv.imageProvider}`);
}
