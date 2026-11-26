import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { initials, num } from "@/lib/format";
import ProfileForm from "./ProfileForm";
import { signOut } from "@/app/actions-auth";

export const metadata = { title: "Profile" };

export default async function Profile() {
  const user = await requireUser();
  const [s] = await sql<{ calls: number; handled: number; wa: number }[]>`
    select (select count(*)::int from activities where user_id = ${user.id} and type = 'call') calls,
           (select count(*)::int from activities where user_id = ${user.id} and type = 'whatsapp') wa,
           (select count(*)::int from investors where assigned_to = ${user.id}) handled`;
  return (
    <div className="container" style={{ maxWidth: 820 }}>
      <div className="page-head">
        <div className="row" style={{ gap: 16 }}>
          <span className="avatar lg">{initials(user.name, user.email)}</span>
          <div><h1 style={{ fontSize: 28 }}>{user.name || user.email}</h1><div className="sub">{user.email} · {user.role === "admin" ? "Admin" : "Caller"}</div></div>
        </div>
      </div>
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="stat"><div className="k">Investors handled</div><div className="v">{num(s.handled)}</div></div>
        <div className="stat"><div className="k">Calls logged</div><div className="v">{num(s.calls)}</div></div>
        <div className="stat"><div className="k">WhatsApp messages</div><div className="v">{num(s.wa)}</div></div>
      </div>
      <div className="card pad"><ProfileForm name={user.name || ""} phone={user.phone || ""} /></div>
      <form action={signOut} style={{ marginTop: 20 }}><button className="btn btn-secondary">Sign out</button></form>
    </div>
  );
}
