import type { Role } from "@prisma/client";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export function requireRole(user: SessionUser, roles: Role[]) {
  if (!roles.includes(user.role)) {
    throw new Error("Forbidden");
  }
}
