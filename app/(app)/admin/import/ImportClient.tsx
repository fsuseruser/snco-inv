"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Download, UploadCloud, FileSpreadsheet, Loader2, CheckCircle2, ChevronRight } from "lucide-react";
import type { UnitRow, ProjectRow } from "@/lib/importFormat";
import type { ImportSummary } from "@/lib/importer";
import { num } from "@/lib/format";

type Parsed = { file: string; units: UnitRow[]; projects: ProjectRow[]; sheet: string; notes: string[] };
type Stage = "pick" | "parsed" | "checking" | "preview" | "importing" | "done";
const CHUNK = 1500;

async function api(body: object) {
  const r = await fetch("/api/admin/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || "Request failed");
  return j;
}

export default function ImportClient() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("pick");
  const [over, setOver] = useState(false);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [id, setId] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState("");

  const read = async (file: File) => {
    setError("");
    try {
      const XLSX = await import("xlsx");
      const { parseWorkbook } = await import("@/lib/importFormat");
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      const r = parseWorkbook(XLSX, wb);
      if (!r.units.length && !r.projects.length) throw new Error(r.notes[0] || "No rows found in this file.");
      setParsed({ file: file.name, units: r.units, projects: r.projects, sheet: r.unitSheet, notes: r.notes });
      setStage("parsed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read this file.");
    }
  };

  const check = async () => {
    if (!parsed) return;
    setStage("checking"); setError(""); setProgress(0);
    try {
      const { id } = await api({ action: "create", fileName: parsed.file, total: parsed.units.length + parsed.projects.length });
      setId(id);
      const total = parsed.units.length + parsed.projects.length;
      let sent = 0;
      for (const [kind, rows] of [["project", parsed.projects], ["unit", parsed.units]] as const) {
        for (let i = 0; i < rows.length; i += CHUNK) {
          await api({ action: "rows", id, kind, offset: i, rows: rows.slice(i, i + CHUNK) });
          sent += Math.min(CHUNK, rows.length - i);
          setProgress(Math.round((sent / total) * 90));
        }
      }
      const { summary } = await api({ action: "preview", id });
      setProgress(100);
      setSummary(summary);
      setStage("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
      setStage("parsed");
    }
  };

  const commit = async () => {
    if (!id) return;
    setStage("importing"); setError("");
    try {
      const { summary } = await api({ action: "commit", id });
      setSummary(summary);
      setStage("done");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
      setStage("preview");
    }
  };

  const reset = async () => {
    if (id && stage !== "done") await api({ action: "discard", id }).catch(() => {});
    setStage("pick"); setParsed(null); setId(null); setSummary(null); setProgress(0); setError("");
    if (input.current) input.current.value = "";
  };

  const steps = ["Choose file", "Check", "Import"];
  const stepIndex = stage === "pick" || stage === "parsed" ? 0 : stage === "checking" || stage === "preview" ? 1 : 2;

  return (
    <div className="grid split">
      <div className="card pad">
        <div className="steps">
          {steps.map((s, i) => (
            <span key={s} className="row" style={{ gap: 8 }}>
              <span className={i === stepIndex ? "on" : ""}>{i + 1}. {s}</span>
              {i < steps.length - 1 && <ChevronRight />}
            </span>
          ))}
        </div>

        {(stage === "pick" || stage === "parsed") && (
          <>
            <div
              className={`drop ${over ? "over" : ""}`}
              onClick={() => input.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setOver(true); }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) read(f); }}
            >
              {parsed ? <FileSpreadsheet /> : <UploadCloud />}
              {parsed ? (
                <>
                  <div className="strong">{parsed.file}</div>
                  <div className="small muted" style={{ marginTop: 4 }}>
                    {num(parsed.units.length)} unit rows{parsed.sheet ? ` from “${parsed.sheet}”` : ""}{parsed.projects.length ? ` · ${num(parsed.projects.length)} project prices` : ""}
                  </div>
                  <div className="xs faint" style={{ marginTop: 8 }}>Click to choose a different file</div>
                </>
              ) : (
                <>
                  <div className="strong">Drop an Excel file here</div>
                  <div className="small muted" style={{ marginTop: 4 }}>or click to choose · .xlsx, .xls or .csv</div>
                </>
              )}
              <input ref={input} type="file" hidden accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
            </div>
            {parsed?.notes.map((n) => <div key={n} className="error-box" style={{ marginTop: 12 }}>{n}</div>)}
            {stage === "parsed" && (
              <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={reset}>Cancel</button>
                <button className="btn btn-primary" onClick={check}>Check file</button>
              </div>
            )}
          </>
        )}

        {stage === "checking" && (
          <div style={{ padding: "30px 0" }}>
            <div className="row small" style={{ marginBottom: 10 }}><Loader2 className="spin" size={16} />Uploading and checking for duplicates…</div>
            <div className="progress"><i style={{ width: `${progress}%` }} /></div>
          </div>
        )}

        {(stage === "preview" || stage === "importing" || stage === "done") && summary && (
          <div className="stack">
            {stage === "done" && (
              <div className="ok-box row" style={{ gap: 8 }}><CheckCircle2 size={16} />Import complete. Values and categories have been recalculated.</div>
            )}
            <div className="grid grid-3">
              <div className="stat"><div className="k">New investors</div><div className="v">{num(summary.newInvestors)}</div></div>
              <div className="stat"><div className="k">Existing investors matched</div><div className="v">{num(summary.matchedInvestors)}</div></div>
              <div className="stat"><div className="k">New units</div><div className="v">{num(summary.newUnits)}</div></div>
              <div className="stat"><div className="k">Duplicates skipped</div><div className="v">{num(summary.duplicateUnits)}</div></div>
              <div className="stat"><div className="k">New projects</div><div className="v">{num(summary.newProjects)}</div></div>
              <div className="stat"><div className="k">Price updates</div><div className="v">{num(summary.updatedProjects)}</div></div>
            </div>
            {Object.keys(summary.skipped).length > 0 && (
              <div className="panel">
                <div className="strong small" style={{ marginBottom: 8 }}>Rows skipped</div>
                {Object.entries(summary.skipped).map(([k, v]) => <div key={k} className="row small" style={{ justifyContent: "space-between" }}><span>{k}</span><span className="num muted">{num(v)}</span></div>)}
                <details style={{ marginTop: 10 }}>
                  <summary className="xs muted" style={{ cursor: "pointer" }}>Examples</summary>
                  <div className="xs muted" style={{ marginTop: 6 }}>
                    {summary.skippedExamples.map((x) => <div key={x.row}>Row {x.row}: {x.name || "(blank)"} · {x.reason}</div>)}
                  </div>
                </details>
              </div>
            )}
            {stage !== "done" ? (
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={reset} disabled={stage === "importing"}>Cancel</button>
                <button className="btn btn-primary" onClick={commit} disabled={stage === "importing" || (!summary.newUnits && !summary.newProjects && !summary.updatedProjects)}>
                  {stage === "importing" && <Loader2 className="spin" />}
                  {stage === "importing" ? "Importing…" : `Import ${num(summary.newUnits)} units`}
                </button>
              </div>
            ) : (
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={reset}>Import another file</button>
                <Link className="btn btn-primary" href="/">View investors</Link>
              </div>
            )}
          </div>
        )}
        {error && <div className="error-box" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      <div className="card pad">
        <h2 className="section">Format</h2>
        <div className="small muted stack" style={{ gap: 10 }}>
          <p style={{ margin: 0 }}>One row per unit. An investor with five units has five rows.</p>
          <p style={{ margin: 0 }}>Required: <b style={{ color: "var(--ink)" }}>Owner name</b> or <b style={{ color: "var(--ink)" }}>Phones</b>, and <b style={{ color: "var(--ink)" }}>Project</b>. Everything else is optional.</p>
          <p style={{ margin: 0 }}>Existing investors are matched by ref, then phone number and similar name, then full name. Spellings are merged and the same unit is never added twice.</p>
          <p style={{ margin: 0 }}>Add a <b style={{ color: "var(--ink)" }}>Projects</b> sheet to add or update price benchmarks; every portfolio value is recalculated.</p>
          <p style={{ margin: 0 }}>Companies, banks, developers and government entities are skipped.</p>
        </div>
        <a className="btn btn-secondary btn-block" style={{ marginTop: 18 }} href="/api/admin/format"><Download />Download format</a>
      </div>
    </div>
  );
}
