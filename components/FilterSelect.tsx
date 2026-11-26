"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** A select or date input that writes its value into the URL query string. */
export default function FilterSelect({ name, value, label, options, type }: {
  name: string; value?: string; label: string; options?: { v: string; label: string }[]; type?: "date";
}) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const set = (v: string) => {
    const p = new URLSearchParams(params.toString());
    v ? p.set(name, v) : p.delete(name);
    p.delete("page");
    router.replace(`${path}?${p.toString()}`, { scroll: false });
  };
  if (type === "date") {
    return (
      <label className="row small muted">
        <span>{label}</span>
        <input className="input sm" type="date" value={value || ""} onChange={(e) => set(e.target.value)} style={{ width: 150 }} />
      </label>
    );
  }
  return (
    <select className="select sm" style={{ width: "auto", minWidth: 150 }} value={value || ""} onChange={(e) => set(e.target.value)} aria-label={label}>
      <option value="">{label}</option>
      {options?.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
    </select>
  );
}
