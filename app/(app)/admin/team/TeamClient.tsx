"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Copy, Check, KeyRound, X, Loader2, MoreHorizontal } from "lucide-react";
import { createMember, resetPassword, setActive, setRole } from "../actions";
import { useToast } from "@/components/Toast";
import { initials, relative, dateTime } from "@/lib/format";

export type Member = {
  id: number; email: string; name: string | null; role: "admin" | "agent"; active: boolean; must_change_password: boolean;
  created_at: string; last_login_at: string | null; last_seen_at: string | null; handled: number; calls30: number;
};

function Secret({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `Sign in at ${typeof window !== "undefined" ? window.location.origin : ""}/login\nEmail: ${email}\nTemporary password: ${password}`;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head"><h2>Temporary password</h2><div className="spacer" /><button className="icon-btn" onClick={onClose} aria-label="Close"><X /></button></div>
        <div className="modal-body stack">
          <div className="small muted">Share this with <b style={{ color: "var(--ink)" }}>{email}</b>. It&apos;s shown only once. They&apos;ll set their name and their own password when they first sign in.</div>
          <div className="secret"><span style={{ flex: 1 }}>{password}</span></div>
          <button className="btn btn-secondary" onClick={() => { navigator.clipboard.writeText(text); setCopied(true); }}>
            {copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy sign-in details"}
          </button>
        </div>
        <div className="modal-foot"><button className="btn btn-primary" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}

export default function TeamClient({ members, meId }: { members: Member[]; meId: number }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);
  const [menu, setMenu] = useState<number | null>(null);
  const [form, setForm] = useState({ email: "", name: "", role: "agent" as "admin" | "agent" });
  const [error, setError] = useState("");
  const online = Date.now() - 10 * 60 * 1000;

  const add = () => start(async () => {
    setError("");
    const r = await createMember(form);
    if (!r.ok) return setError(r.error);
    setAdding(false);
    setSecret({ email: form.email.trim().toLowerCase(), password: r.password });
    setForm({ email: "", name: "", role: "agent" });
    router.refresh();
  });

  const act = (fn: () => Promise<{ ok?: boolean; error?: string }>, msg: string) => start(async () => {
    setMenu(null);
    const r = await fn();
    if (r.error) toast(r.error, true); else { toast(msg); router.refresh(); }
  });

  return (
    <div>
      <div className="row" style={{ marginBottom: 16 }}>
        <div className="small muted">{members.filter((m) => m.active).length} active members</div>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => setAdding(true)}><UserPlus />Add member</button>
      </div>
      <div className="card">
        <div className="table-wrap" style={{ overflow: "visible" }}>
          <table className="table">
            <thead><tr><th>Member</th><th>Role</th><th className="r">Handling</th><th className="r">Calls (30 days)</th><th>Last sign-in</th><th>Status</th><th /></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} style={m.active ? undefined : { opacity: 0.55 }}>
                  <td>
                    <div className="row" style={{ gap: 10 }}>
                      <span className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{initials(m.name, m.email)}</span>
                      <div><div className="strong">{m.name || <span className="faint">Name not set</span>}</div><div className="xs faint">{m.email}</div></div>
                    </div>
                  </td>
                  <td>{m.role === "admin" ? "Admin" : "Caller"}</td>
                  <td className="r num">{m.handled}</td>
                  <td className="r num">{m.calls30}</td>
                  <td className="small nowrap" title={m.last_login_at ? dateTime(m.last_login_at) : ""}>{m.last_login_at ? relative(m.last_login_at) : <span className="faint">Never</span>}</td>
                  <td className="nowrap">
                    {!m.active ? <span className="pill grey">Disabled</span>
                      : m.must_change_password ? <span className="pill amber">Awaiting first sign-in</span>
                      : m.last_seen_at && new Date(m.last_seen_at).getTime() > online ? <span className="pill green">Online</span>
                      : <span className="pill grey plain">Active</span>}
                  </td>
                  <td className="r" style={{ position: "relative" }}>
                    <button className="icon-btn" onClick={() => setMenu(menu === m.id ? null : m.id)} aria-label="Actions"><MoreHorizontal /></button>
                    {menu === m.id && (
                      <div className="menu" style={{ top: "calc(100% - 6px)" }} onMouseLeave={() => setMenu(null)}>
                        <button onClick={() => start(async () => { setMenu(null); const r = await resetPassword(m.id); if (!r.ok) toast(r.error, true); else { setSecret({ email: m.email, password: r.password }); router.refresh(); } })}>
                          <KeyRound />Reset password
                        </button>
                        {m.id !== meId && (
                          <>
                            <button onClick={() => act(() => setRole(m.id, m.role === "admin" ? "agent" : "admin"), "Role updated")}>
                              {m.role === "admin" ? "Make caller" : "Make admin"}
                            </button>
                            <button onClick={() => act(() => setActive(m.id, !m.active), m.active ? "Account disabled" : "Account enabled")} style={m.active ? { color: "var(--red)" } : undefined}>
                              {m.active ? "Disable account" : "Enable account"}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {adding && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setAdding(false)}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head"><h2>Add a team member</h2><div className="spacer" /><button className="icon-btn" onClick={() => setAdding(false)} aria-label="Close"><X /></button></div>
            <form className="modal-body stack" onSubmit={(e) => { e.preventDefault(); add(); }}>
              <label className="field"><span className="label">Email</span><input className="input" type="email" required autoFocus value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@company.com" /></label>
              <label className="field"><span className="label">Name <span className="faint">(optional, they can set it)</span></span><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <div className="field">
                <span className="label">Role</span>
                <div className="seg">
                  <button type="button" className={form.role === "agent" ? "on" : ""} onClick={() => setForm({ ...form, role: "agent" })}>Caller</button>
                  <button type="button" className={form.role === "admin" ? "on" : ""} onClick={() => setForm({ ...form, role: "admin" })}>Admin</button>
                </div>
              </div>
              {error && <div className="error-box">{error}</div>}
              <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
                <button className="btn btn-primary" disabled={pending}>{pending && <Loader2 className="spin" />}Create account</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {secret && <Secret {...secret} onClose={() => setSecret(null)} />}
    </div>
  );
}
