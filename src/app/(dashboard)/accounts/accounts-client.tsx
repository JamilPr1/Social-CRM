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
}: {
  accounts: SafeAccount[];
  isAdmin: boolean;
  notice?: { type: "success" | "error"; message: string } | null;
  errorCode?: string;
}) {
  const [linkedIn, setLinkedIn] = useState<{
    authenticated: boolean;
    personName: string | null;
    email: string | null;
  }>({ authenticated: false, personName: null, email: null });

  useEffect(() => {
    fetch("/api/linkedin/status")
      .then((r) => r.json())
      .then((d) =>
        setLinkedIn({
          authenticated: Boolean(d.auth?.authenticated),
          personName: d.auth?.personName || d.auth?.profile?.name || null,
          email: d.auth?.profile?.email || null,
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
    setLinkedIn({ authenticated: false, personName: null, email: null });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-[var(--muted)] mt-1">
            Connect Facebook, Instagram, and LinkedIn
          </p>
        </div>
        {isAdmin && (
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

      {errorCode === "no_pages" && (
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
              <p className="text-[var(--muted)] mb-4">No Meta pages connected</p>
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
                <p className="text-sm text-[var(--success)] mt-2">Connected</p>
              </div>
              <div className="flex gap-3">
                <a
                  href="/api/linkedin/connect"
                  className="text-sm px-4 py-2 rounded-lg border border-[#0a66c2] text-[#0a66c2] hover:bg-[#0a66c2]/10"
                >
                  Reconnect
                </a>
                <button
                  onClick={disconnectLinkedIn}
                  className="text-sm px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--card-hover)]"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-[var(--muted)] mb-4">Connect LinkedIn to publish from Posts</p>
              <a
                href="/api/linkedin/connect"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm bg-[#0a66c2] text-white"
              >
                <Linkedin className="w-4 h-4" />
                Connect LinkedIn
              </a>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
