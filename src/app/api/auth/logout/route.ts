import { destroySession } from "@/lib/auth";
import { apiSuccess } from "@/lib/api-helpers";

export async function POST() {
  await destroySession();
  return apiSuccess({ ok: true });
}
