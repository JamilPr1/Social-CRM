/**
 * Migrate data from linkedin-automation-suite SQLite DB into Meta CRM Prisma DB.
 * Usage: node scripts/migrate-linkedin-data.mjs [path-to-linkedin-suite.db]
 */
import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { existsSync } from "fs";
import { join } from "path";
import { createCipheriv, randomBytes, scryptSync } from "crypto";

config();

function encryptToken(plainText) {
  const secret = process.env.TOKEN_ENCRYPTION_KEY || "default-dev-key-change-in-production!";
  const key = scryptSync(secret, "meta-crm-salt", 32);
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

const defaultPath = join(process.cwd(), "data", "linkedin-suite.db");
const dbPath = process.argv[2] || defaultPath;
const adminEmail = process.env.MIGRATE_ADMIN_EMAIL || "admin@metacrm.local";

if (!existsSync(dbPath)) {
  console.error("LinkedIn DB not found:", dbPath);
  process.exit(1);
}

const source = new Database(dbPath, { readonly: true });
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!user) {
    console.error("Admin user not found:", adminEmail);
    process.exit(1);
  }

  const token = source.prepare("SELECT * FROM linkedin_tokens WHERE id = 1").get();
  if (token && !token.access_token.startsWith("enc:")) {
    const existingConn = await prisma.linkedInConnection.findUnique({ where: { userId: user.id } });
    if (!existingConn) {
      await prisma.linkedInConnection.create({
        data: {
          userId: user.id,
          accessToken: encryptToken(token.access_token),
          refreshToken: token.refresh_token ? encryptToken(token.refresh_token) : null,
          expiresAt: token.expires_at ? new Date(token.expires_at) : null,
          personUrn: token.person_urn,
          personName: token.person_name,
        },
      });
      console.log("Migrated LinkedIn connection");
    } else {
      console.log("LinkedIn connection already exists — skipped");
    }
  }

  const posts = source.prepare("SELECT * FROM post_queue").all();
  let postCount = 0;
  for (const p of posts) {
    const exists = p.source_id
      ? await prisma.linkedInPost.findFirst({ where: { userId: user.id, sourceId: p.source_id } })
      : await prisma.linkedInPost.findFirst({
          where: { userId: user.id, content: p.content, createdAt: new Date(p.created_at) },
        });
    if (exists) continue;

    await prisma.linkedInPost.create({
      data: {
        userId: user.id,
        content: p.content,
        visibility: p.visibility || "PUBLIC",
        scheduledAt: p.scheduled_at ? new Date(p.scheduled_at) : null,
        status: p.status,
        source: p.source || "manual",
        sourceId: p.source_id,
        linkedinPostUrn: p.linkedin_post_urn,
        errorMessage: p.error_message,
        publishedAt: p.published_at ? new Date(p.published_at) : null,
        createdAt: p.created_at ? new Date(p.created_at) : new Date(),
      },
    });
    postCount++;
  }
  console.log(`Migrated ${postCount} posts (${posts.length} in source)`);

  console.log("Done.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
