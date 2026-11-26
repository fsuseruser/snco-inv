import * as XLSX from "xlsx";
import { getUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { fromLocalInput, dateTime } from "@/lib/format";
import { OUTCOME_LABEL, ACTIVITY_LABEL } from "@/lib/outcomes";
import { countryName } from "@/lib/classify";

export const maxDuration = 120;

export async function GET(req: Request) {
  const user = await getUser();
  if (!user || user.role !== "admin") return new Response("Not allowed", { status: 403 });
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const wb = XLSX.utils.book_new();
  let name = "export";

  if (kind === "activity") {
    const p = Object.fromEntries(url.searchParams);
    const from = p.from ? fromLocalInput(p.from) : null;
    const to = p.to ? fromLocalInput(p.to + "T23:59") : null;
    const rows = await sql`
      select a.created_at, coalesce(u.name, u.email) as user_name, i.ref, i.name as investor, a.type, a.outcome, a.phone, a.template_name, a.note, a.message, a.follow_up_at
      from activities a join investors i on i.id = a.investor_id left join users u on u.id = a.user_id
      where true ${p.user ? sql`and a.user_id = ${Number(p.user)}` : sql``} ${p.type ? sql`and a.type = ${p.type}` : sql``}
        ${p.outcome ? sql`and a.outcome = ${p.outcome}` : sql``} ${from ? sql`and a.created_at >= ${from}` : sql``} ${to ? sql`and a.created_at <= ${to}` : sql``}
      order by a.created_at desc limit 100000`;
    const ws = XLSX.utils.json_to_sheet(rows.map((r) => ({
      When: dateTime(r.created_at), Who: r.user_name, Ref: r.ref, Investor: r.investor, Type: ACTIVITY_LABEL[r.type] || r.type,
      Outcome: r.outcome ? OUTCOME_LABEL[r.outcome] : "", Phone: r.phone || "", Template: r.template_name || "", Note: r.note || "",
      Message: r.message || "", "Follow up": r.follow_up_at ? dateTime(r.follow_up_at) : "",
    })));
    XLSX.utils.book_append_sheet(wb, ws, "Activity");
    name = "S&Co Activity";
  } else {
    const rows = await sql`
      select i.ref, i.name, array_to_string(i.aliases, '; ') aliases, array_to_string(i.phones, ' / ') phones, i.nationality, i.phone_country, i.name_origin,
        i.tier, i.value_band, i.total_units, i.priced_units, i.est_value, i.communities, i.top_community, i.top_project, array_to_string(i.tags, ', ') tags,
        i.status, i.do_not_call, i.contact_count, i.last_contact_at, i.next_follow_up_at, coalesce(u.name, u.email) handled_by
      from investors i left join users u on u.id = i.assigned_to order by i.est_value desc`;
    const ws = XLSX.utils.json_to_sheet(rows.map((r) => ({
      Ref: r.ref, Name: r.name, "Also known as": r.aliases, Phones: r.do_not_call ? "(do not call)" : r.phones,
      Nationality: countryName(r.nationality || r.phone_country), "Nationality source": r.nationality ? "Confirmed" : r.phone_country ? "Phone number" : "",
      "Name origin (estimate)": r.name_origin || "", Category: r.tier, "Value band": r.value_band, Units: r.total_units, "Units priced": r.priced_units,
      "Est. value (AED)": Number(r.est_value), Communities: r.communities, "Main community": r.top_community, "Main project": r.top_project, Profile: r.tags,
      Status: r.do_not_call ? "Do not call" : r.status ? OUTCOME_LABEL[r.status] || r.status : "Not contacted", Contacts: r.contact_count,
      "Last contact": r.last_contact_at ? dateTime(r.last_contact_at) : "", "Next follow-up": r.next_follow_up_at ? dateTime(r.next_follow_up_at) : "",
      "Handled by": r.handled_by || "",
    })));
    ws["!cols"] = [{ wch: 11 }, { wch: 34 }, { wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, "Investors");
    name = "S&Co Investors";
  }
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name} ${stamp}.xlsx"`,
    },
  });
}
