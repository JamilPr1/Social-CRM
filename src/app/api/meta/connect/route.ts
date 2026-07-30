import { NextRequest } from "next/server";
import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { getMetaOAuthUrl } from "@/lib/meta-api";
import { getRequestOrigin, getMetaRedirectUri } from "@/lib/app-url";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  return withAuth(async (user) => {
    if (user.role !== "ADMIN") {
      return apiError("Only admins can connect Meta accounts", 403);
    }

    const reauth = request.nextUrl.searchParams.get("reauth") === "true";
    const standard = request.nextUrl.searchParams.get("standard") === "true";
    const origin = getRequestOrigin(request);
    const redirectUri = getMetaRedirectUri(origin);
    const state = randomBytes(16).toString("hex");
    const cookieStore = await cookies();
    cookieStore.set("meta_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    cookieStore.set("meta_oauth_redirect", redirectUri, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    return apiSuccess({
      url: getMetaOAuthUrl(state, { reauth, standard, redirectUri }),
    });
  });
}
