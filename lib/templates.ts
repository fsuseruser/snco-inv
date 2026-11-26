export const TEMPLATE_VARIABLES = [
  { key: "first_name", label: "First name" },
  { key: "full_name", label: "Full name" },
  { key: "agent_name", label: "Your name" },
  { key: "agent_phone", label: "Your phone" },
  { key: "top_project", label: "Main project" },
  { key: "top_community", label: "Main community" },
  { key: "unit_count", label: "Unit count" },
  { key: "unit_word", label: "property / properties" },
] as const;

export const DEFAULT_TEMPLATES = [
  {
    name: "Introduction",
    body:
      "Hello {first_name}, this is {agent_name} from S&Co. Real Estate in Abu Dhabi.\n\n" +
      "I'm reaching out because you own property in {top_project}. We currently have buyers and tenants looking in {top_community}.\n\n" +
      "Would you be open to a short call about what your {unit_word} could achieve today?",
  },
  {
    name: "Missed call",
    body:
      "Hi {first_name}, {agent_name} from S&Co. Real Estate here. I tried calling you a moment ago about your property in {top_project}.\n\n" +
      "When would be a good time to speak?",
  },
  {
    name: "Free valuation",
    body:
      "Dear {first_name},\n\nPrices in {top_community} have moved this year. I'd be glad to prepare a free, no-obligation valuation of your {unit_word} in {top_project}.\n\n" +
      "Shall I send it over?\n\n{agent_name}\nS&Co. Real Estate",
  },
  {
    name: "After our call",
    body:
      "Hi {first_name}, thank you for your time on the phone today.\n\n" +
      "As discussed, I'll follow up with the details on {top_project}. Feel free to message me here anytime.\n\n{agent_name}\nS&Co. Real Estate · {agent_phone}",
  },
];

export type TemplateContext = {
  investorName: string;
  agentName: string;
  agentPhone?: string | null;
  topProject?: string | null;
  topCommunity?: string | null;
  units: number;
};

const TITLES = /^(mr|mrs|ms|miss|dr|eng|engr|sheikh|shaikh|sh|h\.?e\.?)\.?$/i;

export function firstName(name: string) {
  const parts = name.replace(/[&/].*$/, "").trim().split(/\s+/);
  const first = parts.find((p) => !TITLES.test(p)) || parts[0] || "";
  if (/^unnamed$/i.test(first)) return "";
  return first;
}

export function fillTemplate(body: string, c: TemplateContext) {
  const fn = firstName(c.investorName);
  const map: Record<string, string> = {
    first_name: fn || "there",
    full_name: /^unnamed owner$/i.test(c.investorName) ? "" : c.investorName,
    agent_name: c.agentName || "",
    agent_phone: c.agentPhone || "",
    top_project: c.topProject || "Abu Dhabi",
    top_community: c.topCommunity || "Abu Dhabi",
    unit_count: String(c.units),
    unit_word: c.units === 1 ? "property" : "properties",
  };
  return body
    .replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m))
    .replace(/[ \t]+·[ \t]*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
