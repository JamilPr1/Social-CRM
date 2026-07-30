import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { logActivity } from "@/lib/accounts";

const accessSchema = z.object({
  userId: z.string(),
  metaAccountId: z.string(),
  permissions: z.array(z.enum(["VIEW", "POST", "REPLY", "BOOST", "MANAGE"])).min(1),
});

export async function GET(request: NextRequest) {
  return withAuth(async (user) => {
    if (user.role !== "ADMIN") return apiError("Forbidden", 403);

    const userId = request.nextUrl.searchParams.get("userId");
    if (!userId) return apiError("userId required");

    const access = await prisma.accountAccess.findMany({
      where: { userId },
      include: { metaAccount: true },
    });

    return apiSuccess({ access });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    if (user.role !== "ADMIN") return apiError("Forbidden", 403);

    try {
      const body = await request.json();
      const data = accessSchema.parse(body);

      const result = await prisma.accountAccess.upsert({
        where: {
          userId_metaAccountId: {
            userId: data.userId,
            metaAccountId: data.metaAccountId,
          },
        },
        create: {
          userId: data.userId,
          metaAccountId: data.metaAccountId,
          permissions: JSON.stringify(data.permissions),
        },
        update: {
          permissions: JSON.stringify(data.permissions),
        },
        include: { metaAccount: true },
      });

      await logActivity(
        user.id,
        "ASSIGN_ACCOUNT_ACCESS",
        `Assigned ${result.metaAccount.pageName} to user ${data.userId}`
      );

      return apiSuccess({ access: result });
    } catch (err) {
      if (err instanceof z.ZodError) return apiError("Invalid input");
      return apiError("Failed to assign access", 500);
    }
  });
}

export async function DELETE(request: NextRequest) {
  return withAuth(async (user) => {
    if (user.role !== "ADMIN") return apiError("Forbidden", 403);

    const userId = request.nextUrl.searchParams.get("userId");
    const metaAccountId = request.nextUrl.searchParams.get("metaAccountId");
    if (!userId || !metaAccountId) return apiError("userId and metaAccountId required");

    await prisma.accountAccess.delete({
      where: {
        userId_metaAccountId: { userId, metaAccountId },
      },
    });

    await logActivity(user.id, "REVOKE_ACCOUNT_ACCESS", `Revoked access for user ${userId}`);
    return apiSuccess({ ok: true });
  });
}
