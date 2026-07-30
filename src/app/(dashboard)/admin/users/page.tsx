"use client";

import { useEffect, useState } from "react";
import { Plus, Shield, X } from "lucide-react";
import { parsePermissions } from "@/lib/utils";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  accountAccess: Array<{
    id: string;
    permissions: string;
    metaAccount: { id: string; pageName: string };
  }>;
}

interface MetaAccount {
  id: string;
  pageName: string;
}

const PERMISSIONS = ["VIEW", "POST", "REPLY", "BOOST", "MANAGE"] as const;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [accounts, setAccounts] = useState<MetaAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [assigningTo, setAssigningTo] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    name: "",
    password: "",
    role: "MEMBER",
  });
  const [accessForm, setAccessForm] = useState({
    metaAccountId: "",
    permissions: ["VIEW"] as string[],
  });
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [usersRes, accountsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/accounts"),
      ]);
      const usersData = await usersRes.json();
      const accountsData = await accountsRes.json();
      setUsers(usersData.users || []);
      setAccounts(accountsData.accounts || []);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create user");
        return;
      }
      setShowCreate(false);
      setForm({ email: "", name: "", password: "", role: "MEMBER" });
      loadData();
    } catch {
      setError("Something went wrong");
    }
  }

  async function handleAssignAccess(userId: string) {
    try {
      const res = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          metaAccountId: accessForm.metaAccountId,
          permissions: accessForm.permissions,
        }),
      });
      if (res.ok) {
        setAssigningTo(null);
        setAccessForm({ metaAccountId: "", permissions: ["VIEW"] });
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRevokeAccess(userId: string, metaAccountId: string) {
    await fetch(
      `/api/admin/access?userId=${userId}&metaAccountId=${metaAccountId}`,
      { method: "DELETE" }
    );
    loadData();
  }

  function togglePermission(perm: string) {
    setAccessForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Team Management</h1>
          <p className="text-[var(--muted)] mt-1">
            Manage users and assign account access
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-4 py-2.5 rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleCreate}
            className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 w-full max-w-lg space-y-4"
          >
            <h2 className="text-lg font-semibold">Create Team Member</h2>
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            <input
              type="text"
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm"
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm"
              required
            />
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm"
            >
              <option value="MEMBER">Member</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
            </select>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2.5 rounded-lg text-sm border border-[var(--border)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-lg text-sm bg-[var(--primary)] text-white"
              >
                Create User
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-[var(--card)] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {users.map((user) => (
            <div
              key={user.id}
              className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--primary)]/20 flex items-center justify-center font-medium text-[var(--primary)]">
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold">{user.name}</h3>
                    <p className="text-sm text-[var(--muted)]">{user.email}</p>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] capitalize">
                  <Shield className="w-3 h-3" />
                  {user.role.toLowerCase()}
                </span>
              </div>

              <div className="border-t border-[var(--border)] pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium">Account Access</p>
                  {user.role !== "ADMIN" && (
                    <button
                      onClick={() => setAssigningTo(assigningTo === user.id ? null : user.id)}
                      className="text-xs text-[var(--primary)] hover:underline"
                    >
                      + Assign Account
                    </button>
                  )}
                </div>

                {user.role === "ADMIN" ? (
                  <p className="text-sm text-[var(--muted)]">Full access to all accounts</p>
                ) : user.accountAccess.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No accounts assigned</p>
                ) : (
                  <div className="space-y-2">
                    {user.accountAccess.map((access) => (
                      <div
                        key={access.id}
                        className="flex items-center justify-between bg-[var(--background)] rounded-lg px-4 py-2.5"
                      >
                        <div>
                          <p className="text-sm font-medium">{access.metaAccount.pageName}</p>
                          <p className="text-xs text-[var(--muted)]">
                            {parsePermissions(access.permissions).join(", ")}
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            handleRevokeAccess(user.id, access.metaAccount.id)
                          }
                          className="text-[var(--muted)] hover:text-red-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {assigningTo === user.id && (
                  <div className="mt-3 p-4 bg-[var(--background)] rounded-lg space-y-3">
                    <select
                      value={accessForm.metaAccountId}
                      onChange={(e) =>
                        setAccessForm({ ...accessForm, metaAccountId: e.target.value })
                      }
                      className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Select account...</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.pageName}
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-wrap gap-2">
                      {PERMISSIONS.map((perm) => (
                        <button
                          key={perm}
                          type="button"
                          onClick={() => togglePermission(perm)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            accessForm.permissions.includes(perm)
                              ? "bg-[var(--primary)]/15 border-[var(--primary)] text-[var(--primary)]"
                              : "border-[var(--border)] text-[var(--muted)]"
                          }`}
                        >
                          {perm}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => handleAssignAccess(user.id)}
                      disabled={!accessForm.metaAccountId}
                      className="text-sm bg-[var(--primary)] text-white px-4 py-2 rounded-lg disabled:opacity-50"
                    >
                      Assign Access
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
