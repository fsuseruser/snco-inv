"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone, MessageCircle, Lock, LockOpen, UserCheck, Loader2, X, Ban } from "lucide-react";
import { OUTCOMES, type OutcomeKey } from "@/lib/outcomes";
import { fillTemplate } from "@/lib/templates";
import { useToast } from "@/components/Toast";
import { logCall, addNote, logWhatsApp, setNationality, reassign, clearDoNotCall } from "../actions";

type PhoneInfo = { e164: string; label: string; country: string | null };
type Props = {
  investor: {
    id: number; name: string; phones: PhoneInfo[]; badPhones: string[]; doNotCall: boolean; assignedTo: number | null;
    assignee: string | null; assignedAt: string | null; topProject: string | null; topCommunity: string | null; units: number;
    nationality: string | null; nextFollowUp: string | null;
  };
  me: { id: number; name: string; phone: string | null; isAdmin: boolean };
  templates: { id: number; name: string; body: string }[];
  agents: { id: number; name: string }[];
  countries: { code: string; name: string }[];
};

const TZ = "Asia/Dubai";
function localParts(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(d).map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, hour: +p.hour };
}
function quickDates() {
  const now = new Date();
  const { date: today, hour } = localParts(now);
  const plus = (days: number) => localParts(new Date(now.getTime() + days * 864e5)).date;
  const out: { label: string; value: string }[] = [];
  if (hour < 17) out.push({ label: "Later today", value: `${today}T${String(Math.min(hour + 3, 19)).padStart(2, "0")}:00` });
  out.push({ label: "Tomorrow", value: `${plus(1)}T10:00` });
  out.push({ label: "In 3 days", value: `${plus(3)}T10:00` });
  out.push({ label: "Next week", value: `${plus(7)}T10:00` });
  return out;
}
const prettyLocal = (v: string) => {
  const [d, t] = v.split("T");
  const date = new Date(`${d}T12:00:00Z`);
  return `${date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}, ${t}`;
};

