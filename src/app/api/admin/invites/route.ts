import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { logActivity } from "@/lib/accounts";
import { createUserInvite, listInvitesForAdmin, decryptPasswordDisplay } from "@/lib/invites";
import { getRequestOrigin } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { isEmailConfigured, sendInviteEmail } from "@/lib/email";
import { getAdminEmail } from "@/lib/admin-config";

export async function GET() {
  return withAuth(async (user) => {
    if (user.role !== "ADMIN") return apiError("Forbidden", 403);

    const [invites, users] = await Promise.all([
      listInvitesForAdmin(),
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          onboardedAt: true,
          createdAt: true,
          passwordDisplay: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return apiSuccess({
      emailConfigured: isEmailConfigured(),
      senderEmail: getAdminEmail(),
      invites: invites.map((invite) => ({
        id: invite.id,
        email: invite.email,
        name: invite.name,
        role: invite.role,
        expiresAt: invite.expiresAt.toISOString(),
        acceptedAt: invite.acceptedAt?.toISOString() ?? null,
        createdAt: invite.createdAt.toISOString(),
        invitedBy: invite.invitedBy,
      })),
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        isActive: u.isActive,
        onboardedAt: u.onboardedAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
        passwordDisplay: decryptPasswordDisplay(u.passwordDisplay),
      })),
    });
  });
}

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).optional(),
  role: z.enum(["ADMIN", "MANAGER", "MEMBER"]).default("MEMBER"),
});

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    if (user.role !== "ADMIN") return apiError("Forbidden", 403);

    try {
      const body = await request.json();
      const data = inviteSchema.parse(body);
      const origin = getRequestOrigin(request);
      const { invite, joinUrl } = await createUserInvite(
        user.id,
        data,
        origin
      );

      let emailSent = false;
      let emailError: string | null = null;

      if (isEmailConfigured()) {
        try {
          await sendInviteEmail({
            to: invite.email,
            inviteeName: invite.name,
            joinUrl,
            invitedByName: user.name,
            expiresAt: invite.expiresAt,
          });
          emailSent = true;
        } catch (err) {
          emailError =
            err instanceof Error ? err.message : "Failed to send invite email";
        }
      } else {
        emailError =
          "Email not configured (set SMTP_PASS in Vercel). Share the join link below.";
      }

      await logActivity(user.id, "INVITE_USER", `Invited ${invite.email}`);

      return apiSuccess(
        {
          invite: {
            id: invite.id,
            email: invite.email,
            name: invite.name,
            role: invite.role,
            expiresAt: invite.expiresAt.toISOString(),
            joinUrl,
            emailSent,
            emailError,
            senderEmail: getAdminEmail(),
          },
        },
        201
      );
    } catch (err) {
      if (err instanceof z.ZodError) return apiError("Invalid input");
      return apiError(err instanceof Error ? err.message : "Failed to send invite", 400);
    }
  });
}

export async function DELETE(request: NextRequest) {
  return withAuth(async (user) => {
    if (user.role !== "ADMIN") return apiError("Forbidden", 403);

    const id = request.nextUrl.searchParams.get("id");
    if (!id) return apiError("Invite id required");

    const invite = await prisma.userInvite.findUnique({ where: { id } });
    if (!invite) return apiError("Invite not found", 404);
    if (invite.acceptedAt) return apiError("Cannot revoke an accepted invite");

    await prisma.userInvite.delete({ where: { id } });
    await logActivity(user.id, "REVOKE_INVITE", `Revoked invite for ${invite.email}`);

    return apiSuccess({ deleted: true });
  });
}
