import Link from "next/link";

export function LegalLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <Link href="/login" className="font-semibold text-[var(--primary)] hover:underline">
            Arfa CRM
          </Link>
          <nav className="flex gap-4 text-sm text-[var(--muted)]">
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
            <Link href="/data-deletion" className="hover:text-white">
              Data Deletion
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-2">{title}</h1>
        <article className="prose-legal mt-8 space-y-6 text-sm leading-relaxed text-[var(--muted)]">
          {children}
        </article>
      </main>

      <footer className="border-t border-[var(--border)] mt-16">
        <div className="max-w-3xl mx-auto px-6 py-6 text-xs text-[var(--muted)] flex flex-wrap gap-4">
          <Link href="/privacy" className="hover:text-white">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-white">
            Terms of Service
          </Link>
          <Link href="/data-deletion" className="hover:text-white">
            Data Deletion
          </Link>
          <Link href="/login" className="hover:text-white">
            Sign In
          </Link>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
