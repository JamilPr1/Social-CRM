import "server-only";

import { aiEnv, isKimiConfigured } from "./ai-config";

export type KimiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function kimiChat(
  messages: KimiChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  if (!isKimiConfigured()) {
    throw new Error("Kimi API key is not configured. Set KIMI_API_KEY in your environment.");
  }

  const res = await fetch(`${aiEnv.kimiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${aiEnv.kimiApiKey}`,
    },
    body: JSON.stringify({
      model: aiEnv.kimiModel,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 1024,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kimi API error (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Kimi returned an empty response");
  return content;
}
