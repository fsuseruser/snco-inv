"use client";
import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { completeSetup } from "../actions-auth";

function strength(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return s;
}

export default function SetupForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(completeSetup, undefined);
  const [pw, setPw] = useState("");
  const s = strength(pw);
  return (
    <form action={action}>
      <div className="field">
        <label className="label" htmlFor="name">Full name</label>
        <input className="input" id="name" name="name" defaultValue={name} autoComplete="name" placeholder="As investors should see it" required />
      </div>
      <div className="field">
        <label className="label" htmlFor="phone">Mobile <span className="faint">(optional)</span></label>
        <input className="input" id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+971 50 000 0000" />
        <span className="hint">Used to sign your WhatsApp messages.</span>
      </div>
      <div className="field">
        <label className="label" htmlFor="password">New password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" />
        <div className="pw-meter" aria-hidden>{[0, 1, 2, 3].map((i) => <i key={i} className={i < s ? "on" : ""} />)}</div>
      </div>
      <div className="field">
        <label className="label" htmlFor="confirm">Confirm password</label>
        <input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      {state?.error && <div className="error-box" role="alert">{state.error}</div>}
      <button className="btn btn-primary btn-block" disabled={pending} style={{ marginTop: 6 }}>
        {pending && <Loader2 className="spin" />}
        Continue
      </button>
    </form>
  );
}
