import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import SetupForm from "./SetupForm";
import { signOut } from "../actions-auth";

export const metadata = { title: "Set up your account" };

export default async function WelcomePage() {
  const user = await requireUser({ allowSetup: true });
  if (!user.must_change_password) redirect("/");
  return (
    <main className="auth">
      <div className="auth-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="auth-logo" src="/logo.png" alt="S&Co. Real Estate" />
        <h1>Set up your account</h1>
        <p className="sub">{user.email}</p>
        <SetupForm name={user.name && user.name !== "Administrator" ? user.name : ""} />
        <form action={signOut} className="foot">
          <button className="link small" style={{ background: "none", border: 0 }}>Not you? Sign out</button>
        </form>
      </div>
      <p className="auth-footer">© {new Date().getFullYear()} S&amp;Co.</p>
    </main>
  );
}
