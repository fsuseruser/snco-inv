import { requireAdmin } from "@/lib/auth";
import SubNav from "./SubNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="container">
      <div className="page-head" style={{ paddingBottom: 18 }}><div><h1>Admin</h1></div></div>
      <SubNav />
      {children}
    </div>
  );
}
