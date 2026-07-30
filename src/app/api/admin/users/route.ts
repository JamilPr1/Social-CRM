import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { logActivity } from "@/lib/accounts";
import { decryptPasswordDisplay } from "@/lib/invites";
import { createUserManually } from "@/lib/users-admin";

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
        onboardedAt: true,
        createdAt: true,
        passwordDisplay: true,
        accountAccess: {
          include: { metaAccount: { select: { id: true, pageName: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const usersWithPasswords = users.map((u) => ({
      ...u,
      passwordDisplay: decryptPasswordDisplay(u.passwordDisplay),
      onboardedAt: u.onboardedAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    }));

    return apiSuccess({ users: usersWithPasswords });
  });
}

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "MANAGER", "MEMBER"]).default("MEMBER"),
});

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    if (user.role !== "ADMIN") return apiError("Forbidden", 403);

    try {
      const body = await request.json();
      const data = createUserSchema.parse(body);

      const newUser = await createUserManually({
        email: data.email,
        name: data.name,
        password: data.password,
        role: data.role,
      });

      await logActivity(user.id, "CREATE_USER", `Created user ${newUser.email}`);

      return apiSuccess(
        {
          user: {
            ...newUser,
            onboardedAt: newUser.onboardedAt?.toISOString() ?? null,
            passwordDisplay: data.password,
          },
        },
        201
      );
    } catch (err) {
      if (err instanceof z.ZodError) return apiError("Invalid input");
      return apiError(err instanceof Error ? err.message : "Failed to create user", 400);
    }
  });
}
