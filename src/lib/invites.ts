import "server-only";

import { hash } from "bcryptjs";
import { prisma } from "./prisma";
import { encryptToken, decryptToken } from "./encryption";
import { getAppBaseUrl } from "./app-url";
import type { Role } from "@prisma/client";

const INVITE_TTL_DAYS = 7;

export function getInviteJoinUrl(token: string, requestOrigin?: string) {
  return `${getAppBaseUrl(requestOrigin)}/join?token=${encodeURIComponent(token)}`;
}

export async function createUserInvite(
  invitedById: string,
  data: { email: string; name?: string; role?: Role },
  requestOrigin?: string
) {
  const email = data.email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error("A user with this email already exists");
  }

  const existingInvite = await prisma.userInvite.findUnique({ where: { email } });
  if (existingInvite && !existingInvite.acceptedAt) {
    throw new Error("An invite is already pending for this email");
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  if (existingInvite?.acceptedAt) {
    await prisma.userInvite.delete({ where: { id: existingInvite.id } });
  }

  const invite = await prisma.userInvite.create({
    data: {
      email,
      name: data.name?.trim() || null,
      token,
      role: data.role || "MEMBER",
      invitedById,
      expiresAt,
    },
    include: {
      invitedBy: { select: { name: true, email: true } },
    },
  });

  return {
    invite,
    joinUrl: getInviteJoinUrl(token, requestOrigin),
  };
}

export async function getInviteByToken(token: string) {
  const invite = await prisma.userInvite.findUnique({
    where: { token },
    include: {
      invitedBy: { select: { name: true } },
    },
  });

  if (!invite) return null;
  if (invite.acceptedAt) return { invite, status: "accepted" as const };
  if (invite.expiresAt < new Date()) return { invite, status: "expired" as const };
  return { invite, status: "pending" as const };
}

export async function acceptUserInvite(input: {
  token: string;
  name: string;
  password: string;
}) {
  const result = await getInviteByToken(input.token);
  if (!result || result.status !== "pending") {
    throw new Error("Invite is invalid or has expired");
  }

  const { invite } = result;
  const name = input.name.trim();
  if (name.length < 2) {
    throw new Error("Name must be at least 2 characters");
  }
  if (input.password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existingUser) {
    throw new Error("This email is already registered");
  }

  const passwordHash = await hash(input.password, 12);
  const passwordDisplay = encryptToken(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: invite.email,
        name: invite.name || name,
        passwordHash,
        passwordDisplay,
        role: invite.role,
        onboardedAt: new Date(),
      },
    });

    await tx.userInvite.update({
      where: { id: invite.id },
      data: {
        acceptedAt: new Date(),
        acceptedUserId: created.id,
      },
    });

    return created;
  });

  return user;
}

export function decryptPasswordDisplay(encrypted: string | null | undefined) {
  if (!encrypted) return null;
  try {
    return decryptToken(encrypted);
  } catch {
    return null;
  }
}

export async function listInvitesForAdmin() {
  return prisma.userInvite.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      invitedBy: { select: { name: true, email: true } },
      acceptedUser: {
        select: {
          id: true,
          name: true,
          email: true,
          onboardedAt: true,
          passwordDisplay: true,
        },
      },
    },
  });
}
