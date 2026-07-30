import { NextRequest } from "next/server";
import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { syncLinkedInPostComments, syncLinkedInPostAnalytics } from "@/lib/linkedin-posts";

export async function GET(request: NextRequest) {
  return withAuth(async (user) => {
    const postId = request.nextUrl.searchParams.get("postId");
    const sync = request.nextUrl.searchParams.get("sync") === "true";
    if (!postId) return apiError("postId required");

    const post = await prisma.linkedInPost.findFirst({
      where: { id: postId, userId: user.id },
    });
    if (!post) return apiError("Post not found", 404);

    if (sync) {
      await Promise.all([
        syncLinkedInPostAnalytics(user.id, postId),
        syncLinkedInPostComments(user.id, postId),
      ]);
    }

    const comments = await prisma.linkedInComment.findMany({
      where: { linkedInPostId: postId },
      orderBy: { createdAt: "desc" },
    });

    const updated = await prisma.linkedInPost.findUnique({ where: { id: postId } });

    return apiSuccess({ comments, post: updated });
  });
}