export default function ContactPanel({ investor: inv, me, templates, agents, countries }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [outcome, setOutcome] = useState<OutcomeKey | null>(null);
  const [follow, setFollow] = useState("");
  const [picking, setPicking] = useState(false);
  const [note, setNote] = useState("");
  const usable = inv.phones.filter((p) => !inv.badPhones.includes(p.e164));
  const [phone, setPhone] = useState(usable[0]?.e164 || inv.phones[0]?.e164 || "");
  const [calling, setCalling] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const quick = useMemo(quickDates, []);

  const lockedByOther = !!inv.assignedTo && inv.assignedTo !== me.id;
  const readOnly = lockedByOther && !me.isAdmin;
  const blocked = inv.doNotCall && !me.isAdmin;
  const selected = OUTCOMES.find((o) => o.key === outcome);

  const done = (res: { ok?: boolean; error?: string }, msg: string) => {
    if (res.error) return toast(res.error, true);
    toast(msg);
    router.refresh();
  };

  const save = () =>
    start(async () => {
      if (outcome) {
        const res = await logCall({ investorId: inv.id, outcome, note, followUp: selected?.followUp ? follow : "", phone });
        if (!res.error) { setOutcome(null); setFollow(""); setNote(""); setCalling(false); setPicking(false); }
        done(res, "Call saved");
      } else if (note.trim()) {
        const res = await addNote({ investorId: inv.id, note });
        if (!res.error) setNote("");
        done(res, "Note saved");
      }
    });

  const startCall = (p: string) => {
    setPhone(p);
    setCalling(true);
    setTimeout(() => logRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
  };

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2>Contact</h2>
          <div className="spacer" />
          {inv.nextFollowUp && <span className="pill champ plain">Follow up {new Date(inv.nextFollowUp).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TZ })}</span>}
        </div>
        <div className="card-body stack">
          {lockedByOther ? (
            <div className="lock-note"><Lock /><div><b>{inv.assignee}</b> is handling this investor.{readOnly ? " You can view the portfolio and history." : " As admin you can still log activity or reassign below."}</div></div>
          ) : inv.assignedTo === me.id ? (
            <div className="lock-note mine"><UserCheck /><div>You&apos;re handling this investor. Others can see them but can&apos;t contact them.</div></div>
          ) : (
            <div className="lock-note"><LockOpen /><div>Not handled yet. Your first call or message assigns this investor to you.</div></div>
          )}

          {inv.doNotCall ? (
            <div className="lock-note" style={{ background: "var(--ink)", color: "#fff" }}>
              <Ban style={{ color: "#fff" }} />
              <div>
                Asked not to be contacted.{me.isAdmin ? "" : " Numbers are hidden."}
                {me.isAdmin && (
                  <button className="btn btn-sm btn-secondary" style={{ marginTop: 8 }} disabled={pending} onClick={() => start(async () => done(await clearDoNotCall(inv.id), "Do-not-call removed"))}>
                    Remove do-not-call
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {!blocked && (
            <div>
              {inv.phones.length === 0 && <div className="small faint">No phone number on file.</div>}
              {inv.phones.map((p) => {
                const bad = inv.badPhones.includes(p.e164);
                return (
                  <div key={p.e164} className="phone-line">
                    <div className={`p ${bad ? "bad" : ""}`}>{p.label}{bad && <span className="xs faint" style={{ textDecoration: "none", marginLeft: 6 }}>wrong number</span>}</div>
                    {!readOnly && !bad && (
                      <>
                        <a className="btn btn-sm btn-primary" href={`tel:${p.e164}`} onClick={() => startCall(p.e164)}><Phone />Call</a>
                        <button className="btn btn-sm btn-wa btn-icon" title="WhatsApp" aria-label={`WhatsApp ${p.label}`} onClick={() => { setPhone(p.e164); setWaOpen(true); }}><MessageCircle /></button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {!readOnly && !blocked && usable.length > 0 && (
            <button className="btn btn-wa btn-block" onClick={() => setWaOpen(true)}><MessageCircle />Send WhatsApp</button>
          )}
        </div>
      </div>

      {!readOnly && (
        <div className="card" ref={logRef} style={calling ? { borderColor: "var(--champ)", boxShadow: "0 0 0 4px rgba(217,174,122,.18)" } : undefined}>
          <div className="card-head">
            <h2>{calling ? "How did the call go?" : "Log a call"}</h2>
          </div>
          <fieldset className="card-body stack" disabled={pending || blocked} style={{ border: 0, margin: 0, minWidth: 0 }}>
            {usable.length > 1 && (
              <label className="row small">
                <span className="muted nowrap">Number</span>
                <select className="select sm" value={phone} onChange={(e) => setPhone(e.target.value)}>
                  {usable.map((p) => <option key={p.e164} value={p.e164}>{p.label}</option>)}
                </select>
              </label>
            )}
            <div className="chips">
              {OUTCOMES.map((o) => (
                <button key={o.key} type="button" className={`chip sm ${outcome === o.key ? "on" : ""}`} onClick={() => setOutcome(outcome === o.key ? null : o.key)} aria-pressed={outcome === o.key}>
                  <span className={`dot ${o.tone}`} />{o.label}
                </button>
              ))}
            </div>
            {selected?.followUp && (
              <div className="stack" style={{ gap: 8 }}>
                <div className="label">Follow up</div>
                <div className="chips">
                  {quick.map((q) => (
                    <button key={q.label} type="button" className={`chip sm ${follow === q.value && !picking ? "on" : ""}`} onClick={() => { setFollow(q.value); setPicking(false); }}>{q.label}</button>
                  ))}
                  <button type="button" className={`chip sm ${picking ? "on" : ""}`} onClick={() => setPicking(true)}>Pick a date</button>
                </div>
                {picking && <input className="input sm" type="datetime-local" value={follow} onChange={(e) => setFollow(e.target.value)} />}
                {follow && <div className="xs faint">{prettyLocal(follow)}</div>}
              </div>
            )}
            <textarea className="textarea" rows={3} placeholder={outcome ? "Add a note (optional)" : "Write a note"} value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="row">
              {(outcome || note) && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOutcome(null); setNote(""); setFollow(""); setCalling(false); }}>Clear</button>}
              <div className="spacer" />
              <button type="button" className="btn btn-primary" disabled={(!outcome && !note.trim()) || (selected?.followUp && !follow && outcome === "call_back") || pending} onClick={save}>
                {pending && <Loader2 className="spin" />}
                {outcome ? "Save call" : "Save note"}
              </button>
            </div>
            {outcome === "call_back" && !follow && <div className="xs faint" style={{ textAlign: "right", marginTop: -4 }}>Choose when to call back</div>}
          </fieldset>
        </div>
      )}

      <div className="card">
        <div className="card-body stack" style={{ gap: 14 }}>
          <label className="field">
            <span className="label">Confirmed nationality</span>
            <select className="select sm" disabled={readOnly || pending} value={inv.nationality || ""} onChange={(e) => start(async () => done(await setNationality({ investorId: inv.id, country: e.target.value }), "Nationality saved"))}>
              <option value="">Not confirmed</option>
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </label>
          {me.isAdmin && (
            <label className="field">
              <span className="label">Handled by</span>
              <select className="select sm" disabled={pending} value={inv.assignedTo ?? ""} onChange={(e) => start(async () => done(await reassign({ investorId: inv.id, userId: e.target.value ? Number(e.target.value) : null }), "Updated"))}>
                <option value="">Nobody (open to everyone)</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
          )}
        </div>
      </div>

      {waOpen && (
        <WhatsAppModal
          investor={inv}
          phones={usable}
          initialPhone={usable.some((p) => p.e164 === phone) ? phone : usable[0]?.e164}
          templates={templates}
          me={me}
          onClose={() => setWaOpen(false)}
          onSent={() => { setWaOpen(false); toast("WhatsApp opened and logged"); router.refresh(); }}
          onError={(m) => toast(m, true)}
        />
      )}
    </>
  );
}

function WhatsAppModal({
  investor, phones, initialPhone, templates, me, onClose, onSent, onError,
}: {
  investor: Props["investor"]; phones: PhoneInfo[]; initialPhone?: string; templates: Props["templates"]; me: Props["me"];
  onClose: () => void; onSent: () => void; onError: (m: string) => void;
}) {
  const [phone, setPhone] = useState(initialPhone || "");
  const [tpl, setTpl] = useState<number | null>(templates[0]?.id ?? null);
  const fill = (body: string) =>
    fillTemplate(body, {
      investorName: investor.name, agentName: me.name, agentPhone: me.phone, topProject: investor.topProject,
      topCommunity: investor.topCommunity, units: investor.units,
    });
  const [text, setText] = useState(templates[0] ? fill(templates[0].body) : "");
  const [busy, setBusy] = useState(false);
  const choose = (id: number) => {
    setTpl(id);
    const t = templates.find((x) => x.id === id);
    if (t) setText(fill(t.body));
  };

  const send = async () => {
    if (!phone || !text.trim()) return;
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const digits = phone.replace(/\D/g, "");
    const url = mobile
      ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
      : `https://web.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(text)}`;
    const win = window.open("", "sco-whatsapp");
    setBusy(true);
    const res = await logWhatsApp({ investorId: investor.id, phone, template: templates.find((t) => t.id === tpl)?.name || "Custom", message: text });
    setBusy(false);
    if (res.error) { win?.close(); return onError(res.error); }
    if (win) { win.opener = null; win.location.href = url; }
    else window.location.href = url;
    onSent();
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-label="Send WhatsApp">
        <div className="modal-head">
          <h2>WhatsApp {investor.name.split(" ")[0]}</h2>
          <div className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <div className="modal-body">
          <div className="wa-grid">
            <div className="stack">
              {phones.length > 1 && (
                <label className="field">
                  <span className="label">Send to</span>
                  <select className="select sm" value={phone} onChange={(e) => setPhone(e.target.value)}>
                    {phones.map((p) => <option key={p.e164} value={p.e164}>{p.label}</option>)}
                  </select>
                </label>
              )}
              <div className="label">Template</div>
              <div className="tpl-list">
                {templates.map((t) => (
                  <button key={t.id} type="button" className={`tpl ${tpl === t.id ? "on" : ""}`} onClick={() => choose(t.id)}>
                    <div className="nm">{t.name}</div>
                    <div className="pv">{fill(t.body)}</div>
                  </button>
                ))}
                {!templates.length && <div className="small faint">No templates yet. An admin can add them under Admin → Templates.</div>}
              </div>
            </div>
            <div className="stack">
              <div className="label">Message <span className="faint" style={{ fontWeight: 400 }}>· you can edit it</span></div>
              <div className="wa-preview">
                <div className="wa-bubble">
                  <textarea value={text} onChange={(e) => setText(e.target.value)} aria-label="Message" />
                  <span className="tick">✓✓</span>
                </div>
              </div>
              <div className="xs faint">Opens WhatsApp with this message ready. Press send there.</div>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!phone || !text.trim() || busy} onClick={send}>
            {busy ? <Loader2 className="spin" /> : <MessageCircle />}Open WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
