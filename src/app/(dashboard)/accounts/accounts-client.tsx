"use client";

import { useEffect, useState } from "react";
import { Plus, Instagram, Facebook, Linkedin } from "lucide-react";
import Image from "next/image";
import type { SafeAccount } from "@/types/account";
import { invalidateAccountsCache } from "@/lib/client-cache";

export function AccountsClient({
  accounts,
  isAdmin,
  notice,
  errorCode,
  serverRuntimeConfig,
}: {
  accounts: SafeAccount[];
  isAdmin: boolean;
  notice?: { type: "success" | "error"; message: string } | null;
  errorCode?: string;
  serverRuntimeConfig?: {
    linkedInOrganizationIds: string[];
    metaExtraPageIds: string[];
    serverRequestsOrgScopes?: boolean;
  };
}) {
  const [linkedIn, setLinkedIn] = useState<{
    authenticated: boolean;
    shared: boolean;
    personName: string | null;
    email: string | null;
    organizations: Array<{ id: string; urn: string; name: string }>;
    needsOrgReconnect: boolean;
    orgReconnectMessage: string | null;
    publishTargetCount: number;
    grantedScopes: string[];
    requestedScopes: string[];
    serverRequestsOrgScopes: boolean;
    orgPostingEnabled: boolean;
    needsServerConfig: boolean;
    configuredOrganizationIds: string[];
  }>({
    authenticated: false,
    shared: false,
    personName: null,
    email: null,
    organizations: [],
    needsOrgReconnect: false,
    orgReconnectMessage: null,
    publishTargetCount: 0,
    grantedScopes: [],
    requestedScopes: [],
    serverRequestsOrgScopes: false,
    orgPostingEnabled: false,
    needsServerConfig: false,
    configuredOrganizationIds: [],
  });

  useEffect(() => {
    fetch("/api/linkedin/status")
      .then((r) => r.json())
      .then((d) =>
        setLinkedIn({
          authenticated: Boolean(d.auth?.authenticated),
          shared: Boolean(d.auth?.shared),
          personName: d.auth?.personName || d.auth?.profile?.name || null,
          email: d.auth?.profile?.email || null,
          organizations: d.auth?.organizations || [],
          needsOrgReconnect: Boolean(d.auth?.needsOrgReconnect),
          orgReconnectMessage: d.auth?.orgReconnectMessage || null,
          publishTargetCount: d.auth?.publishTargetCount ?? 0,
          grantedScopes: d.auth?.grantedScopes || [],
          requestedScopes: d.auth?.requestedScopes || d.config?.linkedin?.requestedScopes || [],
          serverRequestsOrgScopes: Boolean(
            d.auth?.serverRequestsOrgScopes ?? d.config?.linkedin?.requestsOrgScopes
          ),
          orgPostingEnabled: Boolean(d.auth?.orgPostingEnabled),
          needsServerConfig: Boolean(d.auth?.needsServerConfig),
          configuredOrganizationIds:
            d.auth?.configuredOrganizationIds ||
            d.config?.linkedin?.organizationIds ||
            serverRuntimeConfig?.linkedInOrganizationIds ||
            [],
        })
      );
  }, []);

  async function connectMeta(reauth = false, standard = false) {
    const params = new URLSearchParams();
    if (reauth) params.set("reauth", "true");
    if (standard) params.set("standard", "true");
    const qs = params.toString();
    const res = await fetch(`/api/meta/connect${qs ? `?${qs}` : ""}`);
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }

  async function disconnectLinkedIn() {
    await fetch("/api/linkedin/status", { method: "DELETE" });
    setLinkedIn({
      authenticated: false,
      shared: false,
      personName: null,
      email: null,
      organizations: [],
      needsOrgReconnect: false,
      orgReconnectMessage: null,
      publishTargetCount: 0,
      grantedScopes: [],
      requestedScopes: [],
      serverRequestsOrgScopes: false,
      orgPostingEnabled: false,
      needsServerConfig: false,
      configuredOrganizationIds: [],
    });
  }

  const showLinkedInOrgSetup =
    linkedIn.authenticated &&
    isAdmin &&
    !linkedIn.orgPostingEnabled &&
    (linkedIn.needsOrgReconnect || linkedIn.needsServerConfig || linkedIn.organizations.length > 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-[var(--muted)] mt-1">
            {isAdmin
              ? "Connect Facebook, Instagram, and LinkedIn for your team"
              : "Organization accounts connected by your admin"}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                const res = await fetch("/api/meta/sync-pages", { method: "POST" });
                const data = await res.json();
                if (res.ok) {
                  invalidateAccountsCache();
                  window.location.reload();
                } else {
                  alert(data.error || "Failed to sync pages");
                }
              }}
              className="flex items-center gap-2 border border-[var(--border)] hover:bg-[var(--card-hover)] px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Refresh pages
            </button>
            <button
              onClick={() => {
                invalidateAccountsCache();
                connectMeta(errorCode === "no_pages", false);
              }}
              className="flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Connect Meta
            </button>
          </div>
        )}
      </div>

      {notice && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg text-sm border ${
            notice.type === "success"
              ? "bg-green-500/10 border-green-500/30 text-green-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}
        >
          {notice.message}
        </div>
      )}

      <div className="mb-6 bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 text-sm">
        <h2 className="font-semibold mb-2">Where posts go when you publish</h2>
        <ul className="space-y-1.5 text-[var(--muted)]">
          {accounts.map((a) => (
            <li key={a.id}>
              <span className="text-white">Facebook:</span> {a.pageName}
              {a.instagramId ? ` · Instagram @${a.instagramUsername}` : ""}
            </li>
          ))}
          {accounts.length === 0 && (
            <li>No Meta pages connected yet — connect or refresh pages below.</li>
          )}
          {linkedIn.authenticated && linkedIn.personName && (
            <li>
              <span className="text-white">LinkedIn:</span> {linkedIn.personName} (profile)
            </li>
          )}
          {linkedIn.organizations.map((org) => (
            <li key={org.urn}>
              <span className="text-white">LinkedIn:</span> {org.name} (company page)
              {!linkedIn.orgPostingEnabled ? (
                <span className="text-yellow-400"> — permission pending</span>
              ) : (
                <span className="text-green-400"> — ready</span>
              )}
            </li>
          ))}
        </ul>
        <p className="text-xs text-yellow-400/90 mt-3">
          Facebook only allows posting to <strong>Pages</strong>, not personal profiles. If a Page
          is missing, click <strong>Refresh pages</strong>. Server env check — Meta extra Page IDs:{" "}
          {serverRuntimeConfig?.metaExtraPageIds.length
            ? serverRuntimeConfig.metaExtraPageIds.join(", ")
            : "none"}
          {" · "}
          LinkedIn org IDs:{" "}
          {serverRuntimeConfig?.linkedInOrganizationIds.length
            ? serverRuntimeConfig.linkedInOrganizationIds.join(", ")
            : "none (set LINKEDIN_ORGANIZATION_IDS=102438302 on Vercel and redeploy)"}
          {serverRuntimeConfig?.serverRequestsOrgScopes === false && (
            <span className="text-red-400"> — org scopes not enabled on server</span>
          )}
        </p>
      </div>

      {errorCode === "no_pages" && isAdmin && (
        <div className="mb-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-5 text-sm">
          <p className="font-medium text-yellow-300">No Facebook Pages found</p>
          <p className="text-[var(--muted)] mt-2">
            Create a Facebook Page in Meta Business Suite, then connect again and select your pages.
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Facebook className="w-5 h-5 text-[var(--primary)]" />
            <h2 className="font-semibold">Meta (Facebook & Instagram)</h2>
          </div>

          {accounts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[var(--muted)] mb-4">
                {isAdmin
                  ? "No Meta pages connected"
                  : "No Meta pages connected yet. Ask your admin to connect accounts."}
              </p>
              {isAdmin && (
                <button
                  onClick={() => connectMeta(false, false)}
                  className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-6 py-2.5 rounded-lg text-sm font-medium"
                >
                  Connect Meta Account
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-start gap-4 p-4 rounded-lg border border-[var(--border)]"
                >
                  {account.pagePicture ? (
                    <Image
                      src={account.pagePicture}
                      alt={account.pageName}
                      width={48}
                      height={48}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[var(--primary)]/20 flex items-center justify-center">
                      <Facebook className="w-6 h-6 text-[var(--primary)]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{account.pageName}</h3>
                    <p className="text-sm text-[var(--muted)] mt-1">Facebook Page · Connected</p>
                    {account.instagramId && (
                      <p className="text-sm text-[var(--muted)] flex items-center gap-1 mt-1">
                        <Instagram className="w-3.5 h-3.5" />@{account.instagramUsername} · Connected
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {isAdmin && (
                <p className="text-xs text-[var(--muted)] pt-2">
                  Missing a Facebook Page? Click <strong>Refresh pages</strong>. If it still does
                  not appear, add its numeric Page ID to{" "}
                  <code className="text-[var(--primary)]">META_EXTRA_PAGE_IDS</code> in Vercel env,
                  then refresh again.
                </p>
              )}
            </div>
          )}
        </section>

        <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Linkedin className="w-5 h-5 text-[#0a66c2]" />
            <h2 className="font-semibold">LinkedIn</h2>
          </div>

          {linkedIn.authenticated ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-[var(--border)]">
                <p className="font-medium">{linkedIn.personName}</p>
                {linkedIn.email && (
                  <p className="text-sm text-[var(--muted)] mt-1">{linkedIn.email}</p>
                )}
                <p className="text-sm text-[var(--success)] mt-2">
                  {linkedIn.shared ? "Connected by admin · shared with team" : "Connected"}
                </p>
              </div>
              {showLinkedInOrgSetup && (
                <div className="p-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-sm space-y-3">
                  <p className="font-medium text-yellow-300">
                    {linkedIn.needsServerConfig
                      ? "Company page env not loaded on server"
                      : "Company page posting not enabled yet"}
                  </p>
                  {(linkedIn.needsServerConfig || !linkedIn.serverRequestsOrgScopes) && (
                    <p className="text-red-300 font-medium">
                      Production is not requesting company-page scopes. In Vercel → Settings →
                      Environment Variables, add for <strong>Production</strong>:{" "}
                      <code className="text-[var(--primary)]">LINKEDIN_ORGANIZATION_IDS=102438302</code>
                      , then redeploy. Server currently sees:{" "}
                      {linkedIn.configuredOrganizationIds.length > 0
                        ? linkedIn.configuredOrganizationIds.join(", ")
                        : "none"}
                    </p>
                  )}
                  {linkedIn.serverRequestsOrgScopes && (
                    <>
                      <p className="text-[var(--muted)]">
                        Vercel env is correct. LinkedIn approved your login but did{" "}
                        <strong>not</strong> grant{" "}
                        <code className="text-[var(--primary)]">w_organization_social</code> — this
                        is controlled in the{" "}
                        <strong>LinkedIn Developer Portal</strong>, not in this CRM.
                      </p>
                      <ol className="list-decimal list-inside space-y-2 text-[var(--muted)]">
                        <li>
                          Open{" "}
                          <a
                            href="https://www.linkedin.com/developers/apps/788pjmplr6yaba/products"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#0a66c2] hover:underline"
                          >
                            your app → Products
                          </a>{" "}
                          — <strong>Community Management API</strong> or{" "}
                          <strong>Advertising API</strong> must show <strong>Approved</strong> (not
                          pending)
                        </li>
                        <li>
                          App → <strong>Settings</strong> → Associated page → link{" "}
                          <strong>Arfa Developers</strong>
                        </li>
                        <li>
                          You must be <strong>Page Admin</strong> on Arfa Developers on LinkedIn
                        </li>
                        <li>
                          Revoke at{" "}
                          <a
                            href="https://www.linkedin.com/psettings/permitted-services"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#0a66c2] hover:underline"
                          >
                            Permitted services
                          </a>
                          , then <strong>Reconnect for company pages</strong>
                        </li>
                      </ol>
                    </>
                  )}
                  <p className="text-xs text-[var(--muted)]">
                    Requested by server:{" "}
                    {linkedIn.requestedScopes.length > 0
                      ? linkedIn.requestedScopes.join(", ")
                      : "loading…"}
                    {!linkedIn.requestedScopes.includes("w_organization_social") && (
                      <span className="text-red-400"> — w_organization_social not requested</span>
                    )}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    Granted by LinkedIn:{" "}
                    {linkedIn.grantedScopes.length > 0
                      ? linkedIn.grantedScopes.join(", ")
                      : "none recorded"}
                    {!linkedIn.grantedScopes.includes("w_organization_social") && (
                      <span className="text-yellow-400"> — missing w_organization_social</span>
                    )}
                  </p>
                </div>
              )}
              {linkedIn.organizations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
                    Company pages
                  </p>
                  {linkedIn.organizations.map((org) => (
                    <div
                      key={org.urn}
                      className="p-3 rounded-lg border border-[var(--border)] text-sm flex items-center justify-between gap-2"
                    >
                      <span>{org.name}</span>
                      <span
                        className={`text-xs ${
                          linkedIn.orgPostingEnabled ? "text-green-400" : "text-yellow-400"
                        }`}
                      >
                        {linkedIn.orgPostingEnabled ? "Posts enabled" : "Permission pending"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {isAdmin && !linkedIn.shared && (
                <div className="flex gap-3 flex-wrap">
                  <a
                    href={
                      showLinkedInOrgSetup && linkedIn.serverRequestsOrgScopes
                        ? "/api/linkedin/connect?consent=1"
                        : "/api/linkedin/connect"
                    }
                    className="text-sm px-4 py-2 rounded-lg border border-[#0a66c2] text-[#0a66c2] hover:bg-[#0a66c2]/10"
                  >
                    {showLinkedInOrgSetup && linkedIn.serverRequestsOrgScopes
                      ? "Reconnect for company pages"
                      : "Reconnect"}
                  </a>
                  <button
                    onClick={disconnectLinkedIn}
                    className="text-sm px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--card-hover)]"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-[var(--muted)] mb-4">
                {isAdmin
                  ? "Connect LinkedIn to publish from Posts"
                  : "LinkedIn is not connected yet. Ask your admin to connect it."}
              </p>
              {isAdmin && (
                <>
                  <a
                    href="/api/linkedin/connect"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm bg-[#0a66c2] text-white"
                  >
                    <Linkedin className="w-4 h-4" />
                    Connect LinkedIn
                  </a>
                  <p className="text-xs text-[var(--muted)] mt-4 max-w-sm mx-auto">
                    If LinkedIn shows an error, add this redirect URL in your LinkedIn Developer app
                    under Auth → Redirect URLs:{" "}
                    <span className="text-[var(--primary)] break-all">
                      https://social-crm-five.vercel.app/api/social/linkedin/callback
                    </span>
                  </p>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
