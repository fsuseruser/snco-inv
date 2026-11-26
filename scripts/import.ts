// Command-line import (optional; the admin panel does the same thing in the browser).
// Usage: npm run db:import -- path/to/file.xlsx
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { parseWorkbook } from "../lib/importFormat";
import { runImport } from "../lib/importer";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: npm run db:import -- path/to/file.xlsx");
  const { sql } = await import("../lib/db");
  const wb = XLSX.read(fs.readFileSync(file), { cellDates: true });
  const { units, projects, notes } = parseWorkbook(XLSX, wb);
  notes.forEach((n) => console.warn(n));
  console.log(`Read ${units.length} unit rows and ${projects.length} project rows`);

  const [{ id }] = await sql<{ id: number }[]>`
    insert into imports (file_name, total_rows) values (${path.basename(file)}, ${units.length + projects.length}) returning id`;
  const stage = async (kind: string, rows: object[]) => {
    for (let i = 0; i < rows.length; i += 2000) {
      const chunk = rows.slice(i, i + 2000).map((data, j) => ({ import_id: id, idx: i + j, kind, data: sql.json(data as never) }));
      await sql`insert into import_rows ${sql(chunk, "import_id", "idx", "kind", "data")}`;
    }
  };
  await stage("project", projects);
  await stage("unit", units);
  const t = Date.now();
  const summary = await runImport(sql, id, true);
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Imported in ${((Date.now() - t) / 1000).toFixed(1)}s`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
