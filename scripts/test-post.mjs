import { PrismaClient } from "@prisma/client";
import { createDecipheriv, scryptSync } from "crypto";

function decryptToken(encryptedText) {
  const [ivHex, authTagHex, encryptedHex] = encryptedText.split(":");
  const key = scryptSync(process.env.TOKEN_ENCRYPTION_KEY || "default-dev-key-change-in-production!", "meta-crm-salt", 32);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedHex, "hex")), decipher.final()]).toString("utf8");
}

const prisma = new PrismaClient();
const GRAPH = "https://graph.facebook.com/v21.0";

const account = await prisma.metaAccount.findFirst();
if (!account) {
  console.log("No account");
  process.exit(1);
}

const token = decryptToken(account.pageAccessToken);
console.log("Page:", account.pageName, "| pageId:", account.pageId, "| IG:", account.instagramId || "none");

const postRes = await fetch(`${GRAPH}/${account.pageId}/feed`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: "CRM connectivity test", access_token: token }),
});
const postData = await postRes.json();
console.log("FB Post:", postRes.status, JSON.stringify(postData));

const igRes = await fetch(`${GRAPH}/${account.pageId}?fields=instagram_business_account{id,username}&access_token=${token}`);
console.log("IG link:", JSON.stringify(await igRes.json()));

await prisma.$disconnect();
