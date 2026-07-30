import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { publishToAllPlatforms, getPostableAccountIds } from "@/lib/publish";
import { z } from "zod";

const bulkPostSchema = z.object({
  accountIds: z.array(z.string()).optional(),
  postToAll: z.boolean().optional(),
  message: z.string().min(1),
  platform: z.enum(["facebook", "instagram", "both", "linkedin", "all"]).default("all"),
  imageUrl: z.string().url().optional(),
  keywords: z.array(z.string()).optional(),
  includeLinkedIn: z.boolean().optional(),
});
export async function POST(request: Request) {
  return withAuth(async (user) => {
    try {
      const body = await request.json();
      const data = bulkPostSchema.parse(body);

      let accountIds = data.accountIds || [];
      if (data.postToAll && data.platform !== "linkedin") {
        accountIds = await getPostableAccountIds(user);
      }

      if (accountIds.length === 0 && data.platform !== "linkedin" && data.platform !== "all") {
        return apiError("Select at least one page or enable post to all");
      }

      if (
        (data.platform === "instagram" ||
          data.platform === "both" ||
          data.platform === "all") &&
        !data.imageUrl
      ) {
        return apiError("Upload an image — required for Instagram posts");
      }

      const results = await publishToAllPlatforms(user, {
        accountIds,
        message: data.message,
        platform: data.platform,
        imageUrl: data.imageUrl,
        includeLinkedIn:
          data.includeLinkedIn ?? (data.platform === "all" || data.platform === "linkedin"),
      });
      const successCount = results.filter((r) => r.success).length;
      return apiSuccess({
        results,
        successCount,
        total: results.length,
      });
    } catch (err) {
      if (err instanceof z.ZodError) return apiError("Invalid input");
      return apiError(err instanceof Error ? err.message : "Bulk publish failed", 500);
    }
  });
}
