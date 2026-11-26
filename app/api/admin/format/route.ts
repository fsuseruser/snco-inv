import * as XLSX from "xlsx";
import { getUser } from "@/lib/auth";
import { buildTemplateWorkbook } from "@/lib/importFormat";

export async function GET() {
  const user = await getUser();
  if (!user || user.role !== "admin") return new Response("Not allowed", { status: 403 });
  const buf = XLSX.write(buildTemplateWorkbook(XLSX), { type: "buffer", bookType: "xlsx" });
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="S&Co Investor Import Format.xlsx"',
    },
  });
}
