"use client";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { updateProfile } from "@/app/actions-auth";

export default function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="stack" style={{ gap: 16 }}>
      <div className="grid grid-2">
        <label className="field"><span className="label">Full name</span><input className="input" name="name" defaultValue={name} required /></label>
        <label className="field"><span className="label">Mobile</span><input className="input" name="phone" defaultValue={phone} placeholder="+971 50 000 0000" /><span className="hint">Shown in WhatsApp templates that use your phone.</span></label>
      </div>
      <h3 className="section" style={{ marginTop: 12 }}>Change password</h3>
      <div className="grid grid-2">
        <label className="field"><span className="label">Current password</span><input className="input" name="current" type="password" autoComplete="current-password" /></label>
        <label className="field"><span className="label">New password</span><input className="input" name="password" type="password" autoComplete="new-password" minLength={8} placeholder="Leave empty to keep it" /></label>
      </div>
      {state?.error && <div className="error-box">{state.error}</div>}
      {state?.ok && <div className="ok-box">{state.ok}</div>}
      <div><button className="btn btn-primary" disabled={pending}>{pending && <Loader2 className="spin" />}Save changes</button></div>
    </form>
  );
}
