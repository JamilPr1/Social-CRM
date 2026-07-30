import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { sessionCache } from "./cache";
import type { Role } from "@prisma/client";
import type { SessionUser } from "@/types/session";

export type { SessionUser };

const SESSION_COOKIE = "meta_crm_session";
const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 days
const SESSION_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function createSession(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) throw new Error("User not found");

  const expiresAt = new Date(Date.now() + SESSION_DURATION * 1000);
  const token = crypto.randomUUID();

  await prisma.session.create({
    data: { userId, token, expiresAt },
  });

  sessionCache.set(token, true, SESSION_CACHE_TTL);

  const jwt = await new SignJWT({
    sub: userId,
    sid: token,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresAt)
    .sign(getSecret());

  return jwt;
}

export async function setSessionCookie(jwt: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

async function isSessionValid(sessionId: string): Promise<boolean> {
  const cached = sessionCache.get(sessionId);
  if (cached === true) return true;

  const session = await prisma.session.findUnique({
    where: { token: sessionId },
    select: {
      expiresAt: true,
      user: { select: { isActive: true } },
    },
  });

  const valid = !!session && session.expiresAt >= new Date() && session.user.isActive;
  if (valid) sessionCache.set(sessionId, true, SESSION_CACHE_TTL);
  return valid;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const jwt = cookieStore.get(SESSION_COOKIE)?.value;
  if (!jwt) return null;

  try {
    const { payload } = await jwtVerify(jwt, getSecret());
    const userId = payload.sub;
    const sessionId = payload.sid as string;
    const email = payload.email as string;
    const name = payload.name as string;
    const role = payload.role as Role;

    if (!userId || !sessionId || !email || !name || !role) return null;

    const valid = await isSessionValid(sessionId);
    if (!valid) return null;

    return { id: userId, email, name, role };
  } catch {
    return null;
  }
}

export async function destroySession() {
  const cookieStore = await cookies();
  const jwt = cookieStore.get(SESSION_COOKIE)?.value;
  if (!jwt) return;

  try {
    const { payload } = await jwtVerify(jwt, getSecret());
    const sessionId = payload.sid as string;
    if (sessionId) {
      sessionCache.delete(sessionId);
      await prisma.session.deleteMany({ where: { token: sessionId } });
    }
  } catch {
    // ignore invalid token
  }

  await clearSessionCookie();
}
