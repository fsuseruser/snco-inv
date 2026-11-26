"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { createSession, destroySession, getUser, requestInfo } from "@/lib/auth";

export type FormState = { error?: string; ok?: string } | undefined;

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const remember = form.get("remember") === "on";
  if (!email || !password) return { error: "Enter your email and password." };
  const { ip, ua } = await requestInfo();

  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int n from login_events
    where lower(email) = ${email} and not success and created_at > now() - interval '15 minutes'`;
  if (n >= 8) return { error: "Too many attempts. Please wait 15 minutes and try again." };

  const [user] = await sql<{ id: number; password_hash: string; active: boolean; must_change_password: boolean }[]>`
    select id, password_hash, active, must_change_password from users where lower(email) = ${email}`;
  const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!user || !ok || !user.active) {
    await sql`insert into login_events (user_id, email, success, reason, ip, user_agent)
              values (${user?.id ?? null}, ${email}, false, ${!user ? "Unknown email" : !ok ? "Wrong password" : "Account disabled"}, ${ip}, ${ua})`;
    return { error: user && ok && !user.active ? "This account has been disabled. Contact your admin." : "That email and password don't match." };
  }
  await sql`insert into login_events (user_id, email, success, ip, user_agent) values (${user.id}, ${email}, true, ${ip}, ${ua})`;
  await sql`update users set last_login_at = now(), last_seen_at = now() where id = ${user.id}`;
  await createSession(user.id, remember);
  redirect(user.must_change_password ? "/welcome" : "/");
}

export async function signOut() {
  const user = await getUser();
  if (user) {
    const { ip, ua } = await requestInfo();
    await sql`insert into login_events (user_id, email, event, success, ip, user_agent)
              values (${user.id}, ${user.email}, 'sign_out', true, ${ip}, ${ua})`;
  }
  await destroySession();
  redirect("/login");
}

export async function completeSetup(_: FormState, form: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/login");
  const name = String(form.get("name") || "").trim().replace(/\s+/g, " ");
  const phone = String(form.get("phone") || "").trim();
  const password = String(form.get("password") || "");
  const confirm = String(form.get("confirm") || "");
  if (name.length < 2) return { error: "Enter your full name." };
  if (password.length < 8) return { error: "Use at least 8 characters for your password." };
  if (password !== confirm) return { error: "The passwords don't match." };
  const hash = await bcrypt.hash(password, 10);
  await sql`update users set name = ${name}, phone = ${phone || null}, password_hash = ${hash}, must_change_password = false where id = ${user.id}`;
  const { ip, ua } = await requestInfo();
  await sql`insert into login_events (user_id, email, event, success, ip, user_agent)
            values (${user.id}, ${user.email}, 'account_setup', true, ${ip}, ${ua})`;
  redirect("/");
}

export async function updateProfile(_: FormState, form: FormData): Promise<FormState> {
  const user = await getUser();
  if (!user) redirect("/login");
  const name = String(form.get("name") || "").trim().replace(/\s+/g, " ");
  const phone = String(form.get("phone") || "").trim();
  const current = String(form.get("current") || "");
  const password = String(form.get("password") || "");
  if (name.length < 2) return { error: "Enter your full name." };
  if (password) {
    if (password.length < 8) return { error: "Use at least 8 characters for your new password." };
    const [row] = await sql<{ password_hash: string }[]>`select password_hash from users where id = ${user.id}`;
    if (!(await bcrypt.compare(current, row.password_hash))) return { error: "Your current password is not correct." };
    await sql`update users set password_hash = ${await bcrypt.hash(password, 10)} where id = ${user.id}`;
  }
  await sql`update users set name = ${name}, phone = ${phone || null} where id = ${user.id}`;
  return { ok: password ? "Profile and password updated." : "Profile updated." };
}
