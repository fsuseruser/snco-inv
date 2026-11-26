import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { initials, localDayStart } from "@/lib/format";
import { NavLinks, MobileNav, UserMenu } from "@/components/Nav";
import { ToastProvider } from "@/components/Toast";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int n from investors
    where next_follow_up_at < ${localDayStart(1)} and assigned_to = ${user.id} and not do_not_call`;
  const isAdmin = user.role === "admin";
  const display = user.name || user.email;
  return (
    <ToastProvider>
      <div className="shell">
        <header className="header">
          <div className="container">
            <Link href="/" className="brand" aria-label="Home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="S&Co." />
            </Link>
            <NavLinks isAdmin={isAdmin} followUps={n} />
            <div className="spacer" />
            <UserMenu name={display} email={user.email} initials={initials(user.name, user.email)} role={user.role} />
          </div>
        </header>
        <main className="main">{children}</main>
        <footer className="footer">
          <div className="container">
            <span>© {new Date().getFullYear()} S&amp;Co.</span>
          </div>
        </footer>
        <MobileNav isAdmin={isAdmin} followUps={n} />
      </div>
    </ToastProvider>
  );
}
