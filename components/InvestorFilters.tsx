"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search, SlidersHorizontal, Loader2 } from "lucide-react";

type Opt = { v: string; label: string };
export type FilterDefs = { key: string; label: string; options: Opt[]; all: string }[];

export default function InvestorFilters({ defs, sorts }: { defs: FilterDefs; sorts: Opt[] }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.get("q") || "");
  const active = defs.filter((d) => params.get(d.key)).length;
  const [open, setOpen] = useState(active > 0);
  const first = useRef(true);

  const push = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) v ? next.set(k, v) : next.delete(k);
    next.delete("page");
    start(() => router.replace(`${path}?${next.toString()}`, { scroll: false }));
  };

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => push({ q: q.trim() }), 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => setQ(params.get("q") || ""), [params]);

  return (
    <div>
      <div className="toolbar">
        <div className="search">
          {pending ? <Loader2 className="spin" /> : <Search />}
          <input className="input" type="search" placeholder="Search name, phone or ref" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search investors" />
        </div>
        <button className={`btn btn-secondary ${open ? "on" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <SlidersHorizontal />Filters{active > 0 && <span className="filter-count">{active}</span>}
        </button>
        <div className="spacer" />
        <label className="row small muted">
          <span className="nowrap">Sort by</span>
          <select className="select sm" style={{ width: "auto" }} value={params.get("sort") || "value"} onChange={(e) => push({ sort: e.target.value === "value" ? "" : e.target.value })}>
            {sorts.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
          </select>
        </label>
      </div>
      {open && (
        <div className="filters">
          {defs.map((d) => (
            <select key={d.key} className="select sm" value={params.get(d.key) || ""} onChange={(e) => push({ [d.key]: e.target.value })} aria-label={d.label}>
              <option value="">{d.all}</option>
              {d.options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          ))}
        </div>
      )}
    </div>
  );
}
