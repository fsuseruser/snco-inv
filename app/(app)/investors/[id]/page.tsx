import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getSetting } from "@/lib/queries";
import { aed, num, shortDate, BEDROOM_LABEL } from "@/lib/format";
import { countryName, flag, formatPhone, phoneCountry } from "@/lib/classify";
import { COUNTRIES } from "@/lib/countries";
import { PREMIUM_COMMUNITIES, TAG_HINT, TIER_HINT } from "@/lib/recalc";
import StatusPill from "@/components/StatusPill";
import ContactPanel from "./ContactPanel";
import Timeline, { type Activity } from "./Timeline";

type Investor = {
  id: number; ref: string; name: string; aliases: string[]; phones: string[]; bad_phones: string[]; phone_country: string | null;
  name_origin: string | null; nationality: string | null; total_units: number; priced_units: number; est_value: number;
  communities: number; premium_units: number; shared_units: number; max_in_project: number; top_community: string | null;
  top_project: string | null; tier: string; value_band: string; tags: string[]; status: string | null; last_contact_at: Date | null;
  next_follow_up_at: Date | null; contact_count: number; assigned_to: number | null; assigned_at: Date | null; assignee: string | null;
  do_not_call: boolean;
};
type Unit = {
  id: number; unit_code: string | null; bedrooms: number | null; est_value: number | null; owners_count: number; value_override: number | null;
  purchase_date: Date | null; purchase_price: number | null; project: string; community: string; developer: string | null;
  price_source: string | null; price_basis: string | null;
};

const PALETTE = ["#1d1d1f", "#d9ae7a", "#8e8e93", "#b98a54", "#c7c7cc", "#5b4a33", "#e8d5bb"];

function pct(a: number, b: number) {
  return b ? Math.round((a / b) * 100) : 0;
}

