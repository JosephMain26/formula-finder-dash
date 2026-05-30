import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileDown } from "lucide-react";
import { MobileNav } from "@/components/MobileNav";
import { DatePickerField } from "@/components/DatePickerField";
import { resolvePreset, type DatePreset } from "@/components/DateRangePresets";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import {
  summarizeByMarketer,
  type MarketerBalanceSummary,
} from "@/lib/marketerBalance";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Job = Tables<"jobs">;

export const Route = createFileRoute("/balances")({
  component: BalancesPage,
  head: () => ({
    meta: [
      { title: "Marketer Balances - Jobs Dashboard" },
      { name: "description", content: "Weekly balance due between the office and each marketer" },
    ],
  }),
});

const LAST_WEEK: DatePreset = {
  id: "last-mon-sun",
  name: "Last week",
  type: "dynamic",
  startDay: 1,
  endDay: 0,
  weekOffset: -1,
};
const THIS_WEEK: DatePreset = {
  id: "this-mon-sun",
  name: "This week",
  type: "dynamic",
  startDay: 1,
  endDay: 0,
  weekOffset: 0,
};

function money(n: number) {
  const v = `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return n < 0 ? `-${v}` : v;
}

function balanceLabel(net: number): string {
  if (Math.abs(net) < 0.005) return "Settled";
  return net > 0 ? "Office owes marketer" : "Marketer owes office";
}

function BalancesPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const lastWeek = resolvePreset(LAST_WEEK)!;
  const [dateFrom, setDateFrom] = useState(lastWeek.from);
  const [dateTo, setDateTo] = useState(lastWeek.to);

  const [paidFilter, setPaidFilter] = useState("all"); // all | paid | unpaid
  const [collectedFilter, setCollectedFilter] = useState("all"); // all | marketer | office
  const [marketerFilter, setMarketerFilter] = useState("all");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("jobs")
        .select("*")
        .order("job_date", { ascending: false });
      setJobs((data as Job[]) || []);
      setLoading(false);
    })();
  }, []);

  const uniques = useMemo(() => ({
    marketers: [...new Set(jobs.map((j) => (j.company_1 || j.company || "").trim()).filter(Boolean))].sort(),
    jobTypes: [...new Set(jobs.map((j) => (j.job_type || "").trim()).filter(Boolean))].sort(),
  }), [jobs]);

  const filteredJobs = useMemo(() => jobs.filter((j) => {
    if (paidFilter === "paid" && !j.paid) return false;
    if (paidFilter === "unpaid" && j.paid) return false;
    if (collectedFilter === "marketer" && !(j as any).marketer_collected) return false;
    if (collectedFilter === "office" && (j as any).marketer_collected) return false;
    if (marketerFilter !== "all" && (j.company_1 || j.company || "").trim() !== marketerFilter) return false;
    if (jobTypeFilter !== "all" && (j.job_type || "").trim() !== jobTypeFilter) return false;
    return true;
  }), [jobs, paidFilter, collectedFilter, marketerFilter, jobTypeFilter]);

  const summaries = useMemo(
    () => summarizeByMarketer(filteredJobs, dateFrom, dateTo),
    [filteredJobs, dateFrom, dateTo]
  );

  function applyPreset(p: DatePreset) {
    const r = resolvePreset(p);
    if (r) { setDateFrom(r.from); setDateTo(r.to); }
  }

  function downloadPdf(s: MarketerBalanceSummary) {
    const doc = new jsPDF();
    let y = 16;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Marketer Balance Statement", 14, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Marketer: ${s.marketer}`, 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.text(`Period: ${dateFrom || "Beginning"}  ->  ${dateTo || "Today"}`, 14, y);
    y += 5;
    doc.text(`Completed jobs: ${s.jobsCount}`, 14, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [["Date", "Job Type", "Price", "Marketer Share", "Collected By", "Net (office view)"]],
      body: s.rows.map((r) => [
        r.job.job_date ? new Date(r.job.job_date).toLocaleDateString() : "—",
        r.job.job_type || "—",
        money(Number(r.job.price || 0)),
        money(r.earned),
        (r.job as any).marketer_collected ? "Marketer" : "Office/Tech",
        money(r.net),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [60, 60, 60] },
      margin: { left: 8, right: 8 },
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Net balance: ${money(s.net)}`, 14, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(balanceLabel(s.net), 14, y);

    const safe = s.marketer.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    doc.save(`balance-${safe}-${dateTo || new Date().toISOString().slice(0, 10)}.pdf`);
  }

  const grandNet = summaries.reduce((acc, s) => acc + s.net, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <MobileNav className="md:hidden" />
          <Button variant="ghost" size="icon" asChild className="hidden md:inline-flex">
            <Link to="/"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Marketer Balances</h1>
            <p className="text-sm text-muted-foreground">Weekly balance due between the office and each marketer</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Period</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => applyPreset(LAST_WEEK)}>Last week (Mon–Sun)</Button>
              <Button variant="outline" size="sm" onClick={() => applyPreset(THIS_WEEK)}>This week (Mon–Sun)</Button>
            </div>
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <div>
                <label className="text-xs text-muted-foreground">From</label>
                <DatePickerField value={dateFrom} onChange={setDateFrom} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">To</label>
                <DatePickerField value={dateTo} onChange={setDateTo} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Select value={paidFilter} onValueChange={setPaidFilter}>
                <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Payment" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All payments</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
              <Select value={collectedFilter} onValueChange={setCollectedFilter}>
                <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Collected by" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Collected by anyone</SelectItem>
                  <SelectItem value="marketer">Collected by marketer</SelectItem>
                  <SelectItem value="office">Collected by office/tech</SelectItem>
                </SelectContent>
              </Select>
              <Select value={marketerFilter} onValueChange={setMarketerFilter}>
                <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Marketer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All marketers</SelectItem>
                  {uniques.marketers.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
                <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Job type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All job types</SelectItem>
                  {uniques.jobTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>


        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Balances ({summaries.length} marketers)</CardTitle>
            {summaries.length > 0 && (
              <span className={cn("text-sm font-medium", grandNet >= 0 ? "text-foreground" : "text-destructive")}>
                Total net: {money(Math.round(grandNet * 100) / 100)}
              </span>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
            ) : summaries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No completed jobs in this period.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Marketer</TableHead>
                    <TableHead className="text-right">Jobs</TableHead>
                    <TableHead className="text-right">Earned</TableHead>
                    <TableHead className="text-right">Collected by marketer</TableHead>
                    <TableHead className="text-right">Net balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Report</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaries.map((s) => (
                    <TableRow key={s.marketer}>
                      <TableCell className="font-medium">{s.marketer}</TableCell>
                      <TableCell className="text-right">{s.jobsCount}</TableCell>
                      <TableCell className="text-right">{money(s.totalEarned)}</TableCell>
                      <TableCell className="text-right">{money(s.totalCollectedByMarketer)}</TableCell>
                      <TableCell className={cn("text-right font-semibold", s.net < 0 ? "text-destructive" : "text-foreground")}>
                        {money(s.net)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{balanceLabel(s.net)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => downloadPdf(s)}>
                          <FileDown className="h-4 w-4 mr-1" /> PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
