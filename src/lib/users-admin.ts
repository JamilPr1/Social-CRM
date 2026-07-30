import "server-only";

import { hash } from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { encryptToken } from "./encryption";

export async function createUserManually(data: {
  email: string;
  name: string;
  password: string;
  role?: Role;
}) {
  const email = data.email.trim().toLowerCase();
  const name = data.name.trim();

  if (name.length < 2) {
    throw new Error("Name must be at least 2 characters");
  }
  if (data.password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("A user with this email already exists");
  }

  const pendingInvite = await prisma.userInvite.findFirst({
    where: { email, acceptedAt: null },
  });
  if (pendingInvite) {
    await prisma.userInvite.delete({ where: { id: pendingInvite.id } });
  }

  return prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await hash(data.password, 12),
      passwordDisplay: encryptToken(data.password),
      role: data.role || "MEMBER",
      onboardedAt: new Date(),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      onboardedAt: true,
    },
  });
}
