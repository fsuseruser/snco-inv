"use client";
import { useRouter } from "next/navigation";

/** A table row that opens a page on click (and supports cmd/ctrl-click for a new tab). */
export default function Row({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <tr
      className="click"
      tabIndex={0}
      onMouseEnter={() => router.prefetch(href)}
      onClick={(e) => (e.metaKey || e.ctrlKey ? window.open(href, "_blank") : router.push(href))}
      onKeyDown={(e) => e.key === "Enter" && router.push(href)}
    >
      {children}
    </tr>
  );
}
