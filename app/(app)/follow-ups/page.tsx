import Link from "next/link";
import { CalendarCheck2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { aed, dateTime, localDayStart, time, shortDate } from "@/lib/format";
import StatusPill from "@/components/StatusPill";

export const metadata = { title: "Follow-ups" };

type Row = {
  id: number; name: string; next_follow_up_at: Date; status: string | null; top_project: string | null; est_value: number;
  total_units: number; assignee: string | null; last_note: string | null;
};

export default async function FollowUps({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  const user = await requireUser();
  const { who } = await searchParams;
  const isAdmin = user.role === "admin";
  const scope = isAdmin ? who || "mine" : "mine";
  const agents = isAdmin ? await sql<{ id: number; name: string }[]>`select id, coalesce(name, email) name from users where active order by 2` : [];
  const rows = await sql<Row[]>`
    select i.id, i.name, i.next_follow_up_at, i.status, i.top_project, i.est_value, i.total_units, coalesce(u.name, u.email) assignee,
      (select a.note from activities a where a.investor_id = i.id and a.note is not null and a.type in ('call','note') order by a.created_at desc limit 1) last_note
    from investors i left join users u on u.id = i.assigned_to
    where i.next_follow_up_at is not null and not i.do_not_call
      ${scope === "mine" ? sql`and i.assigned_to = ${user.id}` : scope === "all" ? sql`` : sql`and i.assigned_to = ${Number(scope) || 0}`}
    order by i.next_follow_up_at limit 500`;

  const today = localDayStart(0), tomorrow = localDayStart(1), week = localDayStart(8);
  const groups = [
    { key: "Overdue", rows: rows.filter((r) => r.next_follow_up_at < today) },
    { key: "Today", rows: rows.filter((r) => r.next_follow_up_at >= today && r.next_follow_up_at < tomorrow) },
    { key: "This week", rows: rows.filter((r) => r.next_follow_up_at >= tomorrow && r.next_follow_up_at < week) },
    { key: "Later", rows: rows.filter((r) => r.next_follow_up_at >= week) },
  ].filter((g) => g.rows.length);

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Follow-ups</h1>
          <div className="sub">{rows.length ? `${rows.length} scheduled` : "Nothing scheduled"}</div>
        </div>
        <div className="spacer" />
        {isAdmin && (
          <div className="seg">
            <Link href="/follow-ups" className={scope === "mine" ? "on" : ""}>Mine</Link>
            <Link href="/follow-ups?who=all" className={scope === "all" ? "on" : ""}>Everyone</Link>
            {agents.filter((a) => a.id !== user.id).slice(0, 6).map((a) => (
              <Link key={a.id} href={`/follow-ups?who=${a.id}`} className={scope === String(a.id) ? "on" : ""}>{a.name.split(" ")[0]}</Link>
            ))}
          </div>
        )}
      </div>
      {!groups.length && (
        <div className="empty">
          <CalendarCheck2 />
          <div className="t">You&apos;re all caught up</div>
          <div className="small">When you log a call back, an interest or a meeting with a date, it shows up here.</div>
        </div>
      )}
      <div className="stack" style={{ gap: 28 }}>
        {groups.map((g) => (
          <section key={g.key}>
            <h3 className="section" style={g.key === "Overdue" ? { color: "var(--red)" } : undefined}>{g.key} · {g.rows.length}</h3>
            <div className="card">
              {g.rows.map((r) => (
                <Link key={r.id} href={`/investors/${r.id}`} className="feed-item" style={{ gridTemplateColumns: "84px 1fr auto", padding: "14px 18px" }}>
                  <div>
                    <div className="strong num">{g.key === "Today" || g.key === "Overdue" ? time(r.next_follow_up_at) : shortDate(r.next_follow_up_at)}</div>
                    <div className="xs faint">{g.key === "Overdue" ? shortDate(r.next_follow_up_at) : g.key === "Today" ? "today" : time(r.next_follow_up_at)}</div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="row wrap" style={{ gap: 8 }}><span className="strong">{r.name}</span><StatusPill status={r.status} /></div>
                    <div className="xs faint" style={{ marginTop: 2 }}>
                      {r.total_units} {r.total_units === 1 ? "unit" : "units"} · {r.top_project}{scope !== "mine" && r.assignee ? ` · ${r.assignee}` : ""}
                    </div>
                    {r.last_note && <div className="small muted" style={{ marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>“{r.last_note}”</div>}
                  </div>
                  <div className="num strong small nowrap" title={dateTime(r.next_follow_up_at)}>{aed(r.est_value, { short: true })}</div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
