import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import TeamClient, { type Member } from "./TeamClient";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const me = await requireAdmin();
  const members = await sql<Member[]>`
    select u.id, u.email, u.name, u.role, u.active, u.must_change_password, u.created_at, u.last_login_at, u.last_seen_at,
      (select count(*)::int from investors i where i.assigned_to = u.id) handled,
      (select count(*)::int from activities a where a.user_id = u.id and a.type = 'call' and a.created_at > now() - interval '30 days') calls30
    from users u order by u.active desc, u.role, coalesce(u.name, u.email)`;
  return <TeamClient members={JSON.parse(JSON.stringify(members))} meId={me.id} />;
}
