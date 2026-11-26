import { sql } from "@/lib/db";
import { dateTime, num } from "@/lib/format";
import ImportClient from "./ImportClient";
import type { ImportSummary } from "@/lib/importer";

export const metadata = { title: "Import" };

export default async function ImportPage() {
  const history = await sql<{ id: number; file_name: string; status: string; created_at: Date; committed_at: Date | null; user_name: string | null; summary: ImportSummary | null }[]>`
    select m.id, m.file_name, m.status, m.created_at, m.committed_at, coalesce(u.name, u.email) user_name, m.summary
    from imports m left join users u on u.id = m.user_id where m.status = 'committed' order by m.created_at desc limit 20`;
  return (
    <div className="stack" style={{ gap: 28 }}>
      <ImportClient />
      {history.length > 0 && (
        <section>
          <h2 className="section">Previous imports</h2>
          <div className="card">
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>File</th><th>By</th><th>When</th><th className="r">New investors</th><th className="r">Matched</th><th className="r">New units</th><th className="r">Duplicates skipped</th></tr></thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td className="strong">{h.file_name}</td>
                      <td>{h.user_name || "Command line"}</td>
                      <td className="small nowrap">{dateTime(h.committed_at || h.created_at)}</td>
                      <td className="r num">{num(h.summary?.newInvestors)}</td>
                      <td className="r num">{num(h.summary?.matchedInvestors)}</td>
                      <td className="r num">{num(h.summary?.newUnits)}</td>
                      <td className="r num">{num(h.summary?.duplicateUnits)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
