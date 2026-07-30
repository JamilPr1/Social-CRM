"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield, X } from "lucide-react";
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
  const [assigningTo, setAssigningTo] = useState<string | null>(null);
  const [accessForm, setAccessForm] = useState({
    metaAccountId: "",
    permissions: ["VIEW", "POST"] as string[],
  });

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
        setAccessForm({ metaAccountId: "", permissions: ["VIEW", "POST"] });
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
          <h1 className="text-2xl font-bold">Team access</h1>
          <p className="text-[var(--muted)] mt-1">
            Assign Meta page permissions to team members
          </p>
        </div>
        <Link
          href="/admin/settings"
          className="text-sm text-[var(--primary)] hover:underline"
        >
          Invite new members →
        </Link>
      </div>

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
