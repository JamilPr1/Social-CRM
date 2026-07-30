import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { decryptPasswordDisplay } from "@/lib/invites";

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

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    if (user.role !== "ADMIN") return apiError("Forbidden", 403);
    return apiError(
      "Direct user creation is disabled. Invite users from Settings instead.",
      400
    );
  });
}
