import type { Sql } from "postgres";

export const PREMIUM_COMMUNITIES = ["Saadiyat Island", "Yas Island", "Al Maryah Island"];

export const TIERS = ["Major portfolio", "Portfolio", "Multi-unit", "Single unit"] as const;
export const TIER_HINT: Record<string, string> = {
  "Major portfolio": "10+ units",
  Portfolio: "5–9 units",
  "Multi-unit": "2–4 units",
  "Single unit": "1 unit",
};
export const VALUE_BANDS = ["AED 10M+", "AED 5–10M", "AED 2–5M", "Under AED 2M", "Not priced"] as const;
export const TAGS = ["Premium areas", "Diversified", "Concentrated", "Joint ownership", "Overseas phone"] as const;
export const TAG_HINT: Record<string, string> = {
  "Premium areas": "Half or more of their units are on Saadiyat, Yas or Al Maryah",
  Diversified: "Owns in 3 or more communities",
  Concentrated: "3 or more units in a single project",
  "Joint ownership": "At least one unit is co-owned",
  "Overseas phone": "Main phone number is not a UAE number",
};

/**
 * Recomputes unit values and every investor's portfolio figures and categories.
 * Value of a unit = override, else project price for its bedroom count, else the project's typical price.
 * Co-owned units are split between their owners so values are not double counted.
 */
export async function recalcAll(sql: Sql) {
  await sql`
    update units u set est_value = coalesce(
      u.value_override,
      case u.bedrooms
        when 0 then p.price_studio when 1 then p.price_1br when 2 then p.price_2br
        when 3 then p.price_3br when 4 then p.price_4br when 5 then p.price_5br end,
      p.price_typical)
    from projects p where p.id = u.project_id`;

  await sql`
    update units u set owners_count = c.n
    from (select project_id, unit_code, count(distinct investor_id)::int n
          from units where unit_code is not null group by 1, 2) c
    where u.project_id = c.project_id and u.unit_code = c.unit_code and u.owners_count is distinct from c.n`;

  await sql`
    with agg as (
      select u.investor_id,
        count(*)::int total,
        count(u.est_value)::int priced,
        coalesce(sum(u.est_value / greatest(u.owners_count, 1)), 0) val,
        count(distinct p.community)::int comms,
        count(*) filter (where p.community = any(${PREMIUM_COMMUNITIES}))::int prem,
        count(*) filter (where u.owners_count > 1)::int shared
      from units u join projects p on p.id = u.project_id
      group by u.investor_id
    ),
    topc as (
      select distinct on (u.investor_id) u.investor_id, p.community
      from units u join projects p on p.id = u.project_id
      group by u.investor_id, p.community
      order by u.investor_id, count(*) desc, p.community
    ),
    topp as (
      select distinct on (u.investor_id) u.investor_id, p.name, count(*)::int n
      from units u join projects p on p.id = u.project_id
      group by u.investor_id, p.name
      order by u.investor_id, count(*) desc, p.name
    )
    update investors i set
      total_units = a.total,
      priced_units = a.priced,
      est_value = round(a.val),
      communities = a.comms,
      premium_units = a.prem,
      shared_units = a.shared,
      max_in_project = tp.n,
      top_community = tc.community,
      top_project = tp.name,
      tier = case when a.total >= 10 then 'Major portfolio' when a.total >= 5 then 'Portfolio'
                  when a.total >= 2 then 'Multi-unit' else 'Single unit' end,
      value_band = case when a.priced = 0 then 'Not priced' when a.val >= 10e6 then 'AED 10M+'
                        when a.val >= 5e6 then 'AED 5–10M' when a.val >= 2e6 then 'AED 2–5M' else 'Under AED 2M' end,
      tags = array_remove(array[
        case when a.prem * 2 >= a.total and a.prem > 0 then 'Premium areas' end,
        case when a.comms >= 3 then 'Diversified' end,
        case when tp.n >= 3 then 'Concentrated' end,
        case when a.shared > 0 then 'Joint ownership' end,
        case when i.phone_country is not null and i.phone_country <> 'AE' then 'Overseas phone' end
      ], null),
      search = lower(i.name || ' ' || array_to_string(i.aliases, ' ') || ' ' || i.ref || ' ' ||
               array_to_string(i.phones, ' ') || ' ' || regexp_replace(array_to_string(i.phones, ' '), '\\D', '', 'g'))
    from agg a, topc tc, topp tp
    where a.investor_id = i.id and tc.investor_id = i.id and tp.investor_id = i.id`;
}
