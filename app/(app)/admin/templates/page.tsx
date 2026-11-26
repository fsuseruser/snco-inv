import { sql } from "@/lib/db";
import TemplatesClient from "./TemplatesClient";

export const metadata = { title: "WhatsApp templates" };

export default async function TemplatesPage() {
  const templates = await sql<{ id: number; name: string; body: string; active: boolean }[]>`select id, name, body, active from templates order by sort, id`;
  const [sample] = await sql<{ name: string; top_project: string; top_community: string; total_units: number }[]>`
    select name, top_project, top_community, total_units from investors where total_units > 1 order by est_value desc limit 1`;
  return <TemplatesClient templates={templates} sample={sample ? { name: sample.name, project: sample.top_project, community: sample.top_community, units: sample.total_units } : null} />;
}
