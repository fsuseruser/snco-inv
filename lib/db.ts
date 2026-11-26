import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

declare global {
  // eslint-disable-next-line no-var
  var __sql: Sql | undefined;
}

export function databaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.NEON_DATABASE_URL ||
    ""
  );
}

function create(): Sql {
  const url = databaseUrl();
  if (!url) {
    throw new Error(
      "No database connection string found. In Vercel, open Storage and connect a Neon Postgres database to this project (it adds DATABASE_URL), then redeploy.",
    );
  }
  const local = /localhost|127\.0\.0\.1/.test(url);
  return postgres(url, {
    ssl: local ? false : "require",
    max: local ? 10 : 3,
    idle_timeout: 20,
    prepare: false,
    transform: { undefined: null },
    types: {
      numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      bigint: { to: 20, from: [20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
    },
  });
}

function client(): Sql {
  return (globalThis.__sql ??= create());
}

/** Connects on first use, so the app can build before a database is attached. */
export const sql: Sql = new Proxy(function () {} as unknown as Sql, {
  apply: (_t, _this, args) => (client() as unknown as (...a: unknown[]) => unknown)(...args),
  get: (_t, prop) => {
    const c = client() as unknown as Record<string | symbol, unknown>;
    const v = c[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(c) : v;
  },
}) as Sql;