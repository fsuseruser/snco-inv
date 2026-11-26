"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { actionUser, tempPassword } from "@/lib/auth";
import { investorConditions, type Filters } from "@/lib/queries";
import type { PendingQuery, Row } from "postgres";

type R<T = object> = ({ ok: true; error?: undefined } & T) | { ok?: false; error: string };
const fail = (e: unknown) => ({ error: e instanceof Error ? e.message : "Something went wrong." });

/* ---------- team */
export async function createMember(input: { email: string; name?: string; role: "admin" | "agent" }): Promise<R<{ password: string }>> {
  try {
    const admin = await actionUser(true);
    const email = input.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
    const [exists] = await sql`select 1 from users where lower(email) = ${email}`;
    if (exists) return { error: "Someone with this email already has an account." };
    const password = tempPassword();
    await sql`insert into users (email, name, role, password_hash, must_change_password, created_by)
              values (${email}, ${input.name?.trim() || null}, ${input.role === "admin" ? "admin" : "agent"}, ${await bcrypt.hash(password, 10)}, true, ${admin.id})`;
    revalidatePath("/admin/team");
    return { ok: true, password };
  } catch (e) { return fail(e); }
}

export async function resetPassword(userId: number): Promise<R<{ password: string }>> {
  try {
    await actionUser(true);
    const password = tempPassword();
    await sql`update users set password_hash = ${await bcrypt.hash(password, 10)}, must_change_password = true where id = ${userId}`;
    await sql`delete from sessions where user_id = ${userId}`;
    revalidatePath("/admin/team");
    return { ok: true, password };
  } catch (e) { return fail(e); }
}

export async function setActive(userId: number, active: boolean): Promise<R> {
  try {
    const admin = await actionUser(true);
    if (userId === admin.id) return { error: "You can't disable your own account." };
    await sql`update users set active = ${active} where id = ${userId}`;
    if (!active) await sql`delete from sessions where user_id = ${userId}`;
    revalidatePath("/admin/team");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function setRole(userId: number, role: "admin" | "agent"): Promise<R> {
  try {
    const admin = await actionUser(true);
    if (userId === admin.id) return { error: "You can't change your own role." };
    await sql`update users set role = ${role} where id = ${userId}`;
    revalidatePath("/admin/team");
    return { ok: true };
  } catch (e) { return fail(e); }
}

/* ---------- allocation */
export async function setAgentScope(scope: "all" | "allocated"): Promise<R> {
  try {
    await actionUser(true);
    await sql`insert into settings (key, value) values ('agent_scope', ${scope}) on conflict (key) do update set value = excluded.value`;
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) { return fail(e); }
}

type Frag = PendingQuery<Row[]>;
async function allocationWhere(f: Filters, includeHandled: boolean) {
  const admin = await actionUser(true);
  const conds: Frag[] = await investorConditions({ ...f, owner: undefined }, { ...admin, role: "admin" });
  if (!includeHandled) conds.push(sql`i.assigned_to is null`);
  conds.push(sql`not i.do_not_call`);
  return { admin, where: conds.reduce<Frag>((acc, c, i) => (i === 0 ? sql`where ${c}` : sql`${acc} and ${c}`), sql``) };
}

export async function previewAllocation(f: Filters, includeHandled: boolean): Promise<R<{ count: number; value: number }>> {
  try {
    const { where } = await allocationWhere(f, includeHandled);
    const [r] = await sql<{ count: number; value: number }[]>`select count(*)::int count, coalesce(sum(est_value),0)::float8 value from investors i ${where}`;
    return { ok: true, ...r };
  } catch (e) { return fail(e); }
}

export async function allocate(f: Filters, includeHandled: boolean, userId: number, limit: number): Promise<R<{ count: number }>> {
  try {
    const { admin, where } = await allocationWhere(f, includeHandled);
    const [to] = await sql<{ name: string }[]>`select coalesce(name, email) name from users where id = ${userId} and active`;
    if (!to) return { error: "Choose an active team member." };
    const n = Math.max(1, Math.min(5000, Math.floor(limit) || 100));
    const rows = await sql<{ id: number }[]>`
      update investors set assigned_to = ${userId}, assigned_at = now()
      where id in (select i.id from investors i ${where} order by i.est_value desc, i.id limit ${n})
      returning id`;
    if (rows.length) {
      const acts = rows.map((r) => ({ investor_id: r.id, user_id: admin.id, type: "assign", note: `Allocated to ${to.name}` }));
      for (let i = 0; i < acts.length; i += 1000) await sql`insert into activities ${sql(acts.slice(i, i + 1000), "investor_id", "user_id", "type", "note")}`;
    }
    revalidatePath("/admin/allocation");
    return { ok: true, count: rows.length };
  } catch (e) { return fail(e); }
}

export async function release(userId: number, onlyUncontacted: boolean): Promise<R<{ count: number }>> {
  try {
    const admin = await actionUser(true);
    const rows = await sql<{ id: number }[]>`
      update investors set assigned_to = null, assigned_at = null
      where assigned_to = ${userId} ${onlyUncontacted ? sql`and contact_count = 0` : sql``}
      returning id`;
    if (rows.length) {
      const acts = rows.map((r) => ({ investor_id: r.id, user_id: admin.id, type: "assign", note: "Unlocked: open to everyone" }));
      for (let i = 0; i < acts.length; i += 1000) await sql`insert into activities ${sql(acts.slice(i, i + 1000), "investor_id", "user_id", "type", "note")}`;
    }
    revalidatePath("/admin/allocation");
    return { ok: true, count: rows.length };
  } catch (e) { return fail(e); }
}

/* ---------- templates */
export async function saveTemplate(input: { id?: number; name: string; body: string; active: boolean }): Promise<R<{ id: number }>> {
  try {
    await actionUser(true);
    const name = input.name.trim(), body = input.body.trim();
    if (!name || !body) return { error: "A template needs a name and a message." };
    let id = input.id;
    if (id) await sql`update templates set name = ${name}, body = ${body}, active = ${input.active}, updated_at = now() where id = ${id}`;
    else {
      const [r] = await sql<{ id: number }[]>`insert into templates (name, body, active, sort) values (${name}, ${body}, ${input.active}, (select coalesce(max(sort),0)+1 from templates)) returning id`;
      id = r.id;
    }
    revalidatePath("/admin/templates");
    return { ok: true, id: id! };
  } catch (e) { return fail(e); }
}

export async function deleteTemplate(id: number): Promise<R> {
  try {
    await actionUser(true);
    await sql`delete from templates where id = ${id}`;
    revalidatePath("/admin/templates");
    return { ok: true };
  } catch (e) { return fail(e); }
}

export async function moveTemplate(id: number, dir: -1 | 1): Promise<R> {
  try {
    await actionUser(true);
    const list = await sql<{ id: number }[]>`select id from templates order by sort, id`;
    const i = list.findIndex((t) => t.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return { ok: true };
    [list[i], list[j]] = [list[j], list[i]];
    for (let k = 0; k < list.length; k++) await sql`update templates set sort = ${k} where id = ${list[k].id}`;
    revalidatePath("/admin/templates");
    return { ok: true };
  } catch (e) { return fail(e); }
}
