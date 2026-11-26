"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { setAgentScope, previewAllocation, allocate, release } from "../actions";
import { useToast } from "@/components/Toast";
import { aed, num } from "@/lib/format";
import { TIERS, VALUE_BANDS, TAGS } from "@/lib/recalc";

type Props = {
  scope: "all" | "allocated";
  team: { id: number; name: string; role: string; handled: number; contacted: number; value: number }[];
  open: { n: number; value: number };
  options: { origins: string[]; countries: { v: string; label: string }[]; communities: string[] };
};

export default function AllocationClient({ scope, team, open, options }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ tier: "", band: "", origin: "", country: "", community: "", tag: "", status: "new" });
  const [includeHandled, setIncludeHandled] = useState(false);
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(100);
  const [preview, setPreview] = useState<{ count: number; value: number } | null>(null);

  useEffect(() => {
    let live = true;
    previewAllocation(f, includeHandled).then((r) => live && r.ok && setPreview({ count: r.count, value: r.value }));
    return () => { live = false; };
  }, [f, includeHandled]);

  const sel = (key: keyof typeof f, all: string, opts: { v: string; label: string }[]) => (
    <select className="select sm" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })}>
      <option value="">{all}</option>
      {opts.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
    </select>
  );

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="card pad">
        <div className="row" style={{ alignItems: "flex-start", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <h2 className="section" style={{ marginBottom: 6 }}>Callers only see investors allocated to them</h2>
            <div className="small muted" style={{ maxWidth: 640 }}>
              {scope === "all"
                ? "Off: every caller sees all investors. An investor locks to whoever contacts them first; others can still view them."
                : "On: callers see only the investors allocated to them. Admins still see everyone."}
            </div>
          </div>
          <label className="switch" title="Toggle">
            <input type="checkbox" checked={scope === "allocated"} disabled={pending} onChange={(e) => start(async () => {
              const r = await setAgentScope(e.target.checked ? "allocated" : "all");
              if (r.error) toast(r.error, true); else { toast(e.target.checked ? "Callers now see only their allocation" : "Callers now see everyone"); router.refresh(); }
            })} />
          </label>
        </div>
      </div>

      <div className="grid split">
        <div className="card pad">
          <h2 className="section">Allocate investors</h2>
          <div className="filters" style={{ marginTop: 0 }}>
            {sel("tier", "Any category", TIERS.map((t) => ({ v: t, label: t })))}
            {sel("band", "Any value", VALUE_BANDS.map((t) => ({ v: t, label: t })))}
            {sel("origin", "Any name origin", options.origins.map((t) => ({ v: t, label: t })))}
            {sel("country", "Any nationality", options.countries)}
            {sel("community", "Any community", options.communities.map((t) => ({ v: t, label: t })))}
            {sel("tag", "Any profile", TAGS.map((t) => ({ v: t, label: t })))}
            {sel("status", "Any status", [{ v: "new", label: "Not contacted" }, { v: "followup", label: "Follow-up due" }])}
          </div>
          <label className="check" style={{ marginTop: 14 }}>
            <input type="checkbox" checked={includeHandled} onChange={(e) => setIncludeHandled(e.target.checked)} />
            Also move investors someone is already handling
          </label>
          <div className="panel" style={{ marginTop: 18 }}>
            <div className="small muted">Matching</div>
            <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }} className="num">
              {preview ? `${num(preview.count)} investors` : "…"} <span className="muted" style={{ fontSize: 15, fontWeight: 400 }}>{preview ? aed(preview.value, { short: true }) : ""}</span>
            </div>
            <div className="row wrap" style={{ marginTop: 14, gap: 10 }}>
              <select className="select sm" style={{ flex: "1 1 200px" }} value={to} onChange={(e) => setTo(e.target.value)}>
                <option value="">Choose a team member</option>
                {team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <label className="row small muted">Up to
                <input className="input sm num" type="number" min={1} max={5000} value={limit} onChange={(e) => setLimit(Number(e.target.value))} style={{ width: 90 }} />
              </label>
              <button className="btn btn-primary" disabled={!to || !preview?.count || pending} onClick={() => start(async () => {
                const r = await allocate(f, includeHandled, Number(to), limit);
                if (!r.ok) return toast(r.error, true);
                toast(`${num(r.count)} investors allocated`);
                router.refresh();
                const p = await previewAllocation(f, includeHandled); if (p.ok) setPreview({ count: p.count, value: p.value });
              })}>
                {pending && <Loader2 className="spin" />}Allocate
              </button>
            </div>
            <div className="xs faint" style={{ marginTop: 10 }}>Highest-value investors are allocated first. Do-not-call investors are never allocated.</div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>Who handles what</h2></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Member</th><th className="r">Handling</th><th className="r">Contacted</th><th /></tr></thead>
              <tbody>
                {team.map((t) => (
                  <tr key={t.id}>
                    <td><div className="strong">{t.name}</div><div className="xs faint">{aed(t.value, { short: true })}</div></td>
                    <td className="r num">{num(t.handled)}</td>
                    <td className="r num">{num(t.contacted)}</td>
                    <td className="r">
                      {t.handled > t.contacted && (
                        <button className="btn btn-ghost btn-sm" disabled={pending} title="Unlock investors this person hasn't contacted yet" onClick={() => start(async () => {
                          const r = await release(t.id, true);
                          if (!r.ok) return toast(r.error, true);
                          toast(`${num(r.count)} investors unlocked`); router.refresh();
                        })}>Release uncontacted</button>
                      )}
                    </td>
                  </tr>
                ))}
                <tr><td className="muted">Not handled yet</td><td className="r num muted">{num(open.n)}</td><td /><td /></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
