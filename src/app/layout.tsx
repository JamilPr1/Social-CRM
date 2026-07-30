import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meta CRM",
  description: "Manage your Meta accounts, posts, and engagement from one place",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
