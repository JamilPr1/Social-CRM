import { NextRequest } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { logActivity } from "@/lib/accounts";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "MANAGER", "MEMBER"]).default("MEMBER"),
});

export async function GET() {
  return withAuth(async (user) => {
    if (user.role !== "ADMIN") return apiError("Forbidden", 403);

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        accountAccess: {
          include: { metaAccount: { select: { id: true, pageName: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({ users });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    if (user.role !== "ADMIN") return apiError("Forbidden", 403);

    try {
      const body = await request.json();
      const data = createUserSchema.parse(body);

      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing) return apiError("Email already in use");

      const newUser = await prisma.user.create({
        data: {
          email: data.email,
          name: data.name,
          passwordHash: await hash(data.password, 12),
          role: data.role,
        },
        select: { id: true, email: true, name: true, role: true, isActive: true },
      });

      await logActivity(user.id, "CREATE_USER", `Created user ${newUser.email}`);
      return apiSuccess({ user: newUser }, 201);
    } catch (err) {
      if (err instanceof z.ZodError) return apiError("Invalid input");
      return apiError("Failed to create user", 500);
    }
  });
}
