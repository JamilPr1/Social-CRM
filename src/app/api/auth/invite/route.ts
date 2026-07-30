import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { getInviteByToken } from "@/lib/invites";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return apiError("Invite token required");

  const result = await getInviteByToken(token);
  if (!result) return apiError("Invite not found", 404);

  const { invite, status } = result;

  return apiSuccess({
    status,
    email: invite.email,
    name: invite.name,
    role: invite.role,
    expiresAt: invite.expiresAt.toISOString(),
    invitedBy: invite.invitedBy?.name || "Admin",
  });
}
