import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const [accounts, linkedIn, user] = await Promise.all([
  p.metaAccount.findMany({ select: { id: true, pageName: true, instagramId: true } }),
  p.linkedInConnection.findMany({ select: { personName: true, personEmail: true, userId: true } }),
  p.user.findFirst({ select: { id: true, email: true, role: true, name: true } }),
]);
console.log(JSON.stringify({ accounts, linkedIn, user }, null, 2));
await p.$disconnect();
