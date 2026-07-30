import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  return withAuth(async (user) => {
    const status = request.nextUrl.searchParams.get("status");
    const leads = await prisma.linkedInLead.findMany({
      where: { userId: user.id, ...(status ? { status } : {}) },
      include: { activities: { orderBy: { createdAt: "desc" }, take: 5 } },
      orderBy: { createdAt: "desc" },
    });
    const dueFollowUps = await prisma.linkedInLead.count({
      where: {
        userId: user.id,
        nextFollowUpAt: { lte: new Date() },
        status: { notIn: ["won", "lost"] },
      },
    });
    return apiSuccess({ leads, dueFollowUps });
  });
}

const leadSchema = z.object({
  name: z.string().min(1),
  company: z.string().optional(),
  title: z.string().optional(),
  linkedinUrl: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  nextFollowUpAt: z.string().optional(),
});

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    try {
      const data = leadSchema.parse(await request.json());
      const lead = await prisma.linkedInLead.create({
        data: {
          userId: user.id,
          name: data.name,
          company: data.company,
          title: data.title,
          linkedinUrl: data.linkedinUrl,
          email: data.email,
          phone: data.phone,
          status: data.status || "new",
          priority: data.priority || "medium",
          source: data.source,
          notes: data.notes,
          nextFollowUpAt: data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : null,
        },
      });
      return apiSuccess({ lead });
    } catch (err) {
      if (err instanceof z.ZodError) return apiError("Invalid input");
      return apiError(err instanceof Error ? err.message : "Failed", 500);
    }
  });
}
