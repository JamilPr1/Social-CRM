import { withAuth, apiSuccess } from "@/lib/api-helpers";
import { getAccessibleAccountIds } from "@/lib/accounts";
import { prisma } from "@/lib/prisma";

export async function GET() {
  return withAuth(async (user) => {
    const accountIds = await getAccessibleAccountIds(user);

    const [posts, comments, users] = await Promise.all([
      accountIds.length
        ? prisma.post.count({ where: { metaAccountId: { in: accountIds } } })
        : Promise.resolve(0),
      accountIds.length
        ? prisma.comment.count({ where: { metaAccountId: { in: accountIds } } })
        : Promise.resolve(0),
      user.role === "ADMIN"
        ? prisma.user.count({ where: { isActive: true } })
        : Promise.resolve(undefined),
    ]);

    return apiSuccess({
      stats: {
        accounts: accountIds.length,
        posts,
        comments,
        users,
      },
      user: { name: user.name, role: user.role },
    });
  });
}
