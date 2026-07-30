import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { repairLinkedInPostUrn } from "@/lib/linkedin-posts";

const schema = z.object({
  postId: z.string(),
  urlOrUrn: z.string().min(1),
});

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    try {
      const body = await request.json();
      const data = schema.parse(body);
      const post = await repairLinkedInPostUrn(user.id, data.postId, data.urlOrUrn);
      return apiSuccess({ post });
    } catch (err) {
      if (err instanceof z.ZodError) return apiError("Invalid input");
      return apiError(err instanceof Error ? err.message : "Failed to repair post URN", 500);
    }
  });
}
