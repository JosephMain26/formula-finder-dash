import type { Tables } from "@/integrations/supabase/types";
import { summarizeByMarketer, type MarketerBalanceSummary } from "@/lib/marketerBalance";

type Job = Tables<"jobs">;

/**
 * Shared, dependency-light report model used by BOTH the on-screen Report
 * Builder page (to render a PDF) AND the server cron route (to render an HTML
 * email). Keep this file free of React / DOM imports so it runs in the Worker.
 */

// ---------- Columns ----------
// Mirrors ALL_COLUMNS from ColumnToggle minus the "actions" column, but kept
// here so the server route never has to import a React component module.
export const REPORT_COLUMNS = [
  { key: "job_date", label: "Date" },
  { key: "client", label: "Client" },
  { key: "company", label: "Marketer" },
  { key: "tech_name", label: "Tech" },
  { key: "po_number", label: "PO #" },
  { key: "job_type", label: "Job Type" },
  { key: "status", label: "Status" },
  { key: "price", label: "Price" },
  { key: "co_parts", label: "Co Parts" },
  { key: "office_parts", label: "Office Parts" },
  { key: "parts", label: "Parts" },
  { key: "manual_percentage", label: "Tech %" },
  { key: "total_marketer", label: "Total Marketer" },
  { key: "total_office", label: "Total Office" },
  { key: "total_tech", label: "Total Tech" },
  { key: "tip", label: "Tip" },
  { key: "cc_fee", label: "CC Fee" },
  { key: "payment", label: "Payment" },
  { key: "paid", label: "Paid" },
] as const;

export type ReportColumnKey = (typeof REPORT_COLUMNS)[number]["key"];

// ---------- Sections ----------
export type ReportSectionId = "title" | "range" | "totals" | "balance" | "table";

export const REPORT_SECTION_LABELS: Record<ReportSectionId, string> = {
  title: "Title",
  range: "Date Range",
  totals: "Totals",
  balance: "Balance summary",
  table: "Jobs Table",
};

export type TotalKey = "revenue" | "tech" | "office" | "marketer";

export const TOTAL_LABELS: Record<TotalKey, string> = {
  revenue: "Revenue",
  tech: "Total Tech",
  office: "Total Office",
  marketer: "Total Marketer",
};

// Relative date modes are resolved at render time so scheduled reports always
// cover the right window (e.g. "last-week" computed when the cron runs).
export type ReportDateMode =
  | "all"
  | "custom"
  | "today"
  | "this-week"
  | "last-week"
  | "this-month"
  | "last-month"
  | "this-year";

export interface ReportSpec {
  title: string;
  // ordered sections + enabled flags
  sections: { id: ReportSectionId; enabled: boolean }[];
  columns: ReportColumnKey[];
  totals: Record<TotalKey, boolean>;
  marketers: string[]; // empty = all
  statuses?: string[]; // empty/undefined = all statuses
  dateMode: ReportDateMode;
  dateFrom?: string; // used when dateMode === "custom"
  dateTo?: string;
}

export const DEFAULT_REPORT_SPEC: ReportSpec = {
  title: "Jobs Report",
  sections: [
    { id: "title", enabled: true },
    { id: "range", enabled: true },
    { id: "totals", enabled: true },
    { id: "balance", enabled: false },
    { id: "table", enabled: true },
  ],
  columns: ["job_date", "company", "tech_name", "job_type", "status", "price", "total_tech", "paid"],
  totals: { revenue: true, tech: true, office: true, marketer: true },
  marketers: [],
  statuses: [],
  dateMode: "all",
};

