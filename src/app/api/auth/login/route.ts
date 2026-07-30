import { NextRequest } from "next/server";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, setSessionCookie } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-helpers";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return apiError("Invalid email or password", 401);
    }

    const valid = await compare(password, user.passwordHash);
    if (!valid) {
      return apiError("Invalid email or password", 401);
    }

    const jwt = await createSession(user.id);
    await setSessionCookie(jwt);

    return apiSuccess({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    if (err instanceof z.ZodError) return apiError("Invalid input");
    return apiError("Login failed", 500);
  }
}
