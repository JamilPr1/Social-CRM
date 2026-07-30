import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { buildSeoPost } from "@/lib/seo-post";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const generateSchema = z.object({
  topic: z.string().min(1),
  keywords: z.array(z.string()).optional(),
  callToAction: z.string().optional(),
  brandName: z.string().optional(),
  useSavedKeywords: z.boolean().optional(),
});

export async function POST(request: Request) {
  return withAuth(async () => {
    try {
      const body = await request.json();
      const data = generateSchema.parse(body);

      let keywords = data.keywords || [];
      if (data.useSavedKeywords) {
        const saved = await prisma.seoKeyword.findMany({
          orderBy: { keyword: "asc" },
          take: 20,
        });
        keywords = [...keywords, ...saved.map((k) => k.keyword)];
      }

      const result = buildSeoPost({
        topic: data.topic,
        keywords,
        callToAction: data.callToAction,
        brandName: data.brandName,
      });

      return apiSuccess(result);
    } catch (err) {
      if (err instanceof z.ZodError) return apiError("Invalid input");
      return apiError(err instanceof Error ? err.message : "Generation failed", 500);
    }
  });
}
