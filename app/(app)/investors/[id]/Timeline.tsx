import { Phone, MessageCircle, StickyNote, UserCheck, Flag, CalendarClock } from "lucide-react";
import { dateTime, relative } from "@/lib/format";
import { formatPhone } from "@/lib/classify";
import { OUTCOME_LABEL, OUTCOME_TONE } from "@/lib/outcomes";

export type Activity = {
  id: number; type: string; outcome: string | null; note: string | null; follow_up_at: Date | null; phone: string | null;
  template_name: string | null; message: string | null; created_at: Date; user_name: string | null; user_id: number | null;
};

const ICON: Record<string, React.ReactNode> = {
  call: <Phone />, whatsapp: <MessageCircle />, note: <StickyNote />, assign: <UserCheck />, nationality: <Flag />, dnc_cleared: <Flag />,
};

export default function Timeline({ items }: { items: Activity[] }) {
  if (!items.length) {
    return <div className="small faint" style={{ padding: "8px 0" }}>No contact yet. Calls, messages and notes will appear here.</div>;
  }
  return (
    <div className="timeline">
      {items.map((a) => (
        <div key={a.id} className="tl-item">
          <div className={`tl-icon ${a.type === "whatsapp" ? "wa" : a.type === "call" ? "call" : ""}`}>{ICON[a.type] || <StickyNote />}</div>
          <div className="tl-body">
            <div className="h">
              <span className="strong">
                {a.type === "call" ? "Call" : a.type === "whatsapp" ? "WhatsApp" : a.type === "note" ? "Note" : a.note}
              </span>
              {a.outcome && <span className={`pill ${OUTCOME_TONE[a.outcome] || "grey"}`}>{OUTCOME_LABEL[a.outcome]}</span>}
              {a.template_name && <span className="pill outline plain">{a.template_name}</span>}
            </div>
            <div className="t" title={dateTime(a.created_at)}>
              {a.user_name || "Someone"} · {relative(a.created_at)}
              {a.phone ? ` · ${formatPhone(a.phone)}` : ""}
            </div>
            {a.follow_up_at && (
              <div className="xs" style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 5, color: "var(--champ-ink)" }}>
                <CalendarClock size={13} /> Follow up {dateTime(a.follow_up_at)}
              </div>
            )}
            {a.note && (a.type === "call" || a.type === "note") && <div className="note">{a.note}</div>}
            {a.message && <div className="msg">{a.message}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
