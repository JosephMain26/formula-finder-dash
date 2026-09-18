import type { Tables } from "@/integrations/supabase/types";
import { money, type ReportDateMode } from "@/lib/reportSpec";

type Job = Tables<"jobs">;

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Date range options offered for technician reports. */
export const TECH_DATE_MODES: { key: ReportDateMode; label: string }[] = [
  { key: "last-week", label: "Last week (Mon–Sun)" },
  { key: "this-week", label: "This week (Mon–Sun)" },
  { key: "today", label: "Today" },
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "custom", label: "Custom dates" },
  { key: "all", label: "All dates" },
];

export type TechReportRow = {
  job: Job;
  revenue: number;
  techCut: number;
  officeCut: number;
};

export type TechReportSummary = {
  tech: string;
  jobsCount: number;
  revenue: number;
  techCut: number;
  /** Marketer share + office share — what the tech turns in to the office. */
  officeCut: number;
  rows: TechReportRow[];
};

export type TechReportOptions = {
  from?: string;
  to?: string;
  /** Empty / omitted = all statuses. */
  statuses?: string[];
  /** Empty / omitted = every technician found in the jobs. */
  techNames?: string[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Group jobs by technician and compute each tech's cut plus the office cut
 * (marketer share + office share) they owe the office for the period.
 */
export function summarizeByTech(jobs: Job[], opts: TechReportOptions = {}): TechReportSummary[] {
  const { from, to } = opts;
  const statusSet = new Set((opts.statuses || []).map((s) => s.toLowerCase()));
  const techSet = new Set((opts.techNames || []).map((t) => t.trim()).filter(Boolean));

  const groups = new Map<string, TechReportSummary>();

  for (const j of jobs) {
    const tech = (j.tech_name || "").trim();
    if (!tech) continue;
    if (techSet.size > 0 && !techSet.has(tech)) continue;
    if (from && (!j.job_date || j.job_date < from)) continue;
    if (to && (!j.job_date || j.job_date > to)) continue;
    if (statusSet.size > 0 && !statusSet.has((j.status || "").toLowerCase())) continue;

    const revenue = num(j.price);
    const techCut = num(j.total_tech);
    const officeCut = num((j as any).total_marketer) + num((j as any).total_office);

    let g = groups.get(tech);
    if (!g) {
      g = { tech, jobsCount: 0, revenue: 0, techCut: 0, officeCut: 0, rows: [] };
      groups.set(tech, g);
    }
    g.jobsCount += 1;
    g.revenue += revenue;
    g.techCut += techCut;
    g.officeCut += officeCut;
    g.rows.push({ job: j, revenue, techCut, officeCut });
  }

  const out = Array.from(groups.values());
  for (const g of out) {
    g.revenue = round2(g.revenue);
    g.techCut = round2(g.techCut);
    g.officeCut = round2(g.officeCut);
    g.rows.sort((a, b) => (a.job.job_date || "").localeCompare(b.job.job_date || ""));
  }
  out.sort((a, b) => a.tech.localeCompare(b.tech));
  return out;
}

function esc(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function techRangeText(from?: string, to?: string): string {
  if (!from && !to) return "All dates";
  const f = from ? new Date(from + "T12:00:00").toLocaleDateString() : "start";
  const t = to ? new Date(to + "T12:00:00").toLocaleDateString() : "today";
  return `${f} – ${t}`;
}

/** Summary boxes a report can show. */
export const TECH_BOXES: { key: string; label: string; emailLabel: string }[] = [
  { key: "techCut", label: "Tech cut", emailLabel: "Your cut" },
  { key: "officeCut", label: "Owed to office", emailLabel: "Owed to office" },
  { key: "revenue", label: "Revenue", emailLabel: "Total revenue" },
];

/** Table columns a report can show. */
export const TECH_COLUMNS: { key: string; label: string; numeric?: boolean }[] = [
  { key: "date", label: "Date" },
  { key: "marketer", label: "Marketer" },
  { key: "type", label: "Type" },
  { key: "status", label: "Status" },
  { key: "price", label: "Price", numeric: true },
  { key: "techCut", label: "Tech cut", numeric: true },
  { key: "officeCut", label: "Office cut", numeric: true },
];

export const DEFAULT_TECH_BOXES = TECH_BOXES.map((b) => b.key);
export const DEFAULT_TECH_COLUMNS = TECH_COLUMNS.map((c) => c.key);
export const DEFAULT_TECH_TITLE = "Technician Report";

/** Cell value for one row/column pair (shared by the table, PDF and email). */
export function techCellValue(r: TechReportRow, key: string): string {
  switch (key) {
    case "date": return r.job.job_date || "—";
    case "marketer": return (r.job.company_1 || r.job.company || "—").trim() || "—";
    case "type": return r.job.job_type || "—";
    case "status": return r.job.status || "—";
    case "price": return money(r.revenue);
    case "techCut": return money(r.techCut);
    case "officeCut": return money(r.officeCut);
    default: return "";
  }
}

export type TechReportLook = { title?: string; boxes?: string[]; columns?: string[] };

/** Email-safe HTML statement for a single technician. */
export function renderTechReportHtml(s: TechReportSummary, rangeText: string, look: TechReportLook = {}): string {
  const title = look.title || DEFAULT_TECH_TITLE;
  const boxKeys = look.boxes?.length ? look.boxes : DEFAULT_TECH_BOXES;
  const colKeys = look.columns?.length ? look.columns : DEFAULT_TECH_COLUMNS;
  const cols = TECH_COLUMNS.filter((c) => colKeys.includes(c.key));

  const boxColor: Record<string, string> = { techCut: "#047857", officeCut: "#b91c1c", revenue: "#111827" };
  const boxValue: Record<string, number> = { techCut: s.techCut, officeCut: s.officeCut, revenue: s.revenue };

  const boxes = TECH_BOXES.filter((b) => boxKeys.includes(b.key))
    .map(
      (b) => `<td style="padding:10px 14px;border:1px solid #e5e7eb;border-radius:6px;">
       <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;">${esc(b.emailLabel)}</div>
       <div style="font-size:18px;font-weight:700;color:${boxColor[b.key]};">${esc(money(boxValue[b.key]))}</div>
     </td>`
    )
    .join("");

  const rows = s.rows
    .map(
      (r) => `<tr>${cols
        .map(
          (c) =>
            `<td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;${c.numeric ? "text-align:right;" : ""}">${esc(techCellValue(r, c.key))}</td>`
        )
        .join("")}</tr>`
    )
    .join("");

  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:720px;">
    <h2 style="margin:0 0 2px;font-size:20px;">${esc(title)} — ${esc(s.tech)}</h2>
    <div style="color:#6b7280;font-size:13px;margin-bottom:14px;">${esc(rangeText)} · ${s.jobsCount} job${s.jobsCount === 1 ? "" : "s"}</div>
    ${boxes ? `<table style="border-collapse:separate;border-spacing:8px 0;margin-bottom:16px;"><tr>${boxes}</tr></table>` : ""}
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr style="background:#f3f4f6;text-align:left;">
        ${cols.map((c) => `<th style="padding:6px 8px;${c.numeric ? "text-align:right;" : ""}">${esc(c.label)}</th>`).join("")}
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="${cols.length}" style="padding:10px;color:#6b7280;">No jobs in this period.</td></tr>`}</tbody>
    </table>
  </div>`;
}
