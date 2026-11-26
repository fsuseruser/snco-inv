"use client";
import { useActionState, useState, useRef, useEffect } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { signIn } from "../actions-auth";

export default function LoginForm() {
  const [state, action, pending] = useActionState(signIn, undefined);
  const [show, setShow] = useState(false);
  const [forgot, setForgot] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!forgot) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setForgot(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [forgot]);

  return (
    <form action={action}>
      <div className="field">
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="username" placeholder="name@company.com" required autoFocus />
      </div>
      <div className="field">
        <label className="label" htmlFor="password">Password</label>
        <div className="input-wrap">
          <input className="input" id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" placeholder="••••••••••" required />
          <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff /> : <Eye />}
          </button>
        </div>
      </div>
      <div className="row" style={{ justifyContent: "space-between", marginTop: 2 }}>
        <label className="check">
          <input type="checkbox" name="remember" defaultChecked />
          Remember me
        </label>
        <div className="forgot" ref={ref}>
          <button type="button" className="link small" style={{ background: "none", border: 0, padding: 0 }} onClick={() => setForgot((f) => !f)}>
            Forgot password?
          </button>
          {forgot && <div className="bubble">Ask your admin to reset it. You'll get a temporary password to sign in with.</div>}
        </div>
      </div>
      {state?.error && <div className="error-box" role="alert">{state.error}</div>}
      <button className="btn btn-primary btn-block" disabled={pending} style={{ marginTop: 6 }}>
        {pending ? <Loader2 className="spin" /> : null}
        {pending ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}
