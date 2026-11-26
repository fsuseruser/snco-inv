import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect(user.must_change_password ? "/welcome" : "/");
  return (
    <main className="auth">
      <div className="auth-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="auth-logo" src="/logo.png" alt="S&Co. Real Estate" />
        <h1>Welcome back</h1>
        <p className="sub">Sign in to continue</p>
        <LoginForm />
        <p className="foot">First time here? Sign in with the temporary password from your admin.</p>
      </div>
      <p className="auth-footer">© {new Date().getFullYear()} S&amp;Co.</p>
    </main>
  );
}
