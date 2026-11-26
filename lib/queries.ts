import "server-only";
import { sql } from "./db";
import type { User } from "./auth";
import { localDayStart } from "./format";
import { OUTCOME_LABEL } from "./outcomes";
import type { PendingQuery, Row } from "postgres";

export type Filters = {
  q?: string;
  tier?: string;
  band?: string;
  origin?: string;
  country?: string;
  community?: string;
  tag?: string;
  status?: string;
  owner?: string;
  sort?: string;
  page?: string;
};

export const PAGE_SIZE = 50;

export async function getSetting(key: string, fallback = "") {
  const [row] = await sql<{ value: string }[]>`select value from settings where key = ${key}`;
  return row?.value ?? fallback;
}

type Frag = PendingQuery<Row[]>;
const join = (conds: Frag[]) =>
  conds.reduce<Frag>((acc, c, i) => (i === 0 ? sql`where ${c}` : sql`${acc} and ${c}`), sql``);

export async function investorConditions(f: Filters, user: User, opts: { skipTier?: boolean } = {}) {
  const c: Frag[] = [];
  if (user.role !== "admin" && (await getSetting("agent_scope", "all")) === "allocated") {
    c.push(sql`i.assigned_to = ${user.id}`);
  }
  const q = (f.q || "").trim().toLowerCase();
  if (q) {
    const digits = q.replace(/\D/g, "");
    if (digits.length >= 5 && digits.length >= q.replace(/\s/g, "").length - 2) {
      const d = digits.startsWith("0") ? "971" + digits.slice(1) : digits;
      c.push(sql`i.search like ${"%" + d + "%"}`);
    } else {
      for (const word of q.split(/\s+/).slice(0, 5)) c.push(sql`i.search like ${"%" + word + "%"}`);
    }
  }
  if (f.tier && !opts.skipTier) c.push(sql`i.tier = ${f.tier}`);
  if (f.band) c.push(sql`i.value_band = ${f.band}`);
  if (f.origin) c.push(f.origin === "unknown" ? sql`i.name_origin is null` : sql`i.name_origin = ${f.origin}`);
  if (f.country) c.push(f.country === "unknown" ? sql`coalesce(i.nationality, i.phone_country) is null` : sql`coalesce(i.nationality, i.phone_country) = ${f.country}`);
  if (f.community) c.push(sql`exists (select 1 from units u join projects p on p.id = u.project_id where u.investor_id = i.id and p.community = ${f.community})`);
  if (f.tag) c.push(sql`${f.tag} = any(i.tags)`);
  if (f.status === "new") c.push(sql`i.contact_count = 0`);
  else if (f.status === "followup") c.push(sql`i.next_follow_up_at < ${localDayStart(1)}`);
  else if (f.status && OUTCOME_LABEL[f.status]) c.push(sql`i.status = ${f.status}`);
  if (f.owner === "mine") c.push(sql`i.assigned_to = ${user.id}`);
  else if (f.owner === "unassigned") c.push(sql`i.assigned_to is null`);
  else if (f.owner === "assigned") c.push(sql`i.assigned_to is not null`);
  else if (f.owner && /^\d+$/.test(f.owner)) c.push(sql`i.assigned_to = ${Number(f.owner)}`);
  return c;
}

const SORTS: Record<string, string> = {
  value: "i.est_value desc, i.total_units desc, i.id",
  units: "i.total_units desc, i.est_value desc, i.id",
  name: "lower(i.name), i.id",
  recent: "i.last_contact_at desc nulls last, i.id",
  followup: "i.next_follow_up_at asc nulls last, i.id",
};

export type InvestorRow = {
  id: number; ref: string; name: string; aliases: string[]; total_units: number; priced_units: number; est_value: number;
  communities: number; top_community: string | null; top_project: string | null; tier: string; value_band: string;
  nationality: string | null; phone_country: string | null; name_origin: string | null; status: string | null;
  last_contact_at: Date | null; next_follow_up_at: Date | null; assigned_to: number | null; assignee: string | null;
  do_not_call: boolean; tags: string[];
};

export async function listInvestors(f: Filters, user: User) {
  const conds = await investorConditions(f, user);
  const where = join(conds);
  const page = Math.max(1, parseInt(f.page || "1", 10) || 1);
  const order = SORTS[f.sort || "value"] || SORTS.value;
  const rows = await sql<InvestorRow[]>`
    select i.id, i.ref, i.name, i.aliases, i.total_units, i.priced_units, i.est_value, i.communities, i.top_community, i.top_project,
           i.tier, i.value_band, i.nationality, i.phone_country, i.name_origin, i.status, i.last_contact_at, i.next_follow_up_at,
           i.assigned_to, coalesce(u.name, u.email) as assignee, i.do_not_call, i.tags
    from investors i left join users u on u.id = i.assigned_to
    ${where}
    order by ${sql.unsafe(order)}
    limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`;
  const [totals] = await sql<{ n: number; value: number; units: number }[]>`
    select count(*)::int n, coalesce(sum(i.est_value), 0)::float8 value, coalesce(sum(i.total_units), 0)::int units
    from investors i ${where}`;
  const tierConds = await investorConditions(f, user, { skipTier: true });
  const tiers = await sql<{ tier: string; n: number }[]>`
    select i.tier, count(*)::int n from investors i ${join(tierConds)} group by 1`;
  return { rows, totals, tiers: Object.fromEntries(tiers.map((t) => [t.tier, t.n])) as Record<string, number>, page };
}

export async function filterOptions() {
  const [origins, countries, communities, agents] = await Promise.all([
    sql<{ v: string | null; n: number }[]>`select name_origin v, count(*)::int n from investors group by 1 order by 2 desc`,
    sql<{ v: string | null; n: number }[]>`select coalesce(nationality, phone_country) v, count(*)::int n from investors group by 1 order by 2 desc`,
    sql<{ v: string; n: number }[]>`select p.community v, count(distinct u.investor_id)::int n from units u join projects p on p.id = u.project_id group by 1 order by 2 desc`,
    sql<{ id: number; name: string }[]>`select id, coalesce(name, email) as name from users where active order by 2`,
  ]);
  return { origins, countries, communities, agents };
}
