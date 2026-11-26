// Shared by the browser importer and the command-line importer: turns a workbook into clean rows.
import type * as XLSXType from "xlsx";

export type UnitRow = {
  ref?: string;
  name?: string;
  aliases?: string;
  phones?: string;
  nationality?: string;
  project?: string;
  community?: string;
  developer?: string;
  unit?: string;
  bedrooms?: number | null;
  value_override?: number | null;
  purchase_date?: string | null;
  purchase_price?: number | null;
};

export type ProjectRow = {
  project?: string;
  community?: string;
  developer?: string;
  price_studio?: number | null;
  price_1br?: number | null;
  price_2br?: number | null;
  price_3br?: number | null;
  price_4br?: number | null;
  price_5br?: number | null;
  price_typical?: number | null;
  price_source?: string;
  price_basis?: string;
  lat?: number | null;
  lng?: number | null;
};

export const UNIT_COLUMNS = [
  ["Investor ref", "Optional. Keeps rows of the same investor together. Leave blank for new investors."],
  ["Owner name", "Required unless a phone is given."],
  ["Also known as", "Other spellings, separated by ;"],
  ["Phones", "One or more numbers, separated by /. UAE numbers can be local (050…)."],
  ["Nationality", "Optional. Country name or 2-letter code, if known."],
  ["Project", "Required. Building or project name."],
  ["Community", "Needed for new projects, e.g. Saadiyat Island."],
  ["Developer", "Optional."],
  ["Unit", "Unit number. Used to skip duplicates."],
  ["Bedrooms", "Studio, 1 BR … 5+ BR, or a number."],
  ["Est. value override (AED)", "Optional. Use when you know the value; otherwise the project benchmark is used."],
  ["Purchase date", "Optional. Enables purchase timing patterns."],
  ["Purchase price (AED)", "Optional."],
] as const;

export const PROJECT_COLUMNS = [
  "Project", "Community", "Developer", "Studio", "1 BR", "2 BR", "3 BR", "4 BR", "5+ BR",
  "Typical unit price", "Source", "Basis", "Latitude", "Longitude",
] as const;

const key = (h: unknown) => String(h ?? "").toLowerCase().replace(/[^a-z0-9+]/g, "");

const UNIT_MAP: Record<string, keyof UnitRow> = {
  investorref: "ref", ref: "ref", investorid: "ref",
  ownername: "name", owner: "name", name: "name", investor: "name", investorname: "name", fullname: "name",
  alsoknownas: "aliases", aliases: "aliases", otherspellings: "aliases",
  phones: "phones", phone: "phones", mobile: "phones", phonenumbers: "phones", phonenumber: "phones", mobilenumber: "phones", contact: "phones",
  nationality: "nationality", country: "nationality",
  project: "project", projectname: "project", building: "project", tower: "project",
  community: "community", area: "community", location: "community",
  developer: "developer",
  unit: "unit", unitno: "unit", unitnumber: "unit", unitcode: "unit", unitref: "unit",
  bedrooms: "bedrooms", beds: "bedrooms", bedroom: "bedrooms", br: "bedrooms", unittype: "bedrooms", type: "bedrooms", rooms: "bedrooms",
  estvalueoverrideaed: "value_override", estvalueoverride: "value_override", estvalueaed: "value_override", estvalue: "value_override", value: "value_override", valueaed: "value_override",
  purchasedate: "purchase_date", dateofpurchase: "purchase_date", transactiondate: "purchase_date",
  purchasepriceaed: "purchase_price", purchaseprice: "purchase_price", pricepaid: "purchase_price", transactionprice: "purchase_price",
};

const PROJECT_MAP: Record<string, keyof ProjectRow> = {
  project: "project", projectname: "project", community: "community", developer: "developer",
  studio: "price_studio", "1br": "price_1br", "2br": "price_2br", "3br": "price_3br", "4br": "price_4br", "5+br": "price_5br", "5br": "price_5br",
  typicalunitprice: "price_typical", typical: "price_typical", typicalprice: "price_typical",
  source: "price_source", basis: "price_basis", latitude: "lat", lat: "lat", longitude: "lng", lng: "lng",
};

export function parseBedrooms(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).toLowerCase().trim();
  if (/studio|^st$|^0$/.test(s)) return 0;
  const m = s.match(/(\d+)/);
  if (!m) return null;
  return Math.min(5, Math.max(0, parseInt(m[1], 10)));
}

export function parseMoney(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isFinite(v) && v > 0 ? v : null;
  let s = String(v).toLowerCase().replace(/aed|,|\s/g, "");
  let mult = 1;
  if (s.endsWith("m")) { mult = 1e6; s = s.slice(0, -1); }
  else if (s.endsWith("k")) { mult = 1e3; s = s.slice(0, -1); }
  const n = parseFloat(s) * mult;
  return isFinite(n) && n > 0 ? n : null;
}

function parseDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !isNaN(+v)) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 864e5));
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const dmy = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const d = new Date(s);
  return isNaN(+d) ? null : d.toISOString().slice(0, 10);
}

const str = (v: unknown) => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return s || undefined;
};

function sheetRows(XLSX: typeof XLSXType, ws: XLSXType.WorkSheet) {
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, blankrows: false });
}

function findHeader(rows: unknown[][], map: Record<string, string>, need: string[]) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const fields = rows[i].map((h) => map[key(h)]);
    if (need.every((n) => fields.includes(n))) return { index: i, fields };
  }
  return null;
}

export function parseWorkbook(XLSX: typeof XLSXType, wb: XLSXType.WorkBook) {
  const units: UnitRow[] = [];
  const projects: ProjectRow[] = [];
  const notes: string[] = [];
  let unitSheet = "";

  for (const name of wb.SheetNames) {
    const rows = sheetRows(XLSX, wb.Sheets[name]);
    if (!rows.length) continue;
    const proj = /project|benchmark|price/i.test(name) ? findHeader(rows, PROJECT_MAP, ["project"]) : null;
    if (proj && !findHeader(rows, UNIT_MAP, ["project", "name"]) && !findHeader(rows, UNIT_MAP, ["project", "phones"])) {
      for (const r of rows.slice(proj.index + 1)) {
        const o: ProjectRow = {};
        proj.fields.forEach((f, c) => {
          if (!f) return;
          const v = r[c];
          if (f.startsWith("price_") && f !== "price_source" && f !== "price_basis") (o as Record<string, unknown>)[f] = parseMoney(v);
          else if (f === "lat" || f === "lng") (o as Record<string, unknown>)[f] = typeof v === "number" ? v : v ? parseFloat(String(v)) || null : null;
          else (o as Record<string, unknown>)[f] = str(v);
        });
        if (o.project) projects.push(o);
      }
      continue;
    }
    const head = findHeader(rows, UNIT_MAP, ["project", "name"]) || findHeader(rows, UNIT_MAP, ["project", "phones"]);
    if (!head) continue;
    unitSheet ||= name;
    for (const r of rows.slice(head.index + 1)) {
      const o: UnitRow = {};
      head.fields.forEach((f, c) => {
        if (!f || (o as Record<string, unknown>)[f] !== undefined) return;
        const v = r[c];
        if (f === "bedrooms") o.bedrooms = parseBedrooms(v);
        else if (f === "value_override" || f === "purchase_price") o[f] = parseMoney(v);
        else if (f === "purchase_date") o.purchase_date = parseDate(v);
        else if (f === "phones") o.phones = v == null ? undefined : String(v);
        else (o as Record<string, unknown>)[f] = str(v);
      });
      if (o.project || o.name || o.phones) units.push(o);
    }
  }
  if (!unitSheet) notes.push("No sheet with at least the columns “Owner name” (or “Phones”) and “Project” was found.");
  return { units, projects, unitSheet, notes };
}

export function buildTemplateWorkbook(XLSX: typeof XLSXType) {
  const wb = XLSX.utils.book_new();
  const units = XLSX.utils.aoa_to_sheet([
    UNIT_COLUMNS.map((c) => c[0]),
    ["", "Jane Example", "J. Example", "+971 50 123 4567 / 0559876543", "United Kingdom", "Mamsha Al Saadiyat", "Saadiyat Island", "Aldar", "B-1204", "2 BR", "", "2024-03-15", "2850000"],
  ]);
  units["!cols"] = UNIT_COLUMNS.map((c) => ({ wch: Math.max(14, c[0].length + 2) }));
  XLSX.utils.book_append_sheet(wb, units, "Units");
  const projects = XLSX.utils.aoa_to_sheet([
    [...PROJECT_COLUMNS],
    ["Mamsha Al Saadiyat", "Saadiyat Island", "Aldar", "", 1900000, 2900000, 4300000, "", "", 2900000, "Property Finder", "Avg asking price, Nov 2026", "", ""],
  ]);
  projects["!cols"] = PROJECT_COLUMNS.map((c) => ({ wch: Math.max(12, c.length + 2) }));
  XLSX.utils.book_append_sheet(wb, projects, "Projects");
  const help = XLSX.utils.aoa_to_sheet([
    ["How to fill this file"],
    [""],
    ["Units sheet: one row per unit owned. An investor with 5 units has 5 rows."],
    ["Projects sheet (optional): price benchmarks. Existing projects are updated, new ones are added."],
    ["Duplicates are skipped automatically: same investor + project + unit number."],
    ["Investors are matched to existing ones by Investor ref, then by phone number + similar name, then by full name."],
    ["Companies, banks, developers and government entities are skipped."],
    [""],
    ["Column", "What to enter"],
    ...UNIT_COLUMNS.map((c) => [c[0], c[1]]),
  ]);
  help["!cols"] = [{ wch: 28 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(wb, help, "Help");
  return wb;
}
