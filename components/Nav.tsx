"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Users, CalendarClock, LayoutGrid, LogOut, UserRound } from "lucide-react";
import { signOut } from "@/app/actions-auth";

type Props = { isAdmin: boolean; followUps: number };

function useActive() {
  const path = usePathname();
  return (href: string) =>
    href === "/" ? path === "/" || path.startsWith("/investors") : path === href || path.startsWith(href + "/");
}

export function NavLinks({ isAdmin, followUps }: Props) {
  const active = useActive();
  return (
    <nav className="nav">
      <Link href="/" className={active("/") ? "active" : ""}>Investors</Link>
      <Link href="/follow-ups" className={active("/follow-ups") ? "active" : ""}>
        Follow-ups{followUps > 0 && <span className="count">{followUps}</span>}
      </Link>
      {isAdmin && <Link href="/admin" className={active("/admin") ? "active" : ""}>Admin</Link>}
    </nav>
  );
}

export function MobileNav({ isAdmin, followUps }: Props) {
  const active = useActive();
  return (
    <nav className="mobile-nav">
      <Link href="/" className={active("/") ? "active" : ""}><Users size={22} strokeWidth={1.6} />Investors</Link>
      <Link href="/follow-ups" className={active("/follow-ups") ? "active" : ""}>
        <CalendarClock size={22} strokeWidth={1.6} />Follow-ups{followUps > 0 ? ` (${followUps})` : ""}
      </Link>
      {isAdmin && <Link href="/admin" className={active("/admin") ? "active" : ""}><LayoutGrid size={22} strokeWidth={1.6} />Admin</Link>}
      <Link href="/profile" className={active("/profile") ? "active" : ""}><UserRound size={22} strokeWidth={1.6} />Profile</Link>
    </nav>
  );
}

export function UserMenu({ name, email, initials, role }: { name: string; email: string; initials: string; role: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="user-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <span className="nm">{name}</span>
        <span className="avatar">{initials}</span>
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="who">
            <div className="strong">{name}</div>
            <div className="small muted">{email}</div>
            <div className="xs faint" style={{ marginTop: 4, textTransform: "capitalize" }}>{role === "agent" ? "Caller" : "Admin"}</div>
          </div>
          <Link href="/profile" onClick={() => setOpen(false)}><UserRound />Profile & password</Link>
          <form action={signOut}><button type="submit"><LogOut />Sign out</button></form>
        </div>
      )}
    </div>
  );
}
