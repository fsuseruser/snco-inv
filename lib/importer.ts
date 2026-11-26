import type { Sql } from "postgres";
import type { ProjectRow, UnitRow } from "./importFormat";
import { INSTITUTION_RE, PLACEHOLDER_RE, nameOrigin, phoneCountry, splitPhones } from "./classify";
import { cleanName, nameTokens, normName, prettyName, similarNames } from "./match";
import { recalcAll } from "./recalc";
import { countryCode } from "./countries";

export type ImportSummary = {
  rows: number;
  unitRows: number;
  projectRows: number;
  newInvestors: number;
  matchedInvestors: number;
  newUnits: number;
  duplicateUnits: number;
  newProjects: number;
  updatedProjects: number;
  skipped: Record<string, number>;
  skippedExamples: { row: number; reason: string; name?: string }[];
};

type Inv = {
  id?: number;
  ref: string;
  name: string;
  aliases: Set<string>;
  phones: Set<string>;
  nationality?: string | null;
  isNew: boolean;
  touched: boolean;
};

const BATCH = 1000;

export async function runImport(sql: Sql, importId: number, commit: boolean): Promise<ImportSummary> {
  const staged = await sql<{ kind: string; idx: number; data: UnitRow & ProjectRow }[]>`
    select kind, idx, data from import_rows where import_id = ${importId} order by kind, idx`;
  const unitRows = staged.filter((r) => r.kind === "unit");
  const projectRows = staged.filter((r) => r.kind === "project").map((r) => r.data as ProjectRow);

  const s: ImportSummary = {
    rows: staged.length, unitRows: unitRows.length, projectRows: projectRows.length,
    newInvestors: 0, matchedInvestors: 0, newUnits: 0, duplicateUnits: 0, newProjects: 0, updatedProjects: 0,
    skipped: {}, skippedExamples: [],
  };
  const skip = (row: number, reason: string, name?: string) => {
    s.skipped[reason] = (s.skipped[reason] || 0) + 1;
    if (s.skippedExamples.length < 25) s.skippedExamples.push({ row, reason, name });
  };

  /* ---------- projects */
  const projects = new Map<string, { id?: number; name: string; community?: string; developer?: string }>();
  for (const p of await sql<{ id: number; name: string }[]>`select id, name from projects`) {
    projects.set(p.name.toLowerCase(), { id: p.id, name: p.name });
  }
  const projectUpdates: ProjectRow[] = [];
  const newProjects = new Map<string, ProjectRow>();
  for (const p of projectRows) {
    const k = p.project!.toLowerCase();
    if (projects.has(k)) projectUpdates.push(p);
    else if (!newProjects.has(k)) newProjects.set(k, p);
  }

  /* ---------- investor indexes */
  const existing = await sql<{ id: number; ref: string; name: string; aliases: string[]; phones: string[] }[]>`
    select id, ref, name, aliases, phones from investors`;
  const all: Inv[] = existing.map((e) => ({
    id: e.id, ref: e.ref, name: e.name, aliases: new Set(e.aliases), phones: new Set(e.phones), isNew: false, touched: false,
  }));
  const byRef = new Map<string, Inv>();
  const byPhone = new Map<string, Inv[]>();
  const byNorm = new Map<string, Inv[]>();
  const index = (inv: Inv) => {
    byRef.set(inv.ref.toLowerCase(), inv);
    for (const p of inv.phones) (byPhone.get(p) || byPhone.set(p, []).get(p)!).includes(inv) || byPhone.get(p)!.push(inv);
    for (const n of [inv.name, ...inv.aliases]) {
      const k = normName(n);
      if (k) (byNorm.get(k) || byNorm.set(k, []).get(k)!).includes(inv) || byNorm.get(k)!.push(inv);
    }
  };
  all.forEach(index);

  let maxRef = 0;
  for (const inv of all) {
    const m = inv.ref.match(/(\d+)$/);
    if (m) maxRef = Math.max(maxRef, parseInt(m[1], 10));
  }
  const nextRef = () => `INV-${String(++maxRef).padStart(5, "0")}`;

  const isHub = (phone: string) => {
    const firsts = new Set((byPhone.get(phone) || []).map((i) => nameTokens(i.name)[0]).filter(Boolean));
    return firsts.size > 4;
  };

  const find = (ref: string | undefined, name: string, phones: string[]): Inv | null => {
    // an explicit ref is trusted: same ref = same investor, a new ref = a new investor
    if (ref) return byRef.get(ref.toLowerCase()) ?? null;
    for (const p of phones) {
      if (isHub(p)) continue;
      for (const c of byPhone.get(p) || []) {
        if (!name || /^unnamed owner$/i.test(c.name) || similarNames(name, c.name) || [...c.aliases].some((a) => similarNames(name, a))) return c;
      }
    }
    if (name) {
      const cands = byNorm.get(normName(name)) || [];
      for (const c of cands) {
        if (nameTokens(name).length >= 3 || !phones.length || !c.phones.size || phones.some((p) => c.phones.has(p))) return c;
      }
    }
    return null;
  };

  /* ---------- rows */
  type PendingUnit = { inv: Inv; project: string; unit: string | null; row: UnitRow };
  const pending: PendingUnit[] = [];
  const seen = new Set<string>();
  const matched = new Set<Inv>();

  for (const { idx, data: r } of unitRows) {
    const rowNo = idx + 2;
    const raw = r.name || "";
    if (!r.project) { skip(rowNo, "No project", raw); continue; }
    if (raw && INSTITUTION_RE.test(raw)) { skip(rowNo, "Company or institution", raw); continue; }
    let name = cleanName(raw);
    if (name && (PLACEHOLDER_RE.test(name) || name.replace(/[^A-Za-z؀-ۿ]/g, "").length < 2)) name = "";
    const phones = splitPhones(r.phones);
    if (!name && !phones.length) { skip(rowNo, raw ? "Placeholder name and no phone" : "No name and no phone", raw); continue; }
    name = name ? prettyName(name) : "";

    let inv = find(r.ref, name, phones);
    if (!inv) {
      inv = {
        ref: r.ref && !byRef.has(r.ref.toLowerCase()) ? r.ref : nextRef(),
        name: name || "Unnamed owner",
        aliases: new Set(), phones: new Set(phones), nationality: r.nationality, isNew: true, touched: true,
      };
      all.push(inv);
      s.newInvestors++;
    } else {
      if (!inv.isNew && !matched.has(inv)) { matched.add(inv); s.matchedInvestors++; }
      for (const p of phones) if (!inv.phones.has(p)) { inv.phones.add(p); inv.touched = true; }
      if (name && /^unnamed owner$/i.test(inv.name)) { inv.name = name; inv.touched = true; }
      else if (name && name.toLowerCase() !== inv.name.toLowerCase() && ![...inv.aliases].some((a) => a.toLowerCase() === name.toLowerCase())) {
        inv.aliases.add(name); inv.touched = true;
      }
      if (r.nationality && !inv.nationality) { inv.nationality = r.nationality; inv.touched = true; }
    }
    for (const a of (r.aliases || "").split(";").map((x) => prettyName(cleanName(x))).filter(Boolean)) {
      if (a.toLowerCase() !== inv.name.toLowerCase() && ![...inv.aliases].some((x) => x.toLowerCase() === a.toLowerCase())) {
        inv.aliases.add(a); inv.touched = true;
      }
    }
    index(inv);

    const pk = r.project.toLowerCase();
    if (!projects.has(pk) && !newProjects.has(pk)) newProjects.set(pk, { project: r.project, community: r.community, developer: r.developer });
    const unit = r.unit ? String(r.unit).trim() : null;
    const k = `${inv.ref}|${pk}|${unit ? unit.toLowerCase() : "#" + rowNo}`;
    if (unit && seen.has(k)) { s.duplicateUnits++; continue; }
    seen.add(k);
    pending.push({ inv, project: pk, unit, row: r });
  }

  // units that already exist in the database for matched investors
  // units without a unit number can't be told apart, so an investor's existing count per project is used instead
  const existingKeys = new Set<string>();
  const existingUnnumbered = new Map<string, number>();
  if (matched.size) {
    const ids = [...matched].map((i) => i.id!);
    for (const u of await sql<{ investor_id: number; name: string; unit_code: string | null }[]>`
      select u.investor_id, lower(p.name) as name, u.unit_code from units u join projects p on p.id = u.project_id
      where u.investor_id = any(${ids})`) {
      if (u.unit_code) existingKeys.add(`${u.investor_id}|${u.name}|${u.unit_code.toLowerCase()}`);
      else existingUnnumbered.set(`${u.investor_id}|${u.name}`, (existingUnnumbered.get(`${u.investor_id}|${u.name}`) || 0) + 1);
    }
  }
  const toInsert = pending.filter((p) => {
    if (!p.inv.id) return true;
    if (p.unit) {
      if (existingKeys.has(`${p.inv.id}|${p.project}|${p.unit.toLowerCase()}`)) { s.duplicateUnits++; return false; }
      return true;
    }
    const k = `${p.inv.id}|${p.project}`;
    const left = existingUnnumbered.get(k) || 0;
    if (left > 0) { existingUnnumbered.set(k, left - 1); s.duplicateUnits++; return false; }
    return true;
  });
  s.newUnits = toInsert.length;
  s.newProjects = newProjects.size;
  s.updatedProjects = projectUpdates.length;

  if (!commit) {
    await sql`update imports set status = 'previewed', summary = ${sql.json(s)} where id = ${importId}`;
    return s;
  }

  /* ---------- write */
  await sql.begin(async (tx) => {
    // projects
    for (const p of newProjects.values()) {
      const [row] = await tx<{ id: number }[]>`
        insert into projects (name, community, developer, price_studio, price_1br, price_2br, price_3br, price_4br, price_5br,
                              price_typical, price_source, price_basis, lat, lng)
        values (${p.project!}, ${p.community || "Other"}, ${p.developer || null}, ${p.price_studio ?? null}, ${p.price_1br ?? null},
                ${p.price_2br ?? null}, ${p.price_3br ?? null}, ${p.price_4br ?? null}, ${p.price_5br ?? null}, ${p.price_typical ?? null},
                ${p.price_source || null}, ${p.price_basis || null}, ${p.lat ?? null}, ${p.lng ?? null})
        returning id`;
      projects.set(p.project!.toLowerCase(), { id: row.id, name: p.project! });
    }
    for (const p of projectUpdates) {
      await tx`
        update projects set
          community = coalesce(${p.community || null}, community), developer = coalesce(${p.developer || null}, developer),
          price_studio = coalesce(${p.price_studio ?? null}, price_studio), price_1br = coalesce(${p.price_1br ?? null}, price_1br),
          price_2br = coalesce(${p.price_2br ?? null}, price_2br), price_3br = coalesce(${p.price_3br ?? null}, price_3br),
          price_4br = coalesce(${p.price_4br ?? null}, price_4br), price_5br = coalesce(${p.price_5br ?? null}, price_5br),
          price_typical = coalesce(${p.price_typical ?? null}, price_typical),
          price_source = coalesce(${p.price_source || null}, price_source), price_basis = coalesce(${p.price_basis || null}, price_basis),
          lat = coalesce(${p.lat ?? null}, lat), lng = coalesce(${p.lng ?? null}, lng), updated_at = now()
        where lower(name) = ${p.project!.toLowerCase()}`;
    }

    // investors
    const fresh = all.filter((i) => i.isNew);
    for (let i = 0; i < fresh.length; i += BATCH) {
      const chunk = fresh.slice(i, i + BATCH).map((v) => {
        const phones = [...v.phones];
        return {
          ref: v.ref, name: v.name, aliases: [...v.aliases], phones,
          phone_country: phoneCountry(phones[0]), name_origin: nameOrigin(v.name),
          nationality: countryCode(v.nationality),
        };
      });
      const rows = await tx<{ id: number; ref: string }[]>`
        insert into investors ${tx(chunk, "ref", "name", "aliases", "phones", "phone_country", "name_origin", "nationality")}
        returning id, ref`;
      const ids = new Map(rows.map((r) => [r.ref, r.id]));
      fresh.slice(i, i + BATCH).forEach((v) => (v.id = ids.get(v.ref)));
    }
    for (const v of all.filter((i) => !i.isNew && i.touched)) {
      const phones = [...v.phones];
      await tx`update investors set name = ${v.name}, aliases = ${[...v.aliases]}, phones = ${phones},
                 phone_country = ${phoneCountry(phones[0])}, name_origin = ${nameOrigin(v.name)},
                 nationality = coalesce(nationality, ${countryCode(v.nationality)}), updated_at = now()
               where id = ${v.id!}`;
    }

    // units
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const chunk = toInsert.slice(i, i + BATCH).map((p) => ({
        investor_id: p.inv.id!, project_id: projects.get(p.project)!.id!, unit_code: p.unit,
        bedrooms: p.row.bedrooms ?? null, value_override: p.row.value_override ?? null,
        purchase_date: p.row.purchase_date ?? null, purchase_price: p.row.purchase_price ?? null, import_id: importId,
      }));
      await tx`insert into units ${tx(chunk, "investor_id", "project_id", "unit_code", "bedrooms", "value_override", "purchase_date", "purchase_price", "import_id")}
               on conflict do nothing`;
    }
    // refresh planner statistics so the recalculation stays fast after large inserts
    await tx`analyze units`;
    await tx`analyze investors`;
    await tx`analyze projects`;
    await recalcAll(tx as unknown as Sql);
    await tx`update imports set status = 'committed', committed_at = now(), summary = ${tx.json(s)} where id = ${importId}`;
    await tx`delete from import_rows where import_id = ${importId}`;
  });
  return s;
}
