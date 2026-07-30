import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getLegalConfig } from "@/lib/legal-config";

function base64UrlDecode(input: string) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  return Buffer.from(padded, "base64");
}

function parseSignedRequest(signedRequest: string, secret: string) {
  const [encodedSig, payload] = signedRequest.split(".");
  if (!encodedSig || !payload) return null;

  const sig = base64UrlDecode(encodedSig);
  const data = JSON.parse(base64UrlDecode(payload).toString("utf8")) as {
    user_id?: string;
    algorithm?: string;
  };

  if (data.algorithm?.toUpperCase() !== "HMAC-SHA256") return null;

  const expected = createHmac("sha256", secret).update(payload).digest();
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;

  return data;
}

export async function POST(request: NextRequest) {
  const secret = process.env.META_APP_SECRET;
  const config = getLegalConfig();

  if (!secret) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  try {
    const form = await request.formData();
    const signedRequest = form.get("signed_request")?.toString();
    if (!signedRequest) {
      return NextResponse.json({ error: "Missing signed_request" }, { status: 400 });
    }

    const data = parseSignedRequest(signedRequest, secret);
    if (!data?.user_id) {
      return NextResponse.json({ error: "Invalid signed_request" }, { status: 400 });
    }

    const confirmationCode = `del_${data.user_id}_${Date.now()}`;

    return NextResponse.json({
      url: `${config.appUrl}/data-deletion?code=${encodeURIComponent(confirmationCode)}`,
      confirmation_code: confirmationCode,
    });
  } catch {
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}

export async function GET() {
  const config = getLegalConfig();
  return NextResponse.json({
    instructions: config.dataDeletionUrl,
    callback: `${config.appUrl}/api/data-deletion`,
  });
}
