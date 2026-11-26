import Link from "next/link";
import { Download } from "lucide-react";
import { sql } from "@/lib/db";
import { dateTime, fromLocalInput, num } from "@/lib/format";
import { OUTCOMES, OUTCOME_LABEL, OUTCOME_TONE, ACTIVITY_LABEL } from "@/lib/outcomes";
import FilterSelect from "@/components/FilterSelect";

export const metadata = { title: "Activity" };
const PAGE = 100;

type F = { user?: string; type?: string; outcome?: string; from?: string; to?: string; page?: string };

export default async function ActivityPage({ searchParams }: { searchParams: Promise<F> }) {
  const f = await searchParams;
  const page = Math.max(1, Number(f.page) || 1);
  const from = f.from ? fromLocalInput(f.from) : null;
  const to = f.to ? fromLocalInput(f.to + "T23:59") : null;
  const where = sql`where true
    ${f.user ? sql`and a.user_id = ${Number(f.user)}` : sql``}
    ${f.type ? sql`and a.type = ${f.type}` : sql``}
    ${f.outcome ? sql`and a.outcome = ${f.outcome}` : sql``}
    ${from ? sql`and a.created_at >= ${from}` : sql``}
    ${to ? sql`and a.created_at <= ${to}` : sql``}`;
  const [users, rows, [{ n }]] = await Promise.all([
    sql<{ id: number; name: string }[]>`select id, coalesce(name, email) name from users order by 2`,
    sql<{ id: number; type: string; outcome: string | null; note: string | null; message: string | null; template_name: string | null; created_at: Date; user_name: string | null; investor_id: number; investor: string; follow_up_at: Date | null }[]>`
      select a.id, a.type, a.outcome, a.note, a.message, a.template_name, a.created_at, a.follow_up_at, coalesce(u.name, u.email) user_name,
             i.id investor_id, i.name investor
      from activities a join investors i on i.id = a.investor_id left join users u on u.id = a.user_id
      ${where} order by a.created_at desc limit ${PAGE} offset ${(page - 1) * PAGE}`,
    sql<{ n: number }[]>`select count(*)::int n from activities a ${where}`,
  ]);
  const qs = (changes: Partial<F>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, ...changes })) if (v) p.set(k, v);
    return p.toString();
  };
  return (
    <div>
      <div className="toolbar" style={{ marginBottom: 16 }}>
        <FilterSelect name="user" value={f.user} label="Everyone" options={users.map((u) => ({ v: String(u.id), label: u.name }))} />
        <FilterSelect name="type" value={f.type} label="All types" options={[{ v: "call", label: "Calls" }, { v: "whatsapp", label: "WhatsApp" }, { v: "note", label: "Notes" }, { v: "assign", label: "Allocation" }]} />
        <FilterSelect name="outcome" value={f.outcome} label="Any outcome" options={OUTCOMES.map((o) => ({ v: o.key, label: o.label }))} />
        <FilterSelect name="from" value={f.from} label="From" type="date" />
        <FilterSelect name="to" value={f.to} label="To" type="date" />
        <div className="spacer" />
        <a className="btn btn-secondary btn-sm" href={`/api/admin/export?kind=activity&${qs({ page: undefined })}`}><Download />Export</a>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>When</th><th>Who</th><th>Investor</th><th>What</th><th>Details</th></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="nowrap small">{dateTime(a.created_at)}</td>
                  <td className="nowrap">{a.user_name || "—"}</td>
                  <td><Link className="link" href={`/investors/${a.investor_id}`}>{a.investor}</Link></td>
                  <td className="nowrap">
                    <span className="small">{ACTIVITY_LABEL[a.type] || a.type}</span>{" "}
                    {a.outcome && <span className={`pill ${OUTCOME_TONE[a.outcome]}`}>{OUTCOME_LABEL[a.outcome]}</span>}
                    {a.template_name && <span className="pill outline plain">{a.template_name}</span>}
                  </td>
                  <td className="small muted" style={{ maxWidth: 420 }}>
                    <div style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.note || a.message || ""}</div>
                    {a.follow_up_at && <div className="xs" style={{ color: "var(--champ-ink)" }}>Follow up {dateTime(a.follow_up_at)}</div>}
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={5} className="faint" style={{ textAlign: "center", padding: 40 }}>No activity matches these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="pager">
        <span className="num">{num(n)} entries</span>
        <div className="row">
          {page > 1 && <Link className="btn btn-secondary btn-sm" href={`?${qs({ page: String(page - 1) })}`}>Previous</Link>}
          {page * PAGE < n && <Link className="btn btn-secondary btn-sm" href={`?${qs({ page: String(page + 1) })}`}>Next</Link>}
        </div>
      </div>
    </div>
  );
}
