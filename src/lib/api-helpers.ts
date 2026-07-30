import "server-only";

import { NextResponse } from "next/server";
import type { SessionUser } from "@/types/session";

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function apiSuccess<T>(
  data: T,
  status = 200,
  headers?: Record<string, string>
) {
  return NextResponse.json(data, { status, headers });
}

export function unauthorized() {
  return apiError("Unauthorized", 401);
}

export function forbidden() {
  return apiError("Forbidden", 403);
}

export async function withAuth(
  handler: (user: SessionUser) => Promise<NextResponse>
): Promise<NextResponse> {
  const { getSessionUser } = await import("./auth");
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return handler(user);
}
