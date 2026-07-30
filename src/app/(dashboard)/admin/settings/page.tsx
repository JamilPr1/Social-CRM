"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Mail, Settings, Shield, Trash2, Users } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface TeamUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  onboardedAt: string | null;
  createdAt: string;
  passwordDisplay: string | null;
}

interface Invite {
  id: string;
  email: string;
  name: string | null;
  role: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export default function AdminSettingsPage() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastJoinUrl, setLastJoinUrl] = useState("");
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({ email: "", name: "", role: "MEMBER" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const res = await fetch("/api/admin/invites");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load settings");
        return;
      }
      setUsers(data.users || []);
      setInvites(data.invites || []);
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLastJoinUrl("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send invite");
        return;
      }
      setSuccess(`Invite sent to ${data.invite.email}`);
      setLastJoinUrl(data.invite.joinUrl);
      setForm({ email: "", name: "", role: "MEMBER" });
      loadData();
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function revokeInvite(id: string) {
    await fetch(`/api/admin/invites?id=${id}`, { method: "DELETE" });
    loadData();
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    setSuccess("Copied to clipboard");
    setTimeout(() => setSuccess(""), 2000);
  }

  const pendingInvites = invites.filter((i) => !i.acceptedAt);

  if (loading) {
    return <p className="text-[var(--muted)]">Loading settings...</p>;
  }

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-6 h-6 text-[var(--primary)]" />
          <h1 className="text-2xl font-bold">Team Settings</h1>
        </div>
        <p className="text-[var(--muted)] text-sm">
          Invite team members by email. Only invited users can join and set their password.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm">
          {success}
        </div>
      )}

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-[var(--primary)]" />
          <h2 className="font-semibold">Invite team member</h2>
        </div>

        <form onSubmit={handleInvite} className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm"
              placeholder="teammate@company.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Name (optional)</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm"
              placeholder="Jane Smith"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm"
            >
              <option value="MEMBER">Member — can post & reply</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin — full access</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[var(--primary)] text-white text-sm disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Send invite"}
            </button>
          </div>
        </form>

        {lastJoinUrl && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 space-y-2">
            <p className="text-sm font-medium">Share this join link with your teammate:</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={lastJoinUrl}
                className="flex-1 text-xs bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2"
              />
              <button
                type="button"
                onClick={() => copyText(lastJoinUrl)}
                className="px-3 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--card-hover)]"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[var(--muted)]">Link expires in 7 days.</p>
          </div>
        )}
      </div>

      {pendingInvites.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 space-y-4">
          <h2 className="font-semibold">Pending invites</h2>
          <div className="space-y-2">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-[var(--border)]"
              >
                <div>
                  <p className="text-sm font-medium">{invite.email}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {invite.role} · expires {formatDate(invite.expiresAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revokeInvite(invite.id)}
                  className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                  title="Revoke invite"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--primary)]" />
            <h2 className="font-semibold">Team members</h2>
          </div>
          <Link
            href="/admin/users"
            className="text-sm text-[var(--primary)] hover:underline flex items-center gap-1"
          >
            <Shield className="w-3.5 h-3.5" />
            Manage page access
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--muted)] border-b border-[var(--border)]">
                <th className="pb-3 pr-4 font-medium">Name</th>
                <th className="pb-3 pr-4 font-medium">Email</th>
                <th className="pb-3 pr-4 font-medium">Role</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 font-medium">Password</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-[var(--border)]/50">
                  <td className="py-3 pr-4">{user.name}</td>
                  <td className="py-3 pr-4 text-[var(--muted)]">{user.email}</td>
                  <td className="py-3 pr-4 capitalize">{user.role.toLowerCase()}</td>
                  <td className="py-3 pr-4">
                    {user.onboardedAt ? (
                      <span className="text-green-400 text-xs">Onboarded</span>
                    ) : (
                      <span className="text-yellow-400 text-xs">Legacy account</span>
                    )}
                  </td>
                  <td className="py-3">
                    {user.passwordDisplay ? (
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-[var(--background)] px-2 py-1 rounded">
                          {showPasswords[user.id]
                            ? user.passwordDisplay
                            : "••••••••"}
                        </code>
                        <button
                          type="button"
                          onClick={() =>
                            setShowPasswords((prev) => ({
                              ...prev,
                              [user.id]: !prev[user.id],
                            }))
                          }
                          className="text-xs text-[var(--primary)] hover:underline"
                        >
                          {showPasswords[user.id] ? "Hide" : "Show"}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyText(user.passwordDisplay!)}
                          className="text-xs text-[var(--muted)] hover:text-white"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[var(--muted)]">
          Passwords are shown for members who joined via invite. Assign Meta page access under{" "}
          <Link href="/admin/users" className="text-[var(--primary)] hover:underline">
            Team access
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
