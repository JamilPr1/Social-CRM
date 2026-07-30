import { withAuth, apiSuccess } from "@/lib/api-helpers";

export async function GET() {
  return withAuth(async (user) => apiSuccess({ user }));
}
