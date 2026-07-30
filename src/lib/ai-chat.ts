import "server-only";

import { aiEnv, getActiveProviderOrder } from "./ai-config";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

async function geminiChat(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const system = messages.find((m) => m.role === "system")?.content;
  const conversation = messages.filter((m) => m.role !== "system");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${aiEnv.geminiModel}:generateContent?key=${aiEnv.geminiApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents: conversation.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxTokens ?? 1024,
        },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!content) throw new Error("Gemini returned an empty response");
  return content;
}

async function groqChat(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${aiEnv.groqApiKey}`,
    },
    body: JSON.stringify({
      model: aiEnv.groqModel,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 1024,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq API error (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Groq returned an empty response");
  return content;
}

async function kimiChat(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
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

export async function aiChat(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<{ content: string; provider: "gemini" | "groq" | "kimi" }> {
  const order = getActiveProviderOrder();
  const errors: string[] = [];

  for (const provider of order) {
    try {
      let content: string;
      if (provider === "gemini") content = await geminiChat(messages, options);
      else if (provider === "groq") content = await groqChat(messages, options);
      else content = await kimiChat(messages, options);
      return { content, provider };
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  throw new Error(errors.join(" | ") || "No AI provider configured");
}
