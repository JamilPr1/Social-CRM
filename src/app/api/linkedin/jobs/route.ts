import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  return withAuth(async (user) => {
    const status = request.nextUrl.searchParams.get("status");
    const jobs = await prisma.jobApplication.findMany({
      where: { userId: user.id, ...(status ? { status } : {}) },
      orderBy: { updatedAt: "desc" },
    });
    return apiSuccess({ jobs });
  });
}

const jobSchema = z.object({
  jobTitle: z.string().min(1),
  company: z.string().min(1),
  jobUrl: z.string().optional(),
  jobDescription: z.string().optional(),
  location: z.string().optional(),
  salaryRange: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    try {
      const data = jobSchema.parse(await request.json());
      const job = await prisma.jobApplication.create({
        data: { userId: user.id, ...data },
      });
      return apiSuccess({ job });
    } catch (err) {
      if (err instanceof z.ZodError) return apiError("Invalid input");
      return apiError(err instanceof Error ? err.message : "Failed", 500);
    }
  });
}
