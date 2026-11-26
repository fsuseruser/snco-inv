// Name matching used to merge spellings of the same person.
const SYN: Record<string, string> = {
  mohammed: "mohamed", muhammad: "mohamed", mohammad: "mohamed", mohamad: "mohamed", muhammed: "mohamed", mohd: "mohamed",
  ahmad: "ahmed", abdulla: "abdullah", abdalla: "abdullah", abdallah: "abdullah",
};
const SKIP = new Set(["mr", "mrs", "ms", "dr", "eng", "al", "el", "bin", "bint", "bn", "abu", "and"]);

export function cleanName(raw: string | null | undefined) {
  let n = String(raw ?? "").replace(/ /g, " ").replace(/•/g, "");
  n = n.split(/\s+c\/o\s+|\s*\/\s*po\s*box|\s+-\s+managed by/i)[0];
  n = n.split(/\s\/\s*\d/)[0];
  n = n.replace(/\s+/g, " ").replace(/^[\s.,\-/]+|[\s.,\-/]+$/g, "");
  return n;
}

export function prettyName(n: string) {
  return n
    .split(" ")
    .map((w) => {
      const letters = w.replace(/[^A-Za-z]/g, "");
      if ((w === w.toUpperCase() || w === w.toLowerCase()) && letters.length > 1 && !/^([A-Z]\.)+$/.test(w)) {
        return w.split("-").map((x) => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase()).join("-");
      }
      return w;
    })
    .join(" ");
}

export function normName(n: string) {
  return n.toLowerCase().replace(/\b(mr|mrs|ms|miss|dr|eng|engr|sheikh|shaikh|sh)\.?\s+/g, "").replace(/[^a-z؀-ۿ]/g, "");
}

export function nameTokens(n: string) {
  const s = n.split(/[&/]/)[0].toLowerCase().replace(/\b(al|el)[\s-]+(?=[a-z])/g, "al");
  return (s.match(/[a-z]+/g) || [])
    .map((x) => (x.startsWith("al") && x.length > 5 ? x.slice(2) : x))
    .map((x) => SYN[x] || x)
    .filter((x) => !SKIP.has(x));
}

function ratio(a: string, b: string) {
  // similarity in [0,1] based on Levenshtein distance
  if (a === b) return 1;
  const m = a.length, n = b.length;
  const d = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return 1 - d[n] / Math.max(m, n);
}

/** Likely the same person, given they already share a phone number. */
export function similarNames(a: string, b: string) {
  if (!a || !b) return true;
  const na = normName(a), nb = normName(b);
  if (na && nb && (na.includes(nb) || nb.includes(na))) return true;
  const ta = nameTokens(a), tb = nameTokens(b);
  if (!ta.length || !tb.length) return false;
  if (ta[0] !== tb[0] && ratio(ta[0], tb[0]) < 0.8) return false;
  const sa = new Set(ta), sb = new Set(tb);
  const common = [...sa].filter((x) => sb.has(x)).length;
  return common >= 2 || sa.size === 1 || sb.size === 1;
}
