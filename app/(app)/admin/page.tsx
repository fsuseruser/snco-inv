import Link from "next/link";
import { Download, Phone, MessageCircle, StickyNote, UserCheck } from "lucide-react";
import { sql } from "@/lib/db";
import { aed, num, relative, localDayStart, initials, dayKey, shortDate } from "@/lib/format";
import { OUTCOMES, OUTCOME_LABEL, OUTCOME_TONE } from "@/lib/outcomes";
import { TIERS } from "@/lib/recalc";

export const metadata = { title: "Admin" };

const RANGES = { today: { label: "Today", days: 0 }, "7d": { label: "7 days", days: 6 }, "30d": { label: "30 days", days: 29 } } as const;
const TONE_COLOR: Record<string, string> = { grey: "#c7c7cc", amber: "#e0a100", green: "#2b7a4b", champ: "#d9ae7a", red: "#b3261e", dark: "#1d1d1f" };

export default async function AdminOverview({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: r } = await searchParams;
  const range = (r && r in RANGES ? r : "today") as keyof typeof RANGES;
  const from = localDayStart(-RANGES[range].days);
  const online = new Date(Date.now() - 10 * 60 * 1000);

  const [[k], agents, outcomes, feed, coverage, daily, [totals]] = await Promise.all([
    sql<{ calls: number; wa: number; reached: number; interested: number; meetings: number; overdue: number }[]>`
      select
        count(*) filter (where type = 'call')::int calls,
        count(*) filter (where type = 'whatsapp')::int wa,
        count(distinct investor_id) filter (where type in ('call','whatsapp'))::int reached,
        count(*) filter (where outcome = 'interested')::int interested,
        count(*) filter (where outcome = 'meeting')::int meetings,
        (select count(*)::int from investors where next_follow_up_at < ${localDayStart(0)} and not do_not_call) overdue
      from activities where created_at >= ${from}`,
    sql<{ id: number; name: string; email: string; role: string; last_seen_at: Date | null; last_login_at: Date | null; calls: number; wa: number; positive: number; handled: number; last_act: Date | null }[]>`
      select u.id, coalesce(u.name, u.email) name, u.email, u.role, u.last_seen_at, u.last_login_at,
        count(a.id) filter (where a.type = 'call')::int calls,
        count(a.id) filter (where a.type = 'whatsapp')::int wa,
        count(a.id) filter (where a.outcome in ('interested','meeting'))::int positive,
        (select count(*)::int from investors i where i.assigned_to = u.id) handled,
        (select max(created_at) from activities x where x.user_id = u.id) last_act
      from users u left join activities a on a.user_id = u.id and a.created_at >= ${from}
      where u.active group by u.id order by calls desc, wa desc, name`,
    sql<{ outcome: string; n: number }[]>`
      select outcome, count(*)::int n from activities where type = 'call' and created_at >= ${from} group by 1 order by 2 desc`,
    sql<{ id: number; type: string; outcome: string | null; note: string | null; template_name: string | null; created_at: Date; user_name: string; investor_id: number; investor: string }[]>`
      select a.id, a.type, a.outcome, a.note, a.template_name, a.created_at, coalesce(u.name, u.email) user_name, i.id investor_id, i.name investor
      from activities a join investors i on i.id = a.investor_id left join users u on u.id = a.user_id
      where a.type in ('call','whatsapp','note') order by a.created_at desc limit 12`,
    sql<{ tier: string; total: number; contacted: number; handled: number }[]>`
      select tier, count(*)::int total, count(*) filter (where contact_count > 0)::int contacted, count(*) filter (where assigned_to is not null)::int handled
      from investors group by tier`,
    range === "today" ? Promise.resolve([]) : sql<{ created_at: Date; type: string }[]>`
      select created_at, type from activities where created_at >= ${from} and type in ('call','whatsapp')`,
    sql<{ investors: number; contacted: number; value: number }[]>`
      select count(*)::int investors, count(*) filter (where contact_count > 0)::int contacted,
             coalesce(sum(est_value) filter (where contact_count > 0), 0)::float8 value from investors`,
  ]);

  const callsTotal = outcomes.reduce((a, o) => a + o.n, 0);
  const days: { key: string; date: Date; calls: number; wa: number }[] = [];
  if (range !== "today") {
    for (let d = RANGES[range].days; d >= 0; d--) {
      const date = localDayStart(-d);
      days.push({ key: dayKey(date), date, calls: 0, wa: 0 });
    }
    for (const a of daily) {
      const day = days.find((x) => x.key === dayKey(a.created_at));
      if (day) a.type === "call" ? day.calls++ : day.wa++;
    }
  }
  const maxDay = Math.max(1, ...days.map((d) => d.calls + d.wa));

  return (
    <div className="stack" style={{ gap: 28 }}>
      <div className="row wrap">
        <div className="seg">
          {Object.entries(RANGES).map(([key, v]) => (
            <Link key={key} href={key === "today" ? "/admin" : `/admin?range=${key}`} className={range === key ? "on" : ""}>{v.label}</Link>
          ))}
        </div>
        <div className="spacer" />
        <a className="btn btn-secondary btn-sm" href="/api/admin/export?kind=investors"><Download />Export investors</a>
      </div>

      <div className="grid grid-5">
        <div className="stat hero"><div className="k">Calls</div><div className="v">{num(k.calls)}</div><div className="d">{RANGES[range].label.toLowerCase()}</div></div>
        <div className="stat"><div className="k">WhatsApp</div><div className="v">{num(k.wa)}</div><div className="d">messages opened</div></div>
        <div className="stat"><div className="k">Investors reached</div><div className="v">{num(k.reached)}</div><div className="d">called or messaged</div></div>
        <div className="stat"><div className="k">Interested · Meetings</div><div className="v">{num(k.interested)} · {num(k.meetings)}</div><div className="d">positive outcomes</div></div>
        <div className="stat"><div className="k">Overdue follow-ups</div><div className="v" style={k.overdue ? { color: "var(--red)" } : undefined}>{num(k.overdue)}</div><div className="d">across the team</div></div>
      </div>

      {days.length > 0 && (
        <div className="card pad">
          <div className="row" style={{ marginBottom: 16 }}>
            <h2 className="section" style={{ margin: 0 }}>Daily activity</h2>
            <div className="spacer" />
            <div className="legend" style={{ margin: 0 }}><span><i style={{ background: "var(--ink)" }} />Calls</span><span><i style={{ background: "var(--champ)" }} />WhatsApp</span></div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: days.length > 10 ? 4 : 10, height: 140 }}>
            {days.map((d) => (
              <div key={d.key} title={`${shortDate(d.date)}: ${d.calls} calls, ${d.wa} WhatsApp`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", gap: 2 }}>
                {d.wa > 0 && <div style={{ height: `${(d.wa / maxDay) * 100}%`, background: "var(--champ)", borderRadius: "4px 4px 0 0", minHeight: 3 }} />}
                {d.calls > 0 && <div style={{ height: `${(d.calls / maxDay) * 100}%`, background: "var(--ink)", borderRadius: d.wa ? 0 : "4px 4px 0 0", minHeight: 3 }} />}
                {!d.calls && !d.wa && <div style={{ height: 3, background: "var(--fill-2)", borderRadius: 3 }} />}
              </div>
            ))}
          </div>
          <div className="row xs faint" style={{ justifyContent: "space-between", marginTop: 8 }}>
            <span>{shortDate(days[0].date)}</span><span>Today</span>
          </div>
        </div>
      )}

      <div className="grid split">
        <div className="card">
          <div className="card-head"><h2>Team</h2><div className="spacer" /><Link href="/admin/team" className="small muted">Manage</Link></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Member</th><th className="r">Calls</th><th className="r">WhatsApp</th><th className="r">Positive</th><th className="r">Handling</th><th>Last active</th></tr></thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <span className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{initials(a.name)}</span>
                        <div><div className="strong">{a.name}</div><div className="xs faint">{a.role === "admin" ? "Admin" : "Caller"}</div></div>
                      </div>
                    </td>
                    <td className="r num">{a.calls}</td>
                    <td className="r num">{a.wa}</td>
                    <td className="r num">{a.positive}</td>
                    <td className="r num">{num(a.handled)}</td>
                    <td className="nowrap small">
                      <span className="row" style={{ gap: 7 }}>
                        <span className={a.last_seen_at && a.last_seen_at > online ? "online" : "offline"} />
                        {a.last_seen_at && a.last_seen_at > online ? "Online now" : relative(a.last_act || a.last_seen_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card pad">
          <h2 className="section">Call outcomes</h2>
          {callsTotal === 0 ? (
            <div className="small faint">No calls logged {range === "today" ? "today" : "in this period"} yet.</div>
          ) : (
            <>
              <div className="stackbar" style={{ height: 12 }}>
                {outcomes.map((o) => <i key={o.outcome} style={{ width: `${(o.n / callsTotal) * 100}%`, background: TONE_COLOR[OUTCOME_TONE[o.outcome]] }} title={`${OUTCOME_LABEL[o.outcome]}: ${o.n}`} />)}
              </div>
              <div className="bars" style={{ marginTop: 18 }}>
                {OUTCOMES.filter((o) => outcomes.some((x) => x.outcome === o.key)).map((o) => {
                  const n = outcomes.find((x) => x.outcome === o.key)!.n;
                  return (
                    <div key={o.key} className="row small" style={{ justifyContent: "space-between" }}>
                      <span className="row" style={{ gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: TONE_COLOR[o.tone] }} />{o.label}</span>
                      <span className="num muted">{n} · {Math.round((n / callsTotal) * 100)}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid split-rev">
        <div className="card pad">
          <h2 className="section">Coverage</h2>
          <div className="small muted" style={{ marginTop: -8, marginBottom: 16 }}>
            {num(totals.contacted)} of {num(totals.investors)} investors contacted · {aed(totals.value, { short: true })} of portfolio value reached
          </div>
          <div className="bars">
            {TIERS.map((t) => {
              const c = coverage.find((x) => x.tier === t);
              if (!c) return null;
              return (
                <div key={t} className="bar-row">
                  <div className="top"><span>{t}</span><span>{num(c.contacted)} / {num(c.total)}</span></div>
                  <div className="bar champ"><i style={{ width: `${Math.max(c.contacted ? 1.5 : 0, (c.contacted / c.total) * 100)}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Latest activity</h2><div className="spacer" /><Link href="/admin/activity" className="small muted">See all</Link></div>
          <div className="card-body" style={{ paddingTop: 4, paddingBottom: 4 }}>
            {feed.length === 0 && <div className="small faint" style={{ padding: "14px 0" }}>Nothing yet. Activity appears here as your team calls and messages investors.</div>}
            {feed.map((a) => (
              <div key={a.id} className="feed-item">
                <div className={`tl-icon ${a.type === "whatsapp" ? "wa" : a.type === "call" ? "call" : ""}`}>
                  {a.type === "call" ? <Phone /> : a.type === "whatsapp" ? <MessageCircle /> : a.type === "note" ? <StickyNote /> : <UserCheck />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div><b>{a.user_name}</b> {a.type === "call" ? "called" : a.type === "whatsapp" ? "messaged" : "noted on"} <Link className="link" href={`/investors/${a.investor_id}`}>{a.investor}</Link></div>
                  <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
                    {a.outcome && <span className={`pill ${OUTCOME_TONE[a.outcome]}`}>{OUTCOME_LABEL[a.outcome]}</span>}
                    {a.template_name && <span className="pill outline plain">{a.template_name}</span>}
                    {a.note && <span className="small muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 360 }}>{a.note}</span>}
                  </div>
                </div>
                <div className="xs faint nowrap">{relative(a.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
