import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import {
  addLinkedInPost,
  listLinkedInPosts,
  updateLinkedInPost,
  deleteLinkedInPost,
  publishLinkedInPost,
  getLinkedInPostStats,
  syncLinkedInPosts,
} from "@/lib/linkedin-posts";

export async function GET(request: NextRequest) {
  return withAuth(async (user) => {
    const status = request.nextUrl.searchParams.get("status");
    const sync = request.nextUrl.searchParams.get("sync") === "true";

    if (sync) {
      await syncLinkedInPosts(user.id);
    }

    const posts = await listLinkedInPosts(user.id, status || undefined);
    const stats = await getLinkedInPostStats(user.id);
    return apiSuccess({ posts, stats, synced: sync });
  });
}

const createSchema = z.object({
  content: z.string().min(1),
  scheduledAt: z.string().optional(),
  visibility: z.string().optional(),
});

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    try {
      const body = await request.json();
      const data = createSchema.parse(body);
      const post = await addLinkedInPost(user.id, data);
      return apiSuccess({ post });
    } catch (err) {
      if (err instanceof z.ZodError) return apiError("Invalid input");
      return apiError(err instanceof Error ? err.message : "Failed to create post", 500);
    }
  });
}

const updateSchema = z.object({
  id: z.string(),
  content: z.string().optional(),
  scheduledAt: z.string().nullable().optional(),
  visibility: z.string().optional(),
  status: z.string().optional(),
});

export async function PATCH(request: NextRequest) {
  return withAuth(async (user) => {
    try {
      const body = await request.json();
      const data = updateSchema.parse(body);
      const post = await updateLinkedInPost(user.id, data.id, data);
      if (!post) return apiError("Post not found", 404);
      return apiSuccess({ post });
    } catch (err) {
      if (err instanceof z.ZodError) return apiError("Invalid input");
      return apiError(err instanceof Error ? err.message : "Failed to update post", 500);
    }
  });
}

export async function DELETE(request: NextRequest) {
  return withAuth(async (user) => {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return apiError("id required");
    const ok = await deleteLinkedInPost(user.id, id);
    if (!ok) return apiError("Post not found", 404);
    return apiSuccess({ deleted: true });
  });
}
