import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const accounts = await prisma.metaAccount.findMany({
  select: {
    pageName: true,
    pageUsername: true,
    instagramUsername: true,
    isActive: true,
    createdAt: true,
  },
});

const logs = await prisma.metaConnectionLog.findMany({
  orderBy: { createdAt: "desc" },
  take: 2,
});

console.log("CONNECTED_PAGES:", accounts.length);
for (const a of accounts) {
  console.log(`- ${a.pageName} (@${a.pageUsername || "no-username"}) IG:${a.instagramUsername || "none"}`);
}

if (logs.length) {
  console.log("\nLAST_CONNECT_ATTEMPT:");
  for (const l of logs) {
    const d = JSON.parse(l.diagnosis);
    console.log(`Status: ${l.status}`);
    console.log(`Pages found: ${d.pagesFound}, Businesses: ${d.businessCount}, Scopes: ${(d.scopes || []).join(", ")}`);
    if (d.hint) console.log(`Hint: ${d.hint}`);
  }
}

await prisma.$disconnect();
