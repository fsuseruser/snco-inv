"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowUp, ArrowDown, Trash2, Loader2 } from "lucide-react";
import { saveTemplate, deleteTemplate, moveTemplate } from "../actions";
import { useToast } from "@/components/Toast";
import { TEMPLATE_VARIABLES, fillTemplate } from "@/lib/templates";

type T = { id: number; name: string; body: string; active: boolean };

export default function TemplatesClient({ templates, sample }: { templates: T[]; sample: { name: string; project: string; community: string; units: number } | null }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [sel, setSel] = useState<number | "new">(templates[0]?.id ?? "new");
  const current = templates.find((t) => t.id === sel);
  const [draft, setDraft] = useState<Omit<T, "id">>(current ? { ...current } : { name: "", body: "", active: true });
  const ref = useRef<HTMLTextAreaElement>(null);
  const [confirming, setConfirming] = useState(false);

  const pick = (id: number | "new") => {
    setSel(id);
    const t = templates.find((x) => x.id === id);
    setDraft(t ? { name: t.name, body: t.body, active: t.active } : { name: "", body: "", active: true });
  };
  const insert = (key: string) => {
    const el = ref.current;
    const token = `{${key}}`;
    if (!el) return setDraft((d) => ({ ...d, body: d.body + token }));
    const s = el.selectionStart, e = el.selectionEnd;
    const body = draft.body.slice(0, s) + token + draft.body.slice(e);
    setDraft({ ...draft, body });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + token.length, s + token.length); });
  };
  const preview = fillTemplate(draft.body, {
    investorName: sample?.name || "Ahmed Al Mansoori", agentName: "Your name", agentPhone: "+971 50 000 0000",
    topProject: sample?.project || "Mamsha Al Saadiyat", topCommunity: sample?.community || "Saadiyat Island", units: sample?.units || 3,
  });
  const dirty = sel === "new" ? !!(draft.name || draft.body) : current && (current.name !== draft.name || current.body !== draft.body || current.active !== draft.active);

  return (
    <div className="grid tpl-layout">
      <div className="stack" style={{ gap: 8 }}>
        {templates.map((t, i) => (
          <div key={t.id} className={`tpl ${sel === t.id ? "on" : ""}`} style={{ cursor: "pointer", opacity: t.active ? 1 : 0.55 }} onClick={() => pick(t.id)}>
            <div className="row">
              <div className="nm" style={{ flex: 1 }}>{t.name}</div>
              {sel === t.id && (
                <>
                  <button className="icon-btn" style={{ width: 26, height: 26 }} disabled={i === 0} onClick={(e) => { e.stopPropagation(); start(async () => { await moveTemplate(t.id, -1); router.refresh(); }); }} aria-label="Move up"><ArrowUp size={14} /></button>
                  <button className="icon-btn" style={{ width: 26, height: 26 }} disabled={i === templates.length - 1} onClick={(e) => { e.stopPropagation(); start(async () => { await moveTemplate(t.id, 1); router.refresh(); }); }} aria-label="Move down"><ArrowDown size={14} /></button>
                </>
              )}
            </div>
            <div className="pv">{t.active ? t.body : "Hidden from callers"}</div>
          </div>
        ))}
        <button className={`tpl ${sel === "new" ? "on" : ""}`} onClick={() => pick("new")} style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)" }}><Plus size={16} />New template</button>
      </div>

      <div className="card pad stack" style={{ gap: 16 }}>
        <div className="grid" style={{ gridTemplateColumns: "1fr auto", alignItems: "end", gap: 16 }}>
          <label className="field"><span className="label">Name</span><input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Introduction" /></label>
          <label className="row small" style={{ height: 44, gap: 10 }}><span className="muted">Visible to callers</span><span className="switch"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /></span></label>
        </div>
        <div className="field">
          <span className="label">Message</span>
          <div className="row wrap" style={{ gap: 6 }}>
            {TEMPLATE_VARIABLES.map((v) => <button key={v.key} type="button" className="var-chip" onClick={() => insert(v.key)}>+ {v.label}</button>)}
          </div>
          <textarea ref={ref} className="textarea" rows={9} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="Hello {first_name}, …" />
          <span className="hint">Words in {"{curly brackets}"} are filled in for each investor when a caller sends the message.</span>
        </div>
        <div>
          <div className="label" style={{ marginBottom: 8 }}>Preview{sample ? ` · for ${sample.name}` : ""}</div>
          <div className="wa-preview"><div className="wa-bubble" style={{ whiteSpace: "pre-wrap", fontSize: 14.5, paddingBottom: 22 }}>{preview || <span className="faint">Your message will appear here.</span>}<span className="tick">✓✓</span></div></div>
        </div>
        <div className="row">
          {sel !== "new" && (
            <button className="btn btn-danger btn-sm" disabled={pending} onMouseLeave={() => setConfirming(false)} onClick={() => {
              if (!confirming) return setConfirming(true);
              setConfirming(false);
              start(async () => { const r = await deleteTemplate(sel as number); if (r.error) toast(r.error, true); else { toast("Template deleted"); pick(templates.find((t) => t.id !== sel)?.id ?? "new"); router.refresh(); } });
            }}>
              <Trash2 />{confirming ? "Click again to delete" : "Delete"}
            </button>
          )}
          <div className="spacer" />
          <button className="btn btn-primary" disabled={!dirty || pending} onClick={() => start(async () => {
            const r = await saveTemplate({ id: sel === "new" ? undefined : sel, ...draft });
            if (!r.ok) return toast(r.error, true);
            toast("Template saved"); setSel(r.id); router.refresh();
          })}>{pending && <Loader2 className="spin" />}Save template</button>
        </div>
      </div>
    </div>
  );
}
