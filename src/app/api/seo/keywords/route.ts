import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { normalizeKeyword } from "@/lib/seo-post";
import { z } from "zod";

export async function GET() {
  return withAuth(async () => {
    const keywords = await prisma.seoKeyword.findMany({
      orderBy: { keyword: "asc" },
    });
    return apiSuccess({ keywords });
  });
}

const addSchema = z.object({
  keyword: z.string().min(1),
});

export async function POST(request: Request) {
  return withAuth(async () => {
    try {
      const body = await request.json();
      const data = addSchema.parse(body);
      const keyword = normalizeKeyword(data.keyword);
      if (!keyword) return apiError("Invalid keyword");

      const created = await prisma.seoKeyword.upsert({
        where: { keyword },
        create: { keyword },
        update: {},
      });

      return apiSuccess({ keyword: created });
    } catch (err) {
      if (err instanceof z.ZodError) return apiError("Invalid input");
      return apiError(err instanceof Error ? err.message : "Failed to save keyword", 500);
    }
  });
}

export async function DELETE(request: Request) {
  return withAuth(async () => {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return apiError("id required");

    await prisma.seoKeyword.delete({ where: { id } }).catch(() => null);
    return apiSuccess({ deleted: true });
  });
}