function countBy<T>(xs: T[], key: (x: T) => string | null) {
  const m = new Map<string, number>();
  for (const x of xs) {
    const k = key(x);
    if (k) m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function bedWord(b: number, plural: boolean) {
  return b === 0 ? (plural ? "studios" : "studio") : `${b === 5 ? "5+" : b}-bedroom ${plural ? "units" : "unit"}`;
}

function buyingPattern(inv: Investor, units: Unit[]) {
  const parts: React.ReactNode[] = [];
  const byProject = countBy(units, (u) => u.project);
  const beds = countBy(units.filter((u) => u.bedrooms !== null), (u) => String(u.bedrooms));
  const devs = countBy(units.filter((u) => u.developer && !/not stated/i.test(u.developer)), (u) => u.developer);
  if (inv.total_units === 1) {
    const u = units[0];
    parts.push(<>Owns one {u.bedrooms !== null ? bedWord(u.bedrooms, false) : "unit"} in <b>{u.project}</b>, {u.community}.</>);
  } else if (inv.max_in_project >= 3) {
    parts.push(<>Concentrated buyer: <b>{inv.max_in_project} of {inv.total_units}</b> units are in <b>{byProject[0][0]}</b>.</>);
  } else if (inv.communities >= 3) {
    parts.push(<>Spreads purchases across <b>{inv.communities} communities</b>, most in <b>{inv.top_community}</b>.</>);
  } else {
    parts.push(<>Holds <b>{inv.total_units} units</b> across {byProject.length} {byProject.length === 1 ? "project" : "projects"} in {inv.top_community}.</>);
  }
  if (inv.total_units > 1 && inv.premium_units * 2 >= inv.total_units && inv.premium_units > 0) {
    parts.push(<> Favours premium areas ({inv.premium_units} of {inv.total_units} on Saadiyat, Yas or Al Maryah).</>);
  }
  if (inv.total_units > 1 && beds.length && beds[0][1] >= 2 && beds[0][1] * 2 >= beds.reduce((a, b) => a + b[1], 0)) {
    parts.push(<> Mostly buys {bedWord(+beds[0][0], true)}.</>);
  }
  if (inv.total_units > 1 && devs.length && devs[0][1] >= 2 && devs[0][1] * 2 >= inv.total_units) {
    parts.push(<> Prefers {devs[0][0]} projects.</>);
  }
  const dated = units.filter((u) => u.purchase_date).map((u) => new Date(u.purchase_date!));
  if (dated.length) {
    dated.sort((a, b) => +a - +b);
    const y1 = dated[0].getFullYear(), y2 = dated[dated.length - 1].getFullYear();
    parts.push(<> Bought {y1 === y2 ? `in ${y1}` : `between ${y1} and ${y2}`}; latest purchase {shortDate(dated[dated.length - 1])} {y2}.</>);
  }
  if (inv.shared_units) parts.push(<> {inv.shared_units} {inv.shared_units === 1 ? "unit is" : "units are"} co-owned.</>);
  return parts;
}

export default async function InvestorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id)) notFound();

  const [inv] = await sql<Investor[]>`
    select i.*, coalesce(u.name, u.email) as assignee from investors i left join users u on u.id = i.assigned_to where i.id = ${id}`;
  if (!inv) notFound();
  if (user.role !== "admin" && inv.assigned_to !== user.id && (await getSetting("agent_scope", "all")) === "allocated") notFound();

  const [units, activities, templates, related, agents] = await Promise.all([
    sql<Unit[]>`
      select u.id, u.unit_code, u.bedrooms, u.est_value, u.owners_count, u.value_override, u.purchase_date, u.purchase_price,
             p.name as project, p.community, p.developer, p.price_source, p.price_basis
      from units u join projects p on p.id = u.project_id where u.investor_id = ${id}
      order by p.community, p.name, u.unit_code`,
    sql<Activity[]>`
      select a.id, a.type, a.outcome, a.note, a.follow_up_at, a.phone, a.template_name, a.message, a.created_at,
             coalesce(u.name, u.email) as user_name, a.user_id
      from activities a left join users u on u.id = a.user_id where a.investor_id = ${id} order by a.created_at desc limit 200`,
    sql<{ id: number; name: string; body: string }[]>`select id, name, body from templates where active order by sort, id`,
    inv.phones.length
      ? sql<{ id: number; name: string; total_units: number }[]>`
          select id, name, total_units from investors where id <> ${id} and phones && ${inv.phones} order by total_units desc limit 6`
      : Promise.resolve([]),
    user.role === "admin" ? sql<{ id: number; name: string }[]>`select id, coalesce(name, email) as name from users where active order by 2` : Promise.resolve([]),
  ]);
  const coOwners = inv.shared_units
    ? await sql<{ id: number; name: string; project: string; unit_code: string }[]>`
        select distinct o.id, o.name, p.name as project, u2.unit_code
        from units u1 join units u2 on u2.project_id = u1.project_id and u2.unit_code = u1.unit_code and u2.investor_id <> u1.investor_id
        join investors o on o.id = u2.investor_id join projects p on p.id = u1.project_id
        where u1.investor_id = ${id} limit 12`
    : [];

  const byCommunity = countBy(units, (u) => u.community);
  const byDeveloper = countBy(units, (u) => (u.developer && !/not stated/i.test(u.developer) ? u.developer : null));
  const bedsKnown = units.filter((u) => u.bedrooms !== null);
  const byBeds = countBy(bedsKnown, (u) => BEDROOM_LABEL[u.bedrooms!]);
  const groups = new Map<string, Unit[]>();
  for (const u of units) (groups.get(u.project) || groups.set(u.project, []).get(u.project)!).push(u);
  const groupList = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  const avg = inv.priced_units ? inv.est_value / inv.priced_units : 0;
  const nationality = inv.nationality || inv.phone_country;

  return (
    <div className="container">
      <Link href="/" className="back"><ChevronLeft />Investors</Link>

      <div className="port-head">
        <h1>{inv.name}</h1>
        <div className="meta">
          <span>{inv.ref}</span>
          <StatusPill status={inv.status} dnc={inv.do_not_call} />
          <span>{flag(nationality)} {countryName(nationality)}{inv.nationality ? "" : nationality ? " (by phone)" : ""}</span>
          {inv.name_origin && <span>{inv.name_origin} name</span>}
        </div>
        {inv.aliases.length > 0 && (
          <div className="small faint" style={{ marginTop: 8 }}>Also listed as {inv.aliases.join(" · ")}</div>
        )}
        <div className="chips" style={{ marginTop: 14 }}>
          <span className="tag champ" title={TIER_HINT[inv.tier]}>{inv.tier}</span>
          <span className="tag">{inv.value_band}</span>
          {inv.tags.map((t) => <span key={t} className="tag" title={TAG_HINT[t]}>{t}</span>)}
        </div>
      </div>

      <div className="port-grid">
        <div className="stack" style={{ gap: 28 }}>
          <div className="grid grid-4">
            <div className="stat hero">
              <div className="k">Estimated value</div>
              <div className="v">{aed(inv.est_value, { short: true })}</div>
              <div className="d">{inv.priced_units} of {inv.total_units} units priced</div>
            </div>
            <div className="stat"><div className="k">Units</div><div className="v">{inv.total_units}</div><div className="d">{groups.size} {groups.size === 1 ? "project" : "projects"}</div></div>
            <div className="stat"><div className="k">Communities</div><div className="v">{inv.communities}</div><div className="d">{inv.premium_units} in premium areas</div></div>
            <div className="stat"><div className="k">Avg. unit value</div><div className="v">{aed(avg, { short: true })}</div><div className="d">priced units only</div></div>
          </div>

          <section>
            <h2 className="section">Buying pattern</h2>
            <div className="pattern">{buyingPattern(inv, units).map((p, i) => <span key={i}>{p}</span>)}</div>
            <div className="grid grid-2" style={{ marginTop: 16 }}>
              <div className="card pad">
                <h3 className="section">By community</h3>
                <div className="bars">
                  {byCommunity.slice(0, 6).map(([k, n], i) => (
                    <div key={k} className="bar-row">
                      <div className="top"><span>{k}{PREMIUM_COMMUNITIES.includes(k) ? " ·" : ""}{PREMIUM_COMMUNITIES.includes(k) && <span className="faint"> premium</span>}</span><span>{n} · {pct(n, inv.total_units)}%</span></div>
                      <div className={`bar ${i === 0 ? "champ" : ""}`}><i style={{ width: `${pct(n, byCommunity[0][1])}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card pad">
                <h3 className="section">Unit types</h3>
                {byBeds.length ? (
                  <>
                    <div className="stackbar">
                      {byBeds.map(([k, n], i) => <i key={k} style={{ width: `${pct(n, bedsKnown.length)}%`, background: PALETTE[i % PALETTE.length] }} title={`${k}: ${n}`} />)}
                    </div>
                    <div className="legend">
                      {byBeds.map(([k, n], i) => <span key={k}><i style={{ background: PALETTE[i % PALETTE.length] }} />{k} · {n}</span>)}
                    </div>
                    {bedsKnown.length < units.length && <div className="xs faint" style={{ marginTop: 10 }}>Type unknown for {units.length - bedsKnown.length} of {units.length} units</div>}
                  </>
                ) : (
                  <div className="small faint">Unit types aren&apos;t recorded for this investor.</div>
                )}
                {byDeveloper.length > 0 && <h3 className="section" style={{ marginTop: 22 }}>Developers</h3>}
                <div className="bars">
                  {byDeveloper.slice(0, 4).map(([k, n]) => (
                    <div key={k} className="bar-row">
                      <div className="top"><span>{k}</span><span>{n}</span></div>
                      <div className="bar"><i style={{ width: `${pct(n, byDeveloper[0][1])}%`, background: "#8e8e93" }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="row" style={{ marginBottom: 6 }}>
              <h2 className="section" style={{ margin: 0 }}>Properties</h2>
              <div className="spacer" />
              <span className="small faint num">{num(inv.total_units)} units</span>
            </div>
            {groupList.map(([project, us], gi) => {
              const val = us.reduce((a, u) => a + (u.est_value ? u.est_value / u.owners_count : 0), 0);
              return (
                <details key={project} className="unit-group" open={gi < 3 || groupList.length <= 4}>
                  <summary>
                    <ChevronRight className="chev" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="strong">{project}</div>
                      <div className="xs faint">{us[0].community}{us[0].developer && !/not stated/i.test(us[0].developer) ? ` · ${us[0].developer}` : ""}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="num strong">{val ? aed(val, { short: true }) : "Not priced"}</div>
                      <div className="xs faint">{us.length} {us.length === 1 ? "unit" : "units"}</div>
                    </div>
                  </summary>
                  <div className="units">
                    {us.map((u) => (
                      <div key={u.id} className="unit-line">
                        <div>
                          <span className="num">{u.unit_code || "Unit number not recorded"}</span>
                          {u.owners_count > 1 && <span className="pill champ plain" style={{ marginLeft: 8, height: 20 }}>Co-owned · 1/{u.owners_count}</span>}
                          {u.purchase_date && <div className="xs faint">Bought {shortDate(u.purchase_date)} {new Date(u.purchase_date).getFullYear()}{u.purchase_price ? ` for ${aed(u.purchase_price, { short: true })}` : ""}</div>}
                        </div>
                        <div className="bed small muted">{u.bedrooms !== null ? BEDROOM_LABEL[u.bedrooms] : "—"}</div>
                        <div className="r num small" style={{ textAlign: "right" }} title={u.value_override ? "Value entered manually" : u.price_basis ? `${u.price_source}: ${u.price_basis}` : "No price benchmark for this project yet"}>
                          {u.est_value ? aed(u.est_value / u.owners_count, { short: true }) : <span className="faint">Not priced</span>}
                          {u.est_value && u.bedrooms === null && !u.value_override ? <div className="xs faint">project typical</div> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
            <div className="row xs faint" style={{ marginTop: 14, alignItems: "flex-start" }}>
              <Info size={14} style={{ flex: "none", marginTop: 1 }} />
              <span>Estimates use each project&apos;s average asking price for the unit type (Property Finder / Bayut benchmarks), or the project&apos;s typical price when the type is unknown. Co-owned units are split between owners. Units without a benchmark are not counted.</span>
            </div>
          </section>

          {(coOwners.length > 0 || related.length > 0) && (
            <section>
              <h2 className="section">Connections</h2>
              <div className="card">
                {coOwners.map((c) => (
                  <Link key={`${c.id}-${c.unit_code}`} href={`/investors/${c.id}`} className="feed-item" style={{ padding: "12px 18px", gridTemplateColumns: "1fr auto" }}>
                    <div><div className="strong">{c.name}</div><div className="xs faint">Co-owns {c.project} {c.unit_code}</div></div>
                    <ChevronRight size={16} className="faint" />
                  </Link>
                ))}
                {related.map((r) => (
                  <Link key={r.id} href={`/investors/${r.id}`} className="feed-item" style={{ padding: "12px 18px", gridTemplateColumns: "1fr auto" }}>
                    <div><div className="strong">{r.name}</div><div className="xs faint">Shares a phone number · {r.total_units} {r.total_units === 1 ? "unit" : "units"}</div></div>
                    <ChevronRight size={16} className="faint" />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="port-side">
          <ContactPanel
            investor={{
              id: inv.id, name: inv.name, phones: inv.phones.map((p) => ({ e164: p, label: formatPhone(p), country: phoneCountry(p) })),
              badPhones: inv.bad_phones, doNotCall: inv.do_not_call, assignedTo: inv.assigned_to, assignee: inv.assignee,
              assignedAt: inv.assigned_at ? inv.assigned_at.toISOString() : null, topProject: inv.top_project, topCommunity: inv.top_community,
              units: inv.total_units, nationality: inv.nationality, nextFollowUp: inv.next_follow_up_at ? inv.next_follow_up_at.toISOString() : null,
            }}
            me={{ id: user.id, name: user.name || "", phone: user.phone, isAdmin: user.role === "admin" }}
            templates={templates}
            agents={agents}
            countries={COUNTRIES}
          />
          <div className="card journey">
            <div className="card-head"><h2>Journey</h2><div className="spacer" /><span className="xs faint">{activities.length ? `${activities.length} ${activities.length === 1 ? "entry" : "entries"}` : ""}</span></div>
            <div className="card-body"><Timeline items={activities} /></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
