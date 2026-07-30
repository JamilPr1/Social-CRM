import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "meta_crm_session";
const publicPaths = [
  "/login",
  "/join",
  "/privacy",
  "/terms",
  "/data-deletion",
  "/api/auth/login",
  "/api/auth/invite",
  "/api/auth/accept-invite",
  "/api/data-deletion",
];

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const jwt = request.cookies.get(SESSION_COOKIE)?.value;
  if (!jwt) return false;
  const secret = getSecret();
  if (!secret) return false;
  try {
    await jwtVerify(jwt, secret);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    publicPaths.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/api/meta/callback") ||
    pathname.startsWith("/api/linkedin/callback") ||
    pathname.startsWith("/api/media/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const authenticated = await hasValidSession(request);

  if (pathname.startsWith("/api/")) {
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (!authenticated && !pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (authenticated && pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (authenticated && pathname.startsWith("/join")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
