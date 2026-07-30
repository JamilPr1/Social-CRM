import { PrismaClient } from "@prisma/client";
import { publishToAllPlatforms } from "../src/lib/publish";

async function main() {
  const p = new PrismaClient();

  const user = await p.user.findFirst({ where: { isActive: true } });
  if (!user) {
    console.error("No active user");
    process.exit(1);
  }

  const message = `CRM multi-platform test — ${new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}

Testing publish to Facebook, Instagram, and LinkedIn from Social CRM. #automation #crm`;

  const imageUrl =
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1080&q=80";

  const accounts = await p.metaAccount.findMany({ select: { id: true, pageName: true } });
  const accountIds = accounts.map((a) => a.id);

  console.log("Publishing as:", user.email);
  console.log("Meta accounts:", accounts.map((a) => a.pageName).join(", "));
  console.log("Message preview:", message.slice(0, 80) + "...");

  const results = await publishToAllPlatforms(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    {
      accountIds,
      message,
      platform: "all",
      includeLinkedIn: true,
      imageUrl,
    }
  );

  console.log("\nResults:");
  for (const r of results) {
    console.log(
      `${r.success ? "OK" : "FAIL"} | ${r.pageName} | ${r.platform}${r.error ? ` | ${r.error}` : ""}`
    );
  }

  await p.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
