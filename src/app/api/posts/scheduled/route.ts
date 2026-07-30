import { NextRequest } from "next/server";
import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { publishToAllPlatforms, getPostableAccountIds, publishDueScheduledPosts, shouldPublishLinkedIn } from "@/lib/publish";
import { publishDueLinkedInPosts, addLinkedInPost } from "@/lib/linkedin-posts";
import { z } from "zod";

export async function GET(request: NextRequest) {
  return withAuth(async (user) => {
    await Promise.all([publishDueScheduledPosts(), publishDueLinkedInPosts()]);

    const status = request.nextUrl.searchParams.get("status");
    const where: { createdById?: string; status?: string } = {};
    if (user.role !== "ADMIN") where.createdById = user.id;
    if (status) where.status = status;

    const scheduled = await prisma.scheduledPost.findMany({
      where,
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
      take: 50,
    });

    return apiSuccess({ scheduled });
  });
}

const createSchema = z.object({
  accountIds: z.array(z.string()).optional(),
  postToAll: z.boolean().optional(),
  platform: z.enum(["facebook", "instagram", "both", "linkedin", "all"]),
  topic: z.string().optional(),
  message: z.string().min(1),
  keywords: z.array(z.string()).optional(),
  imageUrl: z.string().url().optional(),
  scheduledAt: z.string().datetime().optional(),
  publishNow: z.boolean().optional(),
  includeLinkedIn: z.boolean().optional(),
});

export async function POST(request: Request) {
  return withAuth(async (user) => {
    try {
      const body = await request.json();
      const data = createSchema.parse(body);

      let accountIds = data.accountIds || [];
      if (data.postToAll && data.platform !== "linkedin") {
        accountIds = await getPostableAccountIds(user);
      }
      const linkedInOptIn =
        data.platform === "all" ? data.includeLinkedIn : undefined;
      const publishLinkedIn = shouldPublishLinkedIn(data.platform, linkedInOptIn);
      const needsMetaPages = data.platform !== "linkedin";

      if (needsMetaPages && data.platform !== "all" && accountIds.length === 0) {
        return apiError("Select at least one page");
      }
      if (data.platform === "linkedin" && !publishLinkedIn) {
        return apiError("LinkedIn is not enabled");
      }

      const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
      const publishNow = data.publishNow || !scheduledAt;

      if (
        (data.platform === "instagram" ||
          data.platform === "both" ||
          data.platform === "all") &&
        !data.imageUrl
      ) {
        return apiError("Upload an image — required for Instagram posts");
      }

      if (publishNow) {
        const results = await publishToAllPlatforms(user, {
          accountIds,
          message: data.message,
          platform: data.platform,
          imageUrl: data.imageUrl,
          linkedInOptIn,
        });
        const record = await prisma.scheduledPost.create({
          data: {
            createdById: user.id,
            accountIds: JSON.stringify(accountIds),
            platform: data.platform,
            topic: data.topic,
            message: data.message,
            keywords: data.keywords ? JSON.stringify(data.keywords) : null,
            imageUrl: data.imageUrl,
            status: results.every((r) => r.success) ? "PUBLISHED" : "FAILED",
            publishResults: JSON.stringify(results),
          },
        });

        return apiSuccess({ scheduled: record, results, published: true });
      }

      const record = await prisma.scheduledPost.create({
        data: {
          createdById: user.id,
          accountIds: JSON.stringify(accountIds),
          platform: data.platform,
          topic: data.topic,
          message: data.message,
          keywords: data.keywords ? JSON.stringify(data.keywords) : null,
          imageUrl: data.imageUrl,
          scheduledAt,
          status: "SCHEDULED",
        },
      });

      if (publishLinkedIn && scheduledAt) {
        await addLinkedInPost(user.id, {
          content: data.message,
          scheduledAt: scheduledAt.toISOString(),
          source: "crm_scheduled",
        });
      }

      return apiSuccess({ scheduled: record, published: false });
    } catch (err) {
      if (err instanceof z.ZodError) return apiError("Invalid input");
      return apiError(err instanceof Error ? err.message : "Failed to schedule post", 500);
    }
  });
}
