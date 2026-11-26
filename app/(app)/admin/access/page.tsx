import Link from "next/link";
import { sql } from "@/lib/db";
import { dateTime, device, num, relative, initials } from "@/lib/format";
import FilterSelect from "@/components/FilterSelect";

export const metadata = { title: "Sign-ins" };
const PAGE = 100;
const EVENT: Record<string, string> = { sign_in: "Signed in", sign_out: "Signed out", account_setup: "Set up account" };

export default async function AccessPage({ searchParams }: { searchParams: Promise<{ user?: string; failed?: string; page?: string }> }) {
  const f = await searchParams;
  const page = Math.max(1, Number(f.page) || 1);
  const where = sql`where true ${f.user ? sql`and e.user_id = ${Number(f.user)}` : sql``} ${f.failed ? sql`and not e.success` : sql``}`;
  const [users, sessions, events, [{ n }]] = await Promise.all([
    sql<{ id: number; name: string }[]>`select id, coalesce(name, email) name from users order by 2`,
    sql<{ id: string; name: string; last_seen_at: Date; created_at: Date; user_agent: string | null; ip: string | null }[]>`
      select s.id, coalesce(u.name, u.email) name, s.last_seen_at, s.created_at, s.user_agent, s.ip
      from sessions s join users u on u.id = s.user_id
      where s.expires_at > now() and s.last_seen_at > now() - interval '10 minutes' order by s.last_seen_at desc`,
    sql<{ id: number; email: string; name: string | null; event: string; success: boolean; reason: string | null; ip: string | null; user_agent: string | null; created_at: Date }[]>`
      select e.id, e.email, u.name, e.event, e.success, e.reason, e.ip, e.user_agent, e.created_at
      from login_events e left join users u on u.id = e.user_id ${where}
      order by e.created_at desc limit ${PAGE} offset ${(page - 1) * PAGE}`,
    sql<{ n: number }[]>`select count(*)::int n from login_events e ${where}`,
  ]);
  const qs = (p: number) => { const s = new URLSearchParams(); if (f.user) s.set("user", f.user); if (f.failed) s.set("failed", "1"); s.set("page", String(p)); return s.toString(); };
  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="card pad">
        <h2 className="section">Online now</h2>
        {sessions.length === 0 ? <div className="small faint">Nobody is active right now.</div> : (
          <div className="row wrap" style={{ gap: 12 }}>
            {sessions.map((s) => (
              <div key={s.id} className="row" style={{ gap: 10, padding: "8px 14px 8px 8px", borderRadius: 999, background: "var(--canvas)" }}>
                <span className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{initials(s.name)}</span>
                <div><div className="small strong">{s.name}</div><div className="xs faint">{device(s.user_agent)} · since {relative(s.created_at)}</div></div>
                <span className="online" />
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <FilterSelect name="user" value={f.user} label="Everyone" options={users.map((u) => ({ v: String(u.id), label: u.name }))} />
          <FilterSelect name="failed" value={f.failed} label="All attempts" options={[{ v: "1", label: "Failed only" }]} />
        </div>
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Time</th><th>Who</th><th>Event</th><th>Device</th><th>IP address</th></tr></thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className="nowrap small">{dateTime(e.created_at)}</td>
                    <td><div>{e.name || e.email}</div>{e.name && <div className="xs faint">{e.email}</div>}</td>
                    <td className="nowrap">{e.success ? <span className={`pill ${e.event === "sign_in" ? "green" : "grey"}`}>{EVENT[e.event] || e.event}</span> : <span className="pill red">Failed · {e.reason}</span>}</td>
                    <td className="small muted nowrap">{device(e.user_agent)}</td>
                    <td className="small muted num">{e.ip || "—"}</td>
                  </tr>
                ))}
                {!events.length && <tr><td colSpan={5} className="faint" style={{ textAlign: "center", padding: 40 }}>No sign-ins recorded.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="pager">
          <span className="num">{num(n)} events</span>
          <div className="row">
            {page > 1 && <Link className="btn btn-secondary btn-sm" href={`?${qs(page - 1)}`}>Previous</Link>}
            {page * PAGE < n && <Link className="btn btn-secondary btn-sm" href={`?${qs(page + 1)}`}>Next</Link>}
          </div>
        </div>
      </div>
    </div>
  );
}
