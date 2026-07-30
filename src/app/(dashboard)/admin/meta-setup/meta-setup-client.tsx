"use client";

import { ExternalLink, Facebook, Instagram, Wrench } from "lucide-react";
import { META_SETUP_LINKS, SUGGESTED_PAGES } from "@/lib/meta-setup";
import { invalidateAccountsCache } from "@/lib/client-cache";

export function MetaSetupClient({
  diagnosis,
  logStatus,
}: {
  diagnosis: Record<string, unknown> | null;
  logStatus?: string;
}) {
  async function connect(standard = false) {
    invalidateAccountsCache();
    const params = new URLSearchParams({ reauth: "true" });
    if (standard) params.set("standard", "true");
    const res = await fetch(`/api/meta/connect?${params}`);
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }

  const createAttempts = (diagnosis?.createAttempts as Array<{ name: string; id?: string; error?: string }>) || [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wrench className="w-6 h-6 text-[var(--primary)]" />
          Meta Setup Wizard
        </h1>
        <p className="text-[var(--muted)] mt-1">
          Create Facebook Pages manually, then connect them to the CRM
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 space-y-4">
            <h2 className="font-semibold text-yellow-300">Step 0 — Enable missing permissions (required)</h2>
            <p className="text-sm text-[var(--muted)]">
              <code className="text-xs">pages_manage_posts</code> and{" "}
              <code className="text-xs">instagram_content_publish</code> are{" "}
              <strong className="text-white">optional</strong> — they are NOT added automatically.
            </p>

            <div className="bg-[var(--background)] rounded-lg p-4 text-sm space-y-3">
              <p className="font-medium">A) Add to Use Case</p>
              <ol className="list-decimal list-inside space-y-1 text-[var(--muted)]">
                <li>
                  Open{" "}
                  <a
                    href="https://developers.facebook.com/apps/1569293914991499/use_cases/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--primary)] hover:underline"
                  >
                    App → Use cases
                  </a>
                </li>
                <li>Click <strong className="text-white">Manage everything on your Page</strong></li>
                <li>Click <strong className="text-white">Customize</strong> (or Customize use case)</li>
                <li>Go to <strong className="text-white">Permissions and features</strong></li>
                <li>
                  Find and toggle ON: <code className="text-xs">pages_manage_posts</code>
                </li>
                <li>Click <strong className="text-white">Save</strong></li>
              </ol>

              <p className="font-medium pt-2">B) Add Instagram publishing</p>
              <ol className="list-decimal list-inside space-y-1 text-[var(--muted)]">
                <li>
                  In Use cases, click <strong className="text-white">Add use cases</strong>
                </li>
                <li>
                  Add <strong className="text-white">Manage messaging &amp; content on Instagram</strong> (or
                  Instagram API)
                </li>
                <li>
                  Customize it → enable <code className="text-xs">instagram_basic</code> +{" "}
                  <code className="text-xs">instagram_content_publish</code>
                </li>
              </ol>

              <p className="font-medium pt-2">C) Add to Login Configuration</p>
              <ol className="list-decimal list-inside space-y-1 text-[var(--muted)]">
                <li>
                  Open{" "}
                  <a
                    href="https://developers.facebook.com/apps/1569293914991499/business-login/settings/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--primary)] hover:underline"
                  >
                    Facebook Login for Business → Configurations
                  </a>
                </li>
                <li>Edit configuration <code className="text-xs">2269001597267600</code></li>
                <li>
                  Under <strong className="text-white">Permissions</strong>, add{" "}
                  <code className="text-xs">pages_manage_posts</code> and{" "}
                  <code className="text-xs">instagram_content_publish</code>
                </li>
                <li>Under <strong className="text-white">Assets</strong>, include Pages + Instagram accounts</li>
                <li>Save, then <strong className="text-white">Reconnect</strong> in CRM Accounts</li>
              </ol>
            </div>
          </section>

          <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 space-y-4">
            <h2 className="font-semibold">Step 1 — Create Facebook Pages</h2>
            <p className="text-sm text-[var(--muted)]">
              Meta does not allow most apps to create Pages via API. Create these manually
              (takes ~2 minutes each):
            </p>
            <ul className="space-y-3">
              {SUGGESTED_PAGES.map((page) => (
                <li
                  key={page.name}
                  className="bg-[var(--background)] rounded-lg p-4 text-sm"
                >
                  <p className="font-medium">{page.name}</p>
                  <p className="text-[var(--muted)] mt-1">{page.about}</p>
                  <p className="text-xs text-[var(--muted)] mt-1">Category: {page.category}</p>
                </li>
              ))}
            </ul>
            <a
              href={META_SETUP_LINKS.createPage}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-[var(--primary)] hover:underline"
            >
              Open Facebook Page Creator <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </section>

          <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 space-y-3">
            <h2 className="font-semibold">Step 2 — Add Pages to Business</h2>
            <p className="text-sm text-[var(--muted)]">
              In Meta Business Suite, add each new Page to your business portfolio.
            </p>
            <a
              href={META_SETUP_LINKS.businessSuite}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-[var(--primary)] hover:underline"
            >
              Open Meta Business Suite <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </section>

          <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 space-y-3">
            <h2 className="font-semibold">Step 3 — Link Instagram (optional)</h2>
            <p className="text-sm text-[var(--muted)] flex items-start gap-2">
              <Instagram className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
              Link @arfadevelopers to your Facebook Page in Business Settings — do not log in with Instagram in the CRM.
            </p>
            <a
              href={META_SETUP_LINKS.linkInstagram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-[var(--primary)] hover:underline"
            >
              Link Instagram account <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 space-y-4">
            <h2 className="font-semibold">Step 4 — Connect to CRM</h2>
            <ul className="text-sm text-[var(--muted)] space-y-2 list-disc list-inside">
              <li>Use your <strong className="text-white">Facebook account</strong> (Muhammad Arshad)</li>
              <li>Click <strong className="text-white">Edit settings</strong> in the Meta popup</li>
              <li>Select Business → check all Pages → Save</li>
            </ul>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => connect(false)}
                className="w-full px-4 py-2.5 rounded-lg text-sm bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]"
              >
                Connect with Business Login (recommended)
              </button>
              <button
                onClick={() => connect(true)}
                className="w-full px-4 py-2.5 rounded-lg text-sm border border-[var(--border)] hover:bg-[var(--card-hover)]"
              >
                Connect with Standard Login (limited scopes)
              </button>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Facebook Groups are not supported for posting in this CRM — only Pages.
            </p>
          </section>

          {diagnosis && (
            <section className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 space-y-3 text-sm">
              <h2 className="font-semibold">Last connection diagnosis ({logStatus})</h2>
              <div className="space-y-1 text-[var(--muted)] font-mono text-xs">
                <p>Token valid: {String(diagnosis.tokenValid)}</p>
                <p>Pages found: {String(diagnosis.pagesFound)}</p>
                <p>me/accounts: {String(diagnosis.meAccountsCount)}</p>
                <p>me/assigned_pages: {String(diagnosis.assignedPagesCount)}</p>
                <p>Businesses: {String(diagnosis.businessCount)}</p>
                <p>Granular page IDs: {JSON.stringify(diagnosis.granularPageIds)}</p>
                <p>Scopes: {JSON.stringify(diagnosis.scopes)}</p>
                {Array.isArray(diagnosis.errors) && diagnosis.errors.length > 0 && (
                  <p>Errors: {JSON.stringify(diagnosis.errors)}</p>
                )}
              </div>
              {diagnosis.hint ? (
                <p className="text-yellow-400 text-xs">{String(diagnosis.hint)}</p>
              ) : null}
              {createAttempts.length > 0 && (
                <div className="pt-2 border-t border-[var(--border)]">
                  <p className="font-medium mb-2">Auto-create attempts:</p>
                  {createAttempts.map((a) => (
                    <p key={a.name} className="text-xs text-[var(--muted)]">
                      {a.name}: {a.id ? `Created ${a.id}` : a.error || "Failed"}
                    </p>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
