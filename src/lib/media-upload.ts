import "server-only";

import { prisma } from "./prisma";
import { getAppBaseUrl } from "./app-url";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function isAllowedImageType(mimeType: string) {
  return ALLOWED_TYPES.has(mimeType);
}

export function getMediaPublicUrl(mediaId: string, requestOrigin?: string) {
  return `${getAppBaseUrl(requestOrigin)}/api/media/${mediaId}`;
}

export async function saveMediaUpload(
  userId: string,
  file: { name: string; type: string; buffer: Buffer }
) {
  if (!isAllowedImageType(file.type)) {
    throw new Error("Only JPEG, PNG, WebP, and GIF images are allowed");
  }
  if (file.buffer.length > MAX_BYTES) {
    throw new Error("Image must be 5MB or smaller");
  }

  return prisma.mediaUpload.create({
    data: {
      userId,
      mimeType: file.type,
      fileName: file.name,
      data: new Uint8Array(file.buffer),
    },
  });
}

export async function getMediaUpload(id: string) {
  return prisma.mediaUpload.findUnique({ where: { id } });
}
