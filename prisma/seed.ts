import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@metacrm.local";
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existing) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: "Admin",
        passwordHash: await hash("admin123", 12),
        role: "ADMIN",
      },
    });
    console.log("Created admin user:");
    console.log("  Email: admin@metacrm.local");
    console.log("  Password: admin123");
    console.log("  Change this password after first login!");
  } else {
    console.log("Admin user already exists.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
