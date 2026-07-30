import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ADMIN_EMAIL = "aarfa.developers@gmail.com";
const LEGACY_ADMIN_EMAIL = "admin@metacrm.local";

async function main() {
  const legacy = await prisma.user.findUnique({ where: { email: LEGACY_ADMIN_EMAIL } });
  if (legacy) {
    const conflict = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
    if (conflict && conflict.id !== legacy.id) {
      console.log("Cannot migrate admin email — target email already in use.");
      return;
    }
    await prisma.user.update({
      where: { id: legacy.id },
      data: { email: ADMIN_EMAIL, name: "Arfa Admin" },
    });
    console.log(`Migrated admin email to ${ADMIN_EMAIL}`);
    console.log("  Password unchanged from previous admin account.");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        name: "Arfa Admin",
        passwordHash: await hash("admin123", 12),
        role: "ADMIN",
        onboardedAt: new Date(),
      },
    });
    console.log("Created admin user:");
    console.log(`  Email: ${ADMIN_EMAIL}`);
    console.log("  Password: admin123");
    console.log("  Change this password after first login!");
  } else {
    console.log(`Admin user already exists: ${ADMIN_EMAIL}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
