import { createDecipheriv, scryptSync } from "crypto";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config();

function decryptToken(encryptedText: string): string {
  const secret = process.env.TOKEN_ENCRYPTION_KEY || "default-dev-key-change-in-production!";
  const key = scryptSync(secret, "meta-crm-salt", 32);
  const [ivHex, authTagHex, encryptedHex] = encryptedText.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

const apiVersion = process.env.LINKEDIN_API_VERSION || "202601";
const p = new PrismaClient();

async function main() {
  const conn = await p.linkedInConnection.findFirst();
  if (!conn) {
    console.error("No LinkedIn connection");
    return;
  }

  const token = decryptToken(conn.accessToken);
  const author = encodeURIComponent(conn.personUrn);
  const res = await fetch(
    `https://api.linkedin.com/rest/posts?q=author&author=${author}&count=10&sortBy=LAST_MODIFIED`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "LinkedIn-Version": apiVersion,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    }
  );

  console.log("posts status:", res.status);
  const body = await res.text();
  console.log("posts body:", body.slice(0, 2000));

  if (!res.ok) {
    for (const url of [
      `https://api.linkedin.com/rest/memberCreatorPostAnalytics?q=me&queryType=IMPRESSION&aggregation=TOTAL`,
      `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(${encodeURIComponent(conn.personUrn)})&count=5`,
    ]) {
      const alt = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "LinkedIn-Version": apiVersion,
          "X-Restli-Protocol-Version": "2.0.0",
        },
      });
      console.log("alt", url, alt.status, (await alt.text()).slice(0, 500));
    }
    return;
  }

  const data = JSON.parse(body) as { elements?: Array<{ id?: string; commentary?: string }> };
  const posts = data.elements || [];
  const post = await p.linkedInPost.findFirst({ where: { userId: conn.userId } });
  if (!post || !posts[0]?.id) return;

  const urn = posts[0].id;
  await p.linkedInPost.update({
    where: { id: post.id },
    data: { linkedinPostUrn: urn, sourceId: urn },
  });
  console.log("Updated post URN to:", urn);

  const entity = urn.includes("ugcPost")
    ? `(ugc:${encodeURIComponent(urn)})`
    : `(share:${encodeURIComponent(urn)})`;

  for (const queryType of ["IMPRESSION", "COMMENT", "REACTION"] as const) {
    const analyticsRes = await fetch(
      `https://api.linkedin.com/rest/memberCreatorPostAnalytics?q=entity&entity=${entity}&queryType=${queryType}&aggregation=TOTAL`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "LinkedIn-Version": apiVersion,
          "X-Restli-Protocol-Version": "2.0.0",
        },
      }
    );
    console.log(`${queryType} status:`, analyticsRes.status, await analyticsRes.text());
  }

  const commentsRes = await fetch(
    `https://api.linkedin.com/rest/socialActions/${encodeURIComponent(urn)}/comments`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "LinkedIn-Version": apiVersion,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    }
  );
  console.log("comments status:", commentsRes.status);
  console.log("comments body:", (await commentsRes.text()).slice(0, 2000));
}

main().finally(() => p.$disconnect());
