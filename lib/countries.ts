const CODES =
  "AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NZ OM PA PE PG PH PK PL PS PT PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS SV SY SZ TD TG TH TJ TL TM TN TO TR TT TW TZ UA UG US UY UZ VA VC VE VN YE ZA ZM ZW".split(
    " ",
  );

const names = new Intl.DisplayNames(["en"], { type: "region" });

export const COUNTRIES = CODES.map((code) => ({ code, name: names.of(code) || code })).sort((a, b) =>
  a.name.localeCompare(b.name),
);

const lookup = new Map<string, string>();
for (const c of COUNTRIES) {
  lookup.set(c.code.toLowerCase(), c.code);
  lookup.set(c.name.toLowerCase(), c.code);
}
const EXTRA: Record<string, string> = {
  uae: "AE", emirati: "AE", emirates: "AE", "united arab emirates": "AE", uk: "GB", british: "GB", england: "GB",
  usa: "US", american: "US", "united states of america": "US", russia: "RU", russian: "RU", indian: "IN", pakistani: "PK",
  chinese: "CN", egyptian: "EG", jordanian: "JO", lebanese: "LB", syrian: "SY", palestinian: "PS", saudi: "SA", "saudi arabia": "SA",
  iranian: "IR", iran: "IR", filipino: "PH", philippines: "PH", korea: "KR", "south korea": "KR", turkish: "TR", turkey: "TR",
  german: "DE", french: "FR", italian: "IT", canadian: "CA", australian: "AU", kazakh: "KZ", ukrainian: "UA",
};

export function countryCode(input: string | null | undefined): string | null {
  if (!input) return null;
  const k = String(input).trim().toLowerCase();
  return lookup.get(k) || EXTRA[k] || null;
}
