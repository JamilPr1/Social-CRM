import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import {
  getAccountWithAccess,
  getAccessibleAccountIds,
  getDecryptedToken,
  logActivity,
} from "@/lib/accounts";
import { getPageConversations, sendPageMessage } from "@/lib/meta-api";
import { conversationsCache } from "@/lib/cache";
import { syncMessagesForAccount } from "@/lib/sync";

const CONVERSATIONS_TTL = 30 * 1000; // 30 seconds

export async function GET(request: NextRequest) {
  return withAuth(async (user) => {
    const accountId = request.nextUrl.searchParams.get("accountId");
    const sync = request.nextUrl.searchParams.get("sync") === "true";
    if (!accountId) return apiError("accountId required");

    if (accountId === "all") {
      const ids = await getAccessibleAccountIds(user);
      if (ids.length === 0) return apiSuccess({ conversations: [] });

      if (sync) {
        await Promise.all(ids.map((id) => syncMessagesForAccount(id)));
      }

      const allConversations: Array<{
        accountId: string;
        pageName: string;
        id: string;
        participants?: { data: Array<{ id: string; name: string }> };
        messages?: {
          data: Array<{
            message: string;
            from: { id: string; name: string };
            created_time: string;
          }>;
        };
      }> = [];

      for (const id of ids) {
        const account = await getAccountWithAccess(user, id, "VIEW");
        if (!account) continue;

        const cacheKey = `conversations:${id}`;
        let conversations = conversationsCache.get(cacheKey) as
          | Array<{
              id: string;
              participants?: { data: Array<{ id: string; name: string }> };
              messages?: {
                data: Array<{
                  message: string;
                  from: { id: string; name: string };
                  created_time: string;
                }>;
              };
            }>
          | undefined;

        if (!conversations) {
          const token = getDecryptedToken(account);
          conversations = await getPageConversations(account.pageId, token);
          conversationsCache.set(cacheKey, conversations, CONVERSATIONS_TTL);
        }

        for (const convo of conversations ?? []) {
          allConversations.push({
            ...convo,
            accountId: id,
            pageName: account.pageName,
          });
        }
      }

      return apiSuccess({ conversations: allConversations });
    }

    const account = await getAccountWithAccess(user, accountId, "VIEW");
    if (!account) return apiError("Account not found or access denied", 403);

    const cacheKey = `conversations:${accountId}`;
    if (sync) {
      await syncMessagesForAccount(account.id);
    }

    const cached = conversationsCache.get(cacheKey);
    if (cached) {
      return apiSuccess({ conversations: cached });
    }

    const token = getDecryptedToken(account);
    const conversations = await getPageConversations(account.pageId, token);
    conversationsCache.set(cacheKey, conversations, CONVERSATIONS_TTL);

    return apiSuccess({ conversations });
  });
}

const messageSchema = z.object({
  accountId: z.string(),
  recipientId: z.string(),
  message: z.string().min(1),
});

export async function POST(request: NextRequest) {
  return withAuth(async (user) => {
    try {
      const body = await request.json();
      const data = messageSchema.parse(body);

      const account = await getAccountWithAccess(user, data.accountId, "REPLY");
      if (!account) return apiError("Account not found or no reply permission", 403);

      const token = getDecryptedToken(account);
      const result = await sendPageMessage(
        account.pageId,
        token,
        data.recipientId,
        data.message
      );

      conversationsCache.delete(`conversations:${data.accountId}`);
      logActivity(user.id, "SEND_MESSAGE", `Sent message on ${account.pageName}`);
      return apiSuccess({ message: result });
    } catch (err) {
      if (err instanceof z.ZodError) return apiError("Invalid input");
      return apiError(err instanceof Error ? err.message : "Failed to send message", 500);
    }
  });
}
