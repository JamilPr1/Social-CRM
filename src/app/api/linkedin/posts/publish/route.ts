import { NextRequest } from "next/server";
import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { resolveLinkedInOwnerId } from "@/lib/linkedin-api";
import { publishLinkedInPost } from "@/lib/linkedin-posts";

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    try {
      const { id } = await request.json();
      if (!id) return apiError("id required");
      const ownerId = await resolveLinkedInOwnerId(user.id);
      if (!ownerId) return apiError("LinkedIn not connected", 404);
      const post = await publishLinkedInPost(ownerId, id);
      return apiSuccess({ post });
    } catch (err) {
      return apiError(err instanceof Error ? err.message : "Failed to publish", 500);
    }
  });
}
