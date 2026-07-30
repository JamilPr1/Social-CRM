import { PrismaClient } from "@prisma/client";
import { createDecipheriv, scryptSync } from "crypto";

function decryptToken(encryptedText) {
  const [ivHex, authTagHex, encryptedHex] = encryptedText.split(":");
  const key = scryptSync(
    process.env.TOKEN_ENCRYPTION_KEY || "default-dev-key-change-in-production!",
    "meta-crm-salt",
    32
  );
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

const GRAPH = "https://graph.facebook.com/v21.0";
const prisma = new PrismaClient();

console.log("=== META CRM HEALTH CHECK ===\n");

const accounts = await prisma.metaAccount.findMany();
console.log(`Connected pages in CRM: ${accounts.length}`);

if (accounts.length === 0) {
  console.log("\n❌ No pages connected. Go to /accounts and Connect Account.");
  await prisma.$disconnect();
  process.exit(0);
}

const appToken = `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`;

for (const account of accounts) {
  console.log(`\n--- ${account.pageName} ---`);
  console.log(`Page ID: ${account.pageId}`);
  console.log(`Instagram: ${account.instagramUsername ? "@" + account.instagramUsername : "not linked"}`);

  const token = decryptToken(account.pageAccessToken);

  const debugRes = await fetch(
    `${GRAPH}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appToken)}`
  );
  const debug = (await debugRes.json()).data || {};
  const scopes = debug.scopes || [];
  const granular = debug.granular_scopes || [];

  const hasManagePosts =
    scopes.includes("pages_manage_posts") ||
    granular.some((g) => g.scope === "pages_manage_posts");

  const hasIgPublish =
    scopes.includes("instagram_content_publish") ||
    granular.some((g) => g.scope === "instagram_content_publish");

  console.log(`Token valid: ${debug.is_valid !== false}`);
  console.log(`Scopes: ${scopes.join(", ") || "(none)"}`);
  console.log(`pages_manage_posts: ${hasManagePosts ? "✓ YES" : "✗ MISSING"}`);
  console.log(`instagram_content_publish: ${hasIgPublish ? "✓ YES" : "✗ MISSING"}`);

  const igRes = await fetch(
    `${GRAPH}/${account.pageId}?fields=instagram_business_account{id,username}&access_token=${token}`
  );
  const igData = await igRes.json();
  const ig = igData.instagram_business_account;
  console.log(`IG on page (live): ${ig ? "@" + ig.username : "not linked"}`);

  const postRes = await fetch(`${GRAPH}/${account.pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "[CRM Health Check] Test post — safe to delete",
      access_token: token,
    }),
  });
  const postData = await postRes.json();
  if (postRes.ok && postData.id) {
    console.log(`Facebook post test: ✓ SUCCESS (post id: ${postData.id})`);
  } else {
    console.log(`Facebook post test: ✗ FAILED`);
    console.log(`  Error: ${postData.error?.message || JSON.stringify(postData)}`);
  }

  if (!hasManagePosts) {
    console.log("\n  → Fix: Add pages_manage_posts in Meta Use Cases, then Reconnect in CRM");
  }
  if (!ig && !account.instagramId) {
    console.log("  → Fix: Link Instagram in Business Suite, then Reconnect in CRM");
  }
}

const logs = await prisma.metaConnectionLog.findMany({ orderBy: { createdAt: "desc" }, take: 1 });
if (logs[0]) {
  console.log(`\nLast connect log: ${logs[0].status} at ${logs[0].createdAt.toISOString()}`);
}

console.log("\n=== END ===");
await prisma.$disconnect();
