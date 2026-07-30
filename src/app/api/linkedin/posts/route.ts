import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { resolveLinkedInOwnerId } from "@/lib/linkedin-api";
import {
  addLinkedInPost,
  listLinkedInPosts,
  updateLinkedInPost,
  deleteLinkedInPost,
  publishLinkedInPost,
  getLinkedInPostStats,
  syncLinkedInPosts,
} from "@/lib/linkedin-posts";

async function linkedInUserId(actingUserId: string) {
  const ownerId = await resolveLinkedInOwnerId(actingUserId);
  if (!ownerId) throw new Error("LinkedIn not connected");
  return ownerId;
}

export async function GET(request: NextRequest) {
  return withAuth(async (user) => {
    const status = request.nextUrl.searchParams.get("status");
    const sync = request.nextUrl.searchParams.get("sync") === "true";
    const ownerId = await linkedInUserId(user.id);

    if (sync) {
      const syncResult = await syncLinkedInPosts(ownerId, true);
      const posts = await listLinkedInPosts(ownerId, status || undefined);
      const stats = await getLinkedInPostStats(ownerId);
      return apiSuccess({ posts, stats, synced: sync, syncResult });
    }

    const posts = await listLinkedInPosts(ownerId, status || undefined);
    const stats = await getLinkedInPostStats(ownerId);
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
      const ownerId = await linkedInUserId(user.id);
      const post = await addLinkedInPost(ownerId, data);
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
      const ownerId = await linkedInUserId(user.id);
      const post = await updateLinkedInPost(ownerId, data.id, data);
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
    const ownerId = await linkedInUserId(user.id);
    const ok = await deleteLinkedInPost(ownerId, id);
    if (!ok) return apiError("Post not found", 404);
    return apiSuccess({ deleted: true });
  });
}
