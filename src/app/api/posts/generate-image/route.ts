import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { generatePostImageUrl } from "@/lib/ai-image";
import { z } from "zod";

const imageSchema = z.object({
  topic: z.string().min(1),
  keywords: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  return withAuth(async () => {
    try {
      const body = await request.json();
      const data = imageSchema.parse(body);
      const result = await generatePostImageUrl({
        topic: data.topic,
        keywords: data.keywords,
      });
      return apiSuccess(result);
    } catch (err) {
      if (err instanceof z.ZodError) return apiError("Topic is required");
      return apiError(err instanceof Error ? err.message : "Image generation failed", 500);
    }
  });
}
