import { getSessionUser } from "@/lib/auth";
import { getAccessibleAccountIds } from "@/lib/accounts";
import { prisma } from "@/lib/prisma";
import { getLinkedInConnection, resolveLinkedInOwnerId } from "@/lib/linkedin-api";
import { getLinkedInDashboardStats } from "@/lib/linkedin-posts";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const accountIds = await getAccessibleAccountIds(user);
  const linkedInOwnerId = await resolveLinkedInOwnerId(user.id);
  const linkedInConn = linkedInOwnerId
    ? await getLinkedInConnection(linkedInOwnerId)
    : null;

  const [posts, comments, users, linkedInStats] = await Promise.all([    accountIds.length
      ? prisma.post.count({ where: { metaAccountId: { in: accountIds } } })
      : 0,
    accountIds.length
      ? prisma.comment.count({ where: { metaAccountId: { in: accountIds } } })
      : 0,
    user.role === "ADMIN"
      ? prisma.user.count({ where: { isActive: true } })
      : undefined,
    linkedInConn && linkedInOwnerId ? getLinkedInDashboardStats(linkedInOwnerId) : null,
  ]);
  const totalComments = comments + (linkedInStats?.comments || 0);
  const totalPosts = posts + (linkedInStats?.postCount || 0);

  const cards = [
    { label: "Connected Accounts", value: accountIds.length + (linkedInConn ? 1 : 0), icon: "link", color: "#1877f2" },
    { label: "Total Posts", value: totalPosts, icon: "file", color: "#22c55e" },
    { label: "Comments", value: totalComments, icon: "message", color: "#e1306c" },
    ...(linkedInStats
      ? [
          { label: "LinkedIn Impressions", value: linkedInStats.impressions, icon: "eye", color: "#0a66c2" },
          { label: "LinkedIn Reactions", value: linkedInStats.reactions, icon: "heart", color: "#f59e0b" },
        ]
      : []),
    ...(user.role === "ADMIN"
      ? [{ label: "Team Members", value: users || 0, icon: "users", color: "#a855f7" }]
      : []),
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Welcome back, {user.name.split(" ")[0]}</h1>
        <p className="text-[var(--muted)] mt-1">
          Overview of Meta and LinkedIn accounts and engagement
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6"
          >
            <p className="text-3xl font-bold" style={{ color: card.color }}>
              {card.value.toLocaleString()}
            </p>
            <p className="text-sm text-[var(--muted)] mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {linkedInConn && linkedInStats && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">LinkedIn Performance</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">            <Stat label="Published posts" value={linkedInStats.published} />
            <Stat label="Impressions" value={linkedInStats.impressions} />
            <Stat label="Comments" value={linkedInStats.comments} />
            <Stat label="Reshares" value={linkedInStats.reshares} />
          </div>
          {linkedInStats.impressions === 0 && (
            <p className="text-xs text-[var(--muted)] mt-4">
              Impressions and comment sync need LinkedIn Community Management API approval.
              Publishing still works — use Sync on the Posts page after approval.
            </p>
          )}        </div>
      )}

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Start</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {user.role === "ADMIN" && (
            <QuickAction
              step="1"
              title="Connect Accounts"
              description="Link Facebook Pages, Instagram, and LinkedIn"
              href="/accounts"
            />
          )}
          <QuickAction
            step={user.role === "ADMIN" ? "2" : "1"}
            title="View All Posts"
            description="Filter by Facebook, Instagram, or LinkedIn"
            href="/posts"
          />
          <QuickAction
            step={user.role === "ADMIN" ? "3" : "2"}
            title="Reply to Comments"
            description="Engage from the unified inbox"
            href="/comments"
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[var(--background)] rounded-lg p-4">
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
      <p className="text-[var(--muted)] mt-1">{label}</p>
    </div>
  );
}

function QuickAction({
  step,
  title,
  description,
  href,
}: {
  step: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="block p-4 rounded-lg border border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--card-hover)] transition-colors"
    >
      <span className="text-xs font-medium text-[var(--primary)]">Step {step}</span>
      <h3 className="font-medium mt-1">{title}</h3>
      <p className="text-sm text-[var(--muted)] mt-1">{description}</p>
    </a>
  );
}
