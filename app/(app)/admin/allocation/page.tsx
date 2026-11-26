import { sql } from "@/lib/db";
import { getSetting, filterOptions } from "@/lib/queries";
import { countryName } from "@/lib/classify";
import AllocationClient from "./AllocationClient";

export const metadata = { title: "Allocation" };

export default async function AllocationPage() {
  const [scope, opts, team, [open]] = await Promise.all([
    getSetting("agent_scope", "all"),
    filterOptions(),
    sql<{ id: number; name: string; role: string; handled: number; contacted: number; value: number }[]>`
      select u.id, coalesce(u.name, u.email) name, u.role,
        count(i.id)::int handled, count(i.id) filter (where i.contact_count > 0)::int contacted, coalesce(sum(i.est_value), 0)::float8 value
      from users u left join investors i on i.assigned_to = u.id
      where u.active group by u.id order by handled desc, name`,
    sql<{ n: number; value: number }[]>`select count(*)::int n, coalesce(sum(est_value),0)::float8 value from investors where assigned_to is null and not do_not_call`,
  ]);
  return (
    <AllocationClient
      scope={scope as "all" | "allocated"}
      team={team}
      open={open}
      options={{
        origins: opts.origins.filter((o) => o.v).map((o) => o.v!),
        countries: opts.countries.filter((c) => c.v).map((c) => ({ v: c.v!, label: countryName(c.v) })),
        communities: opts.communities.map((c) => c.v),
      }}
    />
  );
}
