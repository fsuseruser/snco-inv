import Link from "next/link";
import { Suspense } from "react";
import { X, Lock, SearchX } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listInvestors, filterOptions, PAGE_SIZE, type Filters } from "@/lib/queries";
import { aed, num, relative, initials } from "@/lib/format";
import { TIERS, TIER_HINT, VALUE_BANDS, TAGS } from "@/lib/recalc";
import { STATUS_FILTERS } from "@/lib/outcomes";
import { countryName, flag, NAME_ORIGINS } from "@/lib/classify";
import InvestorFilters, { type FilterDefs } from "@/components/InvestorFilters";
import Row from "@/components/RowLink";
import StatusPill from "@/components/StatusPill";

export const metadata = { title: "Investors" };

const FILTER_KEYS = ["origin", "country", "community", "band", "tag", "status", "owner"] as const;

function href(f: Filters, changes: Partial<Filters>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...changes })) if (v) p.set(k, String(v));
  const s = p.toString();
  return s ? `/?${s}` : "/";
}

export default async function InvestorsPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const user = await requireUser();
  const f = await searchParams;
  const [{ rows, totals, tiers, page }, opts] = await Promise.all([listInvestors(f, user), filterOptions()]);
  const allCount = Object.values(tiers).reduce((a, b) => a + b, 0);
  const pages = Math.max(1, Math.ceil(totals.n / PAGE_SIZE));

  const defs: FilterDefs = [
    {
      key: "origin", label: "Name origin", all: "Any name origin",
      options: [...NAME_ORIGINS.map((o) => ({ v: o, label: `${o} · ${num(opts.origins.find((x) => x.v === o)?.n)}` })), { v: "unknown", label: "Not recognised" }],
    },
    {
      key: "country", label: "Nationality", all: "Any nationality",
      options: [
        ...opts.countries.filter((c) => c.v).map((c) => ({ v: c.v!, label: `${flag(c.v)} ${countryName(c.v)} · ${num(c.n)}` })),
        { v: "unknown", label: "Unknown" },
      ],
    },
    { key: "community", label: "Community", all: "Any community", options: opts.communities.map((c) => ({ v: c.v, label: `${c.v} · ${num(c.n)}` })) },
    { key: "band", label: "Value", all: "Any value", options: VALUE_BANDS.map((b) => ({ v: b, label: b })) },
    { key: "tag", label: "Profile", all: "Any profile", options: TAGS.map((t) => ({ v: t, label: t })) },
    { key: "status", label: "Status", all: "Any status", options: STATUS_FILTERS.map((s) => ({ v: s.key, label: s.label })) },
    {
      key: "owner", label: "Handled by", all: "Anyone",
      options: [
        { v: "mine", label: "Handled by me" }, { v: "unassigned", label: "Not yet handled" }, { v: "assigned", label: "Handled by someone" },
        ...opts.agents.filter((a) => a.id !== user.id).map((a) => ({ v: String(a.id), label: a.name })),
      ],
    },
  ];
  const labelFor = (k: string, v: string) => defs.find((d) => d.key === k)?.options.find((o) => o.v === v)?.label.replace(/ · [\d,]+$/, "") || v;
  const activeFilters = FILTER_KEYS.filter((k) => f[k]);

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Investors</h1>
          <div className="sub num">
            {num(totals.n)} {totals.n === 1 ? "owner" : "owners"} · {num(totals.units)} units · {aed(totals.value, { short: true })} est. value
          </div>
        </div>
      </div>

      <div className="seg" style={{ marginBottom: 18 }}>
        <Link href={href(f, { tier: undefined, page: undefined })} className={!f.tier ? "on" : ""}>
          All <span className="n">{num(allCount)}</span>
        </Link>
        {TIERS.map((t) => (
          <Link key={t} href={href(f, { tier: t, page: undefined })} className={f.tier === t ? "on" : ""} title={TIER_HINT[t]}>
            {t} <span className="n">{num(tiers[t] || 0)}</span>
          </Link>
        ))}
      </div>

      <Suspense fallback={<div style={{ height: 44 }} />}>
        <InvestorFilters
          defs={defs}
          sorts={[
            { v: "value", label: "Est. value" }, { v: "units", label: "Units" }, { v: "name", label: "Name" },
            { v: "recent", label: "Last contact" }, { v: "followup", label: "Follow-up date" },
          ]}
        />
      </Suspense>

      {activeFilters.length > 0 && (
        <div className="active-filters">
          {activeFilters.map((k) => (
            <Link key={k} href={href(f, { [k]: undefined, page: undefined })}>
              {labelFor(k, f[k]!)} <X />
            </Link>
          ))}
          {activeFilters.length > 1 && (
            <Link href={href({ q: f.q, tier: f.tier, sort: f.sort }, {})} style={{ background: "var(--fill)", color: "var(--muted)" }}>Clear all</Link>
          )}
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        {rows.length === 0 ? (
          <div className="empty">
            <SearchX />
            <div className="t">No investors match</div>
            <div className="small">Try a different search or remove a filter.</div>
          </div>
        ) : (
          <>
            <div className="table-wrap inv-table">
              <table className="table">
                <thead>
                  <tr>
                    <th>Investor</th>
                    <th className="r">Units</th>
                    <th className="r">Est. value</th>
                    <th>Main community</th>
                    <th>Nationality</th>
                    <th>Status</th>
                    <th>Handled by</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <Row key={r.id} href={`/investors/${r.id}`}>
                      <td style={{ maxWidth: 340 }}>
                        <div className="inv-name">{r.name}</div>
                        <div className="inv-meta">
                          {r.ref}
                          {r.name_origin ? ` · ${r.name_origin}` : ""}
                          {r.aliases.length ? ` · ${r.aliases.length + 1} spellings` : ""}
                        </div>
                      </td>
                      <td className="r num">{r.total_units}</td>
                      <td className="r num nowrap">
                        <div className="strong">{aed(r.est_value, { short: true })}</div>
                        {r.priced_units < r.total_units && (
                          <div className="xs faint">{r.priced_units} of {r.total_units} priced</div>
                        )}
                      </td>
                      <td>
                        <div>{r.top_community || "—"}</div>
                        {r.communities > 1 && <div className="xs faint">+{r.communities - 1} more</div>}
                      </td>
                      <td className="nowrap">
                        {flag(r.nationality || r.phone_country)} {countryName(r.nationality || r.phone_country)}
                      </td>
                      <td>
                        <StatusPill status={r.status} dnc={r.do_not_call} />
                        {r.last_contact_at && <div className="xs faint" style={{ marginTop: 3 }}>{relative(r.last_contact_at)}</div>}
                      </td>
                      <td>
                        {r.assignee ? (
                          <span className="row small">
                            <span className={`avatar ${r.assigned_to === user.id ? "champ" : ""}`} style={{ width: 24, height: 24, fontSize: 10 }}>
                              {initials(r.assignee)}
                            </span>
                            {r.assigned_to === user.id ? "You" : r.assignee.split(" ")[0]}
                            {r.assigned_to !== user.id && <Lock size={12} className="faint" />}
                          </span>
                        ) : (
                          <span className="faint small">—</span>
                        )}
                      </td>
                    </Row>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="inv-cards">
              {rows.map((r) => (
                <Link key={r.id} href={`/investors/${r.id}`} className="inv-card">
                  <div className="top">
                    <div style={{ minWidth: 0 }}>
                      <div className="inv-name">{r.name}</div>
                      <div className="inv-meta">
                        {r.total_units} {r.total_units === 1 ? "unit" : "units"} · {r.top_community || "—"}
                      </div>
                    </div>
                    <div className="val">{aed(r.est_value, { short: true })}</div>
                  </div>
                  <div className="bottom">
                    <StatusPill status={r.status} dnc={r.do_not_call} />
                    <span className="xs faint">{flag(r.nationality || r.phone_country)} {r.name_origin || ""}</span>
                    {r.assignee && (
                      <span className="xs faint row" style={{ gap: 4 }}>
                        {r.assigned_to !== user.id && <Lock size={11} />}
                        {r.assigned_to === user.id ? "You" : r.assignee.split(" ")[0]}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            <div className="pager">
              <span className="num">
                {num((page - 1) * PAGE_SIZE + 1)}–{num(Math.min(page * PAGE_SIZE, totals.n))} of {num(totals.n)}
              </span>
              <div className="row">
                {page > 1 && <Link className="btn btn-secondary btn-sm" href={href(f, { page: String(page - 1) })}>Previous</Link>}
                {page < pages && <Link className="btn btn-secondary btn-sm" href={href(f, { page: String(page + 1) })}>Next</Link>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