// ---------- Formatting helpers ----------
const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export function money(n: number): string {
  const v = `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return n < 0 ? `-${v}` : v;
}

export function getCellValue(job: Job, key: ReportColumnKey): unknown {
  if (key === "company") return job.company_1 || job.company;
  return (job as any)[key];
}

export function fmtCell(val: unknown, key: ReportColumnKey): string {
  if (val == null || val === "") return "—";
  if (key === "paid") return val ? "Yes" : "No";
  if (key === "job_date") return new Date(val as string).toLocaleDateString();
  if (key === "manual_percentage") return `${val}%`;
  if (typeof val === "number") return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return String(val);
}

// ---------- Date range resolution ----------
function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function resolveSpecRange(spec: ReportSpec, today = new Date()): { from: string; to: string } | null {
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const mondayStart = (ref: Date) => {
    const d = new Date(ref);
    const diff = (d.getDay() - 1 + 7) % 7; // week starts Monday
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  switch (spec.dateMode) {
    case "all":
      return null;
    case "custom":
      if (!spec.dateFrom && !spec.dateTo) return null;
      return { from: spec.dateFrom || "", to: spec.dateTo || "" };
    case "today":
      return { from: fmtDate(t), to: fmtDate(t) };
    case "this-week": {
      const start = mondayStart(t);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { from: fmtDate(start), to: fmtDate(end) };
    }
    case "last-week": {
      const start = mondayStart(t);
      start.setDate(start.getDate() - 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { from: fmtDate(start), to: fmtDate(end) };
    }
    case "this-month": {
      const start = new Date(t.getFullYear(), t.getMonth(), 1);
      const end = new Date(t.getFullYear(), t.getMonth() + 1, 0);
      return { from: fmtDate(start), to: fmtDate(end) };
    }
    case "last-month": {
      const start = new Date(t.getFullYear(), t.getMonth() - 1, 1);
      const end = new Date(t.getFullYear(), t.getMonth(), 0);
      return { from: fmtDate(start), to: fmtDate(end) };
    }
    case "this-year": {
      const start = new Date(t.getFullYear(), 0, 1);
      const end = new Date(t.getFullYear(), 11, 31);
      return { from: fmtDate(start), to: fmtDate(end) };
    }
    default:
      return null;
  }
}

// ---------- Computed report data ----------
export interface ReportTotals {
  revenue: number;
  tech: number;
  office: number;
  marketer: number;
}

export interface ReportData {
  range: { from: string; to: string } | null;
  rangeText: string;
  totals: ReportTotals;
  jobCount: number;
  tableColumns: { key: ReportColumnKey; label: string }[];
  tableRows: string[][];
  balanceSummaries: MarketerBalanceSummary[];
  balanceGrandNet: number;
}

export function computeReportData(jobs: Job[], spec: ReportSpec, today = new Date()): ReportData {
  const range = resolveSpecRange(spec, today);
  const from = range?.from || "";
  const to = range?.to || "";
  const marketerSet = new Set(spec.marketers);
  const statusSet = new Set((spec.statuses || []).map((s) => s.toLowerCase()));

  const filtered = jobs.filter((j) => {
    if (from && (!j.job_date || j.job_date < from)) return false;
    if (to && (!j.job_date || j.job_date > to)) return false;
    if (marketerSet.size > 0) {
      const co = j.company_1 || j.company || "";
      if (!marketerSet.has(co)) return false;
    }
    if (statusSet.size > 0) {
      if (!statusSet.has((j.status || "").toLowerCase())) return false;
    }
    return true;
  });

  const totals = filtered.reduce<ReportTotals>(
    (acc, j) => {
      acc.revenue += num(j.price);
      acc.tech += num(j.total_tech);
      acc.office += num((j as any).total_office);
      acc.marketer += num((j as any).total_marketer);
      return acc;
    },
    { revenue: 0, tech: 0, office: 0, marketer: 0 }
  );

  const tableColumns = REPORT_COLUMNS.filter((c) => spec.columns.includes(c.key)) as {
    key: ReportColumnKey;
    label: string;
  }[];
  const tableRows = filtered.map((j) => tableColumns.map((c) => fmtCell(getCellValue(j, c.key), c.key)));

  const balanceSummaries = summarizeByMarketer(filtered, from || undefined, to || undefined);
  const balanceGrandNet = Math.round(balanceSummaries.reduce((a, s) => a + s.net, 0) * 100) / 100;

  const rangeText = range
    ? `Time range: ${from || "Beginning"}  →  ${to || "Today"}`
    : "Time range: All dates";

  return {
    range,
    rangeText,
    totals,
    jobCount: filtered.length,
    tableColumns,
    tableRows,
    balanceSummaries,
    balanceGrandNet,
  };
}

// ---------- HTML rendering (server email) ----------
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

function balanceLabel(net: number): string {
  if (Math.abs(net) < 0.005) return "Settled";
  return net > 0 ? "Office owes marketer" : "Marketer owes office";
}

/** Render the report as a standalone HTML fragment for emailing. */
export function renderReportHtml(data: ReportData, spec: ReportSpec): string {
  const parts: string[] = [];
  const enabled = (id: ReportSectionId) => spec.sections.find((s) => s.id === id)?.enabled;

  for (const section of spec.sections) {
    if (!section.enabled) continue;

    if (section.id === "title") {
      parts.push(`<h2 style="margin:0 0 8px;font-family:Arial,sans-serif;">${esc(spec.title || "Jobs Report")}</h2>`);
    }
    if (section.id === "range") {
      parts.push(
        `<p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:13px;color:#555;">${esc(data.rangeText)}</p>` +
          `<p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:12px;color:#777;">Total jobs: ${data.jobCount}</p>`
      );
    }
    if (section.id === "totals") {
      const cells: string[] = [];
      if (spec.totals.revenue) cells.push(`<b>Revenue:</b> ${money(data.totals.revenue)}`);
      if (spec.totals.tech) cells.push(`<b>Tech:</b> ${money(data.totals.tech)}`);
      if (spec.totals.office) cells.push(`<b>Office:</b> ${money(data.totals.office)}`);
      if (spec.totals.marketer) cells.push(`<b>Marketer:</b> ${money(data.totals.marketer)}`);
      if (cells.length) {
        parts.push(
          `<p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:13px;">${cells.join("&nbsp;&nbsp;&nbsp;&nbsp;")}</p>`
        );
      }
    }
    if (section.id === "balance") {
      if (data.balanceSummaries.length) {
        const rows = data.balanceSummaries
          .map(
            (s) =>
              `<tr><td style="padding:4px 8px;border:1px solid #ddd;">${esc(s.marketer)}</td>` +
              `<td style="padding:4px 8px;border:1px solid #ddd;text-align:right;">${s.jobsCount}</td>` +
              `<td style="padding:4px 8px;border:1px solid #ddd;text-align:right;">${money(s.totalEarned)}</td>` +
              `<td style="padding:4px 8px;border:1px solid #ddd;text-align:right;">${money(s.net)}</td>` +
              `<td style="padding:4px 8px;border:1px solid #ddd;">${esc(balanceLabel(s.net))}</td></tr>`
          )
          .join("");
        parts.push(
          `<h3 style="margin:12px 0 6px;font-family:Arial,sans-serif;font-size:14px;">Balance summary</h3>` +
            `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;margin-bottom:12px;">` +
            `<thead><tr>` +
            `<th style="padding:4px 8px;border:1px solid #ddd;text-align:left;background:#f3f3f3;">Marketer</th>` +
            `<th style="padding:4px 8px;border:1px solid #ddd;text-align:right;background:#f3f3f3;">Jobs</th>` +
            `<th style="padding:4px 8px;border:1px solid #ddd;text-align:right;background:#f3f3f3;">Earned</th>` +
            `<th style="padding:4px 8px;border:1px solid #ddd;text-align:right;background:#f3f3f3;">Net</th>` +
            `<th style="padding:4px 8px;border:1px solid #ddd;text-align:left;background:#f3f3f3;">Status</th>` +
            `</tr></thead><tbody>${rows}</tbody></table>` +
            `<p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:13px;"><b>Total net: ${money(data.balanceGrandNet)}</b></p>`
        );
      } else {
        parts.push(`<p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:12px;color:#777;">No completed jobs for the balance summary.</p>`);
      }
    }
    if (section.id === "table") {
      const head = data.tableColumns
        .map((c) => `<th style="padding:4px 6px;border:1px solid #ddd;background:#3c3c3c;color:#fff;text-align:left;">${esc(c.label)}</th>`)
        .join("");
      const body = data.tableRows
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td style="padding:3px 6px;border:1px solid #ddd;">${esc(cell)}</td>`).join("")}</tr>`
        )
        .join("");
      parts.push(
        `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:11px;width:100%;">` +
          `<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
      );
    }
  }

  void enabled;
  return `<div>${parts.join("\n")}</div>`;
}
