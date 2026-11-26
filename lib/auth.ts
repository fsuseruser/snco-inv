import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "crypto";
import { cache } from "react";
import { sql } from "./db";

export const SESSION_COOKIE = "sco_session";
const SHORT_SESSION_HOURS = 12;
const LONG_SESSION_DAYS = 30;

export type User = {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  role: "admin" | "agent";
  must_change_password: boolean;
};

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function requestInfo() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || h.get("x-real-ip") || "").split(",")[0].trim() || null;
  const ua = h.get("user-agent")?.slice(0, 400) || null;
  return { ip, ua };
}

export async function createSession(userId: number, remember: boolean) {
  const token = randomBytes(32).toString("base64url");
  const { ip, ua } = await requestInfo();
  const ms = remember ? LONG_SESSION_DAYS * 864e5 : SHORT_SESSION_HOURS * 36e5;
  const expires = new Date(Date.now() + ms);
  await sql`insert into sessions (id, user_id, expires_at, ip, user_agent)
            values (${hash(token)}, ${userId}, ${expires}, ${ip}, ${ua})`;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { expires } : {}),
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await sql`delete from sessions where id = ${hash(token)}`;
  jar.delete(SESSION_COOKIE);
}

export const getUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const id = hash(token);
  const rows = await sql<(User & { last_seen_at: Date })[]>`
    select u.id, u.email, u.name, u.phone, u.role, u.must_change_password, s.last_seen_at
    from sessions s join users u on u.id = s.user_id
    where s.id = ${id} and s.expires_at > now() and u.active`;
  const u = rows[0];
  if (!u) return null;
  // keep "online now" fresh without writing on every request
  if (Date.now() - new Date(u.last_seen_at).getTime() > 2 * 60 * 1000) {
    await sql`update sessions set last_seen_at = now() where id = ${id}`;
    await sql`update users set last_seen_at = now() where id = ${u.id}`;
  }
  const { last_seen_at: _ignored, ...user } = u;
  return user;
});

/** For pages: returns the user or redirects to sign-in / account setup. */
export async function requireUser(opts: { allowSetup?: boolean } = {}) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.must_change_password && !opts.allowSetup) redirect("/welcome");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

/** For server actions: throws instead of redirecting. */
export async function actionUser(admin = false) {
  const user = await getUser();
  if (!user || user.must_change_password) throw new Error("Your session has ended. Please sign in again.");
  if (admin && user.role !== "admin") throw new Error("Only admins can do this.");
  return user;
}

export function tempPassword() {
  // readable, no look-alike characters: e.g. "Kite-4827-Mora"
  const words = ["Amber", "Atlas", "Birch", "Cedar", "Coral", "Dune", "Ember", "Falcon", "Harbor", "Iris", "Jade", "Kite", "Lumen", "Maple", "Mora", "Nova", "Onyx", "Pearl", "Quill", "Reef", "Sable", "Tide", "Vale", "Willow"];
  const pick = () => words[randomBytes(1)[0] % words.length];
  const num = 1000 + (randomBytes(2).readUInt16BE(0) % 9000);
  return `${pick()}-${num}-${pick()}`;
}
