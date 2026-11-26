export type OutcomeKey =
  | "no_answer"
  | "busy"
  | "call_back"
  | "interested"
  | "meeting"
  | "not_interested"
  | "wrong_number"
  | "do_not_call";

export const OUTCOMES: { key: OutcomeKey; label: string; tone: string; followUp?: boolean }[] = [
  { key: "no_answer", label: "No answer", tone: "grey" },
  { key: "busy", label: "Busy", tone: "grey" },
  { key: "call_back", label: "Call back", tone: "amber", followUp: true },
  { key: "interested", label: "Interested", tone: "green", followUp: true },
  { key: "meeting", label: "Meeting set", tone: "champ", followUp: true },
  { key: "not_interested", label: "Not interested", tone: "red" },
  { key: "wrong_number", label: "Wrong number", tone: "red" },
  { key: "do_not_call", label: "Do not call", tone: "dark" },
];

export const OUTCOME_LABEL: Record<string, string> = { ...Object.fromEntries(OUTCOMES.map((o) => [o.key, o.label])), messaged: "Messaged" };
export const OUTCOME_TONE: Record<string, string> = { ...Object.fromEntries(OUTCOMES.map((o) => [o.key, o.tone])), messaged: "blue" };

export const STATUS_FILTERS = [
  { key: "new", label: "Not contacted" },
  { key: "followup", label: "Follow-up due" },
  { key: "messaged", label: "Messaged only" },
  ...OUTCOMES.map((o) => ({ key: o.key, label: o.label })),
];

export const ACTIVITY_LABEL: Record<string, string> = {
  call: "Call",
  whatsapp: "WhatsApp",
  note: "Note",
  assign: "Allocation",
  nationality: "Nationality",
  dnc_cleared: "Do-not-call removed",
};
