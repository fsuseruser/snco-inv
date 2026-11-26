import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { runImport } from "@/lib/importer";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getUser();
  if (!user || user.role !== "admin" || user.must_change_password) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const body = await req.json();
  try {
    switch (body.action) {
      case "create": {
        const [r] = await sql<{ id: number }[]>`
          insert into imports (user_id, file_name, total_rows) values (${user.id}, ${String(body.fileName || "upload.xlsx").slice(0, 200)}, ${Number(body.total) || 0}) returning id`;
        return NextResponse.json({ id: r.id });
      }
      case "rows": {
        const kind = body.kind === "project" ? "project" : "unit";
        const rows = (body.rows as object[]).slice(0, 5000).map((data, j) => ({
          import_id: Number(body.id), idx: Number(body.offset) + j, kind, data: sql.json(data as never),
        }));
        if (rows.length) await sql`insert into import_rows ${sql(rows, "import_id", "idx", "kind", "data")} on conflict do nothing`;
        return NextResponse.json({ ok: true });
      }
      case "preview":
        return NextResponse.json({ summary: await runImport(sql, Number(body.id), false) });
      case "commit": {
        const [imp] = await sql<{ status: string }[]>`select status from imports where id = ${Number(body.id)}`;
        if (!imp || imp.status === "committed") return NextResponse.json({ error: "This import was already completed." }, { status: 400 });
        return NextResponse.json({ summary: await runImport(sql, Number(body.id), true) });
      }
      case "discard":
        await sql`update imports set status = 'discarded' where id = ${Number(body.id)} and status <> 'committed'`;
        await sql`delete from import_rows where import_id = ${Number(body.id)}`;
        return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Import failed" }, { status: 500 });
  }
}
