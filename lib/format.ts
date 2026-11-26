export const TZ = process.env.APP_TIMEZONE || process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Dubai";

export function aed(n: number | null | undefined, opts: { short?: boolean } = {}) {
  if (n === null || n === undefined || !isFinite(n) || n === 0) return "—";
  if (opts.short) {
    if (n >= 1e9) return `AED ${(n / 1e9).toFixed(n >= 1e10 ? 1 : 2).replace(/\.0+$/, "")}B`;
    if (n >= 1e6) return `AED ${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1).replace(/\.0$/, "")}M`;
    if (n >= 1e3) return `AED ${Math.round(n / 1e3)}K`;
  }
  return `AED ${Math.round(n).toLocaleString("en-US")}`;
}

export const num = (n: number | null | undefined) => (n ?? 0).toLocaleString("en-US");

export function dateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(d));
}

export function shortDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short" }).format(new Date(d));
}

export function time(d: Date | string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(d));
}

export function relative(d: Date | string | null | undefined) {
  if (!d) return "—";
  const t = new Date(d).getTime();
  const diff = Date.now() - t;
  const abs = Math.abs(diff);
  const future = diff < 0;
  const m = Math.round(abs / 60000);
  if (m < 1) return "just now";
  if (m < 60) return future ? `in ${m} min` : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return future ? `in ${h} h` : `${h} h ago`;
  const days = Math.round(h / 24);
  if (days === 1) return future ? "tomorrow" : "yesterday";
  if (days < 7) return future ? `in ${days} days` : `${days} days ago`;
  return shortDate(d);
}

export function dayKey(d: Date | string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(d));
}

export function initials(name: string | null | undefined, email?: string) {
  const s = (name || email || "?").trim();
  const parts = s.split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function device(ua: string | null | undefined) {
  if (!ua) return "Unknown device";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Other";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${br} on ${os}`;
}

export const BEDROOM_LABEL = ["Studio", "1 BR", "2 BR", "3 BR", "4 BR", "5+ BR"];

/** Offset of the app time zone from UTC at a given moment, in minutes. */
function tzOffset(at: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(at).map((x) => [x.type, x.value]),
  );
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUTC - at.getTime()) / 60000);
}

/** Start of the local day (in the app time zone) `daysFromToday` days from now, as a real Date. */
export function localDayStart(daysFromToday = 0) {
  const now = new Date();
  const local = new Date(now.getTime() + tzOffset(now) * 60000);
  const startLocalAsUTC = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + daysFromToday);
  const guess = new Date(startLocalAsUTC);
  return new Date(startLocalAsUTC - tzOffset(guess) * 60000);
}

/** Converts a local "YYYY-MM-DDTHH:mm" (app time zone) into a Date. */
export function fromLocalInput(v: string) {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/);
  if (!m) return null;
  const asUTC = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 10), +(m[5] ?? 0));
  return new Date(asUTC - tzOffset(new Date(asUTC)) * 60000);
}
