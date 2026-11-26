import { OUTCOME_LABEL, OUTCOME_TONE } from "@/lib/outcomes";

export default function StatusPill({ status, dnc }: { status: string | null; dnc?: boolean }) {
  if (dnc) return <span className="pill dark">Do not call</span>;
  if (!status) return <span className="pill grey plain">Not contacted</span>;
  return <span className={`pill ${OUTCOME_TONE[status] || "grey"}`}>{OUTCOME_LABEL[status] || status}</span>;
}
