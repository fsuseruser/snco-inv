"use server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { actionUser, type User } from "@/lib/auth";
import { OUTCOMES, type OutcomeKey } from "@/lib/outcomes";
import { fromLocalInput } from "@/lib/format";
import { countryCode } from "@/lib/countries";

export type Result = { ok?: boolean; error?: string };
import type { TransactionSql } from "postgres";
type Tx = TransactionSql<{}>;

async function claim(tx: Tx, investorId: number, user: User) {
  const [inv] = await tx<{ assigned_to: number | null; assignee: string | null; do_not_call: boolean }[]>`
    select i.assigned_to, coalesce(u.name, u.email) as assignee, i.do_not_call
    from investors i left join users u on u.id = i.assigned_to where i.id = ${investorId} for update of i`;
  if (!inv) throw new Error("Investor not found.");
  if (inv.assigned_to && inv.assigned_to !== user.id && user.role !== "admin") {
    throw new Error(`${inv.assignee} is handling this investor.`);
  }
  if (!inv.assigned_to) {
    await tx`update investors set assigned_to = ${user.id}, assigned_at = now() where id = ${investorId}`;
  }
  return inv;
}

async function run(fn: (user: User) => Promise<void>, investorId: number): Promise<Result> {
  try {
    const user = await actionUser();
    await fn(user);
    revalidatePath(`/investors/${investorId}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function logCall(input: { investorId: number; outcome: OutcomeKey; note?: string; followUp?: string; phone?: string }): Promise<Result> {
  const o = OUTCOMES.find((x) => x.key === input.outcome);
  if (!o) return { error: "Choose how the call went." };
  const follow = o.followUp && input.followUp ? fromLocalInput(input.followUp) : null;
  const note = input.note?.trim().slice(0, 4000) || null;
  return run(async (user) => {
    await sql.begin(async (tx) => {
      const inv = await claim(tx, input.investorId, user);
      if (inv.do_not_call && user.role !== "admin") throw new Error("This investor asked not to be called.");
      await tx`insert into activities (investor_id, user_id, type, outcome, note, follow_up_at, phone)
               values (${input.investorId}, ${user.id}, 'call', ${o.key}, ${note}, ${follow}, ${input.phone || null})`;
      await tx`update investors set status = ${o.key}, last_contact_at = now(), last_contact_by = ${user.id},
                 contact_count = contact_count + 1, next_follow_up_at = ${follow},
                 do_not_call = do_not_call or ${o.key === "do_not_call"},
                 bad_phones = case when ${o.key === "wrong_number"} and ${input.phone || null}::text is not null
                                   then array(select distinct unnest(bad_phones || array[${input.phone || ""}::text])) else bad_phones end,
                 updated_at = now()
               where id = ${input.investorId}`;
    });
  }, input.investorId);
}

export async function addNote(input: { investorId: number; note: string }): Promise<Result> {
  const note = input.note.trim().slice(0, 4000);
  if (!note) return { error: "Write a note first." };
  return run(async (user) => {
    await sql.begin(async (tx) => {
      await claim(tx, input.investorId, user);
      await tx`insert into activities (investor_id, user_id, type, note) values (${input.investorId}, ${user.id}, 'note', ${note})`;
      await tx`update investors set updated_at = now() where id = ${input.investorId}`;
    });
  }, input.investorId);
}

export async function logWhatsApp(input: { investorId: number; phone: string; template: string; message: string }): Promise<Result> {
  return run(async (user) => {
    await sql.begin(async (tx) => {
      const inv = await claim(tx, input.investorId, user);
      if (inv.do_not_call && user.role !== "admin") throw new Error("This investor asked not to be contacted.");
      await tx`insert into activities (investor_id, user_id, type, phone, template_name, message)
               values (${input.investorId}, ${user.id}, 'whatsapp', ${input.phone}, ${input.template}, ${input.message.slice(0, 4000)})`;
      await tx`update investors set last_contact_at = now(), last_contact_by = ${user.id}, contact_count = contact_count + 1,
                 status = coalesce(status, 'messaged'), updated_at = now()
               where id = ${input.investorId}`;
    });
  }, input.investorId);
}

export async function setNationality(input: { investorId: number; country: string }): Promise<Result> {
  const code = input.country ? countryCode(input.country) : null;
  return run(async (user) => {
    await sql.begin(async (tx) => {
      const [inv] = await tx<{ assigned_to: number | null }[]>`select assigned_to from investors where id = ${input.investorId}`;
      if (inv?.assigned_to && inv.assigned_to !== user.id && user.role !== "admin") throw new Error("Only the person handling this investor can change this.");
      await tx`update investors set nationality = ${code}, updated_at = now() where id = ${input.investorId}`;
      await tx`insert into activities (investor_id, user_id, type, note)
               values (${input.investorId}, ${user.id}, 'nationality', ${code ? `Nationality confirmed: ${code}` : "Nationality cleared"})`;
    });
  }, input.investorId);
}

export async function reassign(input: { investorId: number; userId: number | null }): Promise<Result> {
  return run(async (user) => {
    if (user.role !== "admin") throw new Error("Only admins can reassign.");
    const [to] = input.userId ? await sql<{ name: string }[]>`select coalesce(name, email) as name from users where id = ${input.userId}` : [];
    await sql.begin(async (tx) => {
      await tx`update investors set assigned_to = ${input.userId}, assigned_at = ${input.userId ? new Date() : null} where id = ${input.investorId}`;
      await tx`insert into activities (investor_id, user_id, type, note)
               values (${input.investorId}, ${user.id}, 'assign', ${to ? `Assigned to ${to.name}` : "Unlocked: open to everyone"})`;
    });
  }, input.investorId);
}

export async function clearDoNotCall(investorId: number): Promise<Result> {
  return run(async (user) => {
    if (user.role !== "admin") throw new Error("Only admins can do this.");
    await sql`update investors set do_not_call = false where id = ${investorId}`;
    await sql`insert into activities (investor_id, user_id, type, note) values (${investorId}, ${user.id}, 'dnc_cleared', 'Do-not-call removed')`;
  }, investorId);
}
