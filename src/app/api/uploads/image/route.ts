import { NextRequest } from "next/server";
import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { getMediaPublicUrl, saveMediaUpload } from "@/lib/media-upload";
import { getRequestOrigin } from "@/lib/app-url";

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    try {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!file || !(file instanceof File)) {
        return apiError("No image file provided");
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const upload = await saveMediaUpload(user.id, {
        name: file.name,
        type: file.type || "image/jpeg",
        buffer,
      });

      const origin = getRequestOrigin(request);
      const url = getMediaPublicUrl(upload.id, origin);

      return apiSuccess({
        id: upload.id,
        url,
        fileName: upload.fileName,
        mimeType: upload.mimeType,
      });
    } catch (err) {
      return apiError(err instanceof Error ? err.message : "Upload failed", 500);
    }
  });
}
