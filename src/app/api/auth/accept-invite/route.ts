import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { acceptUserInvite } from "@/lib/invites";
import { createSession, setSessionCookie } from "@/lib/auth";

const acceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(2),
  password: z.string().min(6),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = acceptSchema.parse(body);

    const user = await acceptUserInvite({
      token: data.token,
      name: data.name,
      password: data.password,
    });

    const jwt = await createSession(user.id);
    await setSessionCookie(jwt);

    return apiSuccess({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) return apiError("Invalid input");
    return apiError(err instanceof Error ? err.message : "Failed to accept invite", 400);
  }
}
