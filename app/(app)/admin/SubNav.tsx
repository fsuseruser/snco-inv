"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/admin", "Overview"], ["/admin/activity", "Activity"], ["/admin/team", "Team"], ["/admin/access", "Sign-ins"],
  ["/admin/allocation", "Allocation"], ["/admin/templates", "WhatsApp templates"], ["/admin/import", "Import"],
] as const;

export default function SubNav() {
  const path = usePathname();
  return (
    <nav className="subnav">
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href} className={(href === "/admin" ? path === href : path.startsWith(href)) ? "on" : ""}>{label}</Link>
      ))}
    </nav>
  );
}
