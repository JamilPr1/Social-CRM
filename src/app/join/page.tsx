"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<{
    email: string;
    name: string | null;
    invitedBy: string;
    status: string;
  } | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Missing invite link. Ask your admin for a new invitation.");
      setLoading(false);
      return;
    }

    fetch(`/api/auth/invite?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.email) {
          setError(data.error || "Invite not found");
          return;
        }
        if (data.status !== "pending") {
          setError(
            data.status === "expired"
              ? "This invite has expired. Ask your admin for a new one."
              : "This invite was already used. Sign in instead."
          );
          return;
        }
        setInvite(data);
        setName(data.name || "");
      })
      .catch(() => setError("Could not load invite"))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create account");
        return;
      }
      router.push("/posts");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 space-y-5"
    >
      {loading && (
        <p className="text-sm text-[var(--muted)] text-center">Loading invite...</p>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
          {error.includes("Sign in") && (
            <Link href="/login" className="block mt-2 text-[var(--primary)] hover:underline">
              Go to sign in
            </Link>
          )}
        </div>
      )}

      {invite && !loading && (
        <>
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={invite.email}
              readOnly
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3 text-[var(--muted)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Your name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3 focus:outline-none focus:border-[var(--primary)]"
              placeholder="Jane Smith"
              required
              minLength={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3 focus:outline-none focus:border-[var(--primary)]"
              placeholder="At least 6 characters"
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3 focus:outline-none focus:border-[var(--primary)]"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium py-3 rounded-lg disabled:opacity-50"
          >
            {submitting ? "Creating account..." : "Create account & sign in"}
          </button>
        </>
      )}
    </form>
  );
}

export default function JoinPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Join Social CRM</h1>
          <p className="text-[var(--muted)] mt-2">Set your password to get started</p>
        </div>

        <Suspense
          fallback={
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 text-center text-sm text-[var(--muted)]">
              Loading invite...
            </div>
          }
        >
          <JoinForm />
        </Suspense>

        <p className="text-center text-sm text-[var(--muted)] mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--primary)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
