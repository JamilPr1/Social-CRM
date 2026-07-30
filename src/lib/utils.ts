import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

export function parsePermissions(permissions: string): string[] {
  try {
    const parsed = JSON.parse(permissions);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function hasPermission(
  permissions: string[],
  required: "VIEW" | "POST" | "REPLY" | "BOOST" | "MANAGE"
): boolean {
  if (permissions.includes("MANAGE")) return true;
  if (required === "VIEW") return permissions.length > 0;
  return permissions.includes(required);
}
