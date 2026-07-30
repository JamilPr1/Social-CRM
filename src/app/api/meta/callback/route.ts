import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getUserPages,
  diagnosePageAccess,
  createFacebookPage,
} from "@/lib/meta-api";
import { SUGGESTED_PAGES } from "@/lib/meta-setup";
import { logActivity } from "@/lib/accounts";
import { saveMetaUserToken, upsertMetaPagesFromToken } from "@/lib/meta-sync";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login?error=unauthorized", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/accounts?error=${error}`, request.url));
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("meta_oauth_state")?.value;
  const redirectUri = cookieStore.get("meta_oauth_redirect")?.value;
  cookieStore.delete("meta_oauth_state");
  cookieStore.delete("meta_oauth_redirect");

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(new URL("/accounts?error=invalid_state", request.url));
  }

  try {
    const { access_token: shortToken } = await exchangeCodeForToken(code, redirectUri);
    const { access_token: longToken, expires_in } = await getLongLivedToken(shortToken);
    let pages = await getUserPages(longToken);

    if (pages.length === 0) {
      const createAttempts = [];
      for (const template of SUGGESTED_PAGES) {
        const result = await createFacebookPage(longToken, {
          name: template.name,
          about: template.about,
        });
        createAttempts.push({ name: template.name, ...result });
      }
      const createdAny = createAttempts.some((r) => r.id);
      if (createdAny) {
        pages = await getUserPages(longToken);
      }

      const diagnosis = await diagnosePageAccess(longToken);
      await prisma.metaConnectionLog.create({
        data: {
          userId: user.id,
          status: pages.length > 0 ? "recovered_after_create" : "no_pages",
          diagnosis: JSON.stringify({ ...diagnosis, createAttempts }),
        },
      });

      if (pages.length === 0) {
        console.error("OAuth succeeded but no pages returned", diagnosis, createAttempts);
        return NextResponse.redirect(new URL("/accounts?error=no_pages", request.url));
      }
    }

    const tokenExpiresAt = expires_in
      ? new Date(Date.now() + expires_in * 1000)
      : null;

    await saveMetaUserToken(user.id, longToken, expires_in);
    const { synced, pageNames } = await upsertMetaPagesFromToken(
      user.id,
      longToken,
      tokenExpiresAt
    );

    await logActivity(user.id, "CONNECT_META_ACCOUNTS", `Connected ${synced} page(s): ${pageNames.join(", ")}`);
    return NextResponse.redirect(new URL("/accounts?connected=true", request.url));
  } catch (err) {
    console.error("Meta OAuth error:", err);
    return NextResponse.redirect(new URL("/accounts?error=oauth_failed", request.url));
  }
}
