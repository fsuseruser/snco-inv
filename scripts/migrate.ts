// Creates/updates tables and seeds the first admin, default settings and WhatsApp templates.
// Runs automatically before every build (see package.json), so a Vercel deploy sets up the database.
import bcrypt from "bcryptjs";
import { schema } from "../lib/schema";
import { DEFAULT_TEMPLATES } from "../lib/templates";

async function main() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    console.warn("[migrate] DATABASE_URL not set; skipping database setup.");
    return;
  }
  const { sql } = await import("../lib/db");
  await sql.unsafe(schema);

  await sql`insert into settings (key, value) values ('agent_scope', 'all') on conflict (key) do nothing`;

  const [{ n: templates }] = await sql`select count(*)::int as n from templates`;
  if (templates === 0) {
    let sort = 0;
    for (const t of DEFAULT_TEMPLATES) {
      await sql`insert into templates (name, body, sort) values (${t.name}, ${t.body}, ${sort++})`;
    }
    console.log(`[migrate] added ${DEFAULT_TEMPLATES.length} WhatsApp templates`);
  }

  const [{ n: users }] = await sql`select count(*)::int as n from users`;
  if (users === 0) {
    const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || "";
    if (email && password) {
      const hash = await bcrypt.hash(password, 10);
      await sql`insert into users (email, name, role, password_hash, must_change_password)
                values (${email}, 'Administrator', 'admin', ${hash}, true)`;
      console.log(`[migrate] created admin ${email}`);
    } else {
      console.warn("[migrate] no users yet: set ADMIN_EMAIL and ADMIN_PASSWORD to create the first admin.");
    }
  }
  console.log("[migrate] database ready");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
