import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { JobDialog } from "@/components/AddJobDialog";
import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;

interface JobsTableProps {
  jobs: Job[];
  onJobsChanged: () => void;
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const lower = status.toLowerCase();
  let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
  if (lower === "completed" || lower === "done") variant = "default";
  else if (lower === "pending") variant = "secondary";
  else if (lower === "cancelled" || lower === "canceled") variant = "destructive";
  return <Badge variant={variant}>{status}</Badge>;
}

function currency(val: number | null) {
  if (val == null) return "—";
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function JobsTable({ jobs, onJobsChanged }: JobsTableProps) {
  async function deleteJob(id: string) {
    if (!confirm("Are you sure you want to delete this job?")) return;
    await supabase.from("jobs").delete().eq("id", id);
    onJobsChanged();
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No jobs found</p>
        <p className="text-sm mt-1">Try adjusting your filters or add a new job.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[80px]">Actions</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Tech</TableHead>
            <TableHead>PO #</TableHead>
            <TableHead>Job Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Co Parts</TableHead>
            <TableHead className="text-right">Tech %</TableHead>
            <TableHead className="text-right">Total Tech</TableHead>
            <TableHead className="text-right">Total Office</TableHead>
            <TableHead className="text-right">Tip</TableHead>
            <TableHead className="text-right">CC Fee</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Paid</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell>
                <div className="flex gap-1">
                  <JobDialog
                    job={job}
                    onJobSaved={onJobsChanged}
                    trigger={<Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>}
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteJob(job.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">
                {job.job_date ? new Date(job.job_date).toLocaleDateString() : "—"}
              </TableCell>
              <TableCell className="text-sm font-medium">{job.company_1 || job.company || "—"}</TableCell>
              <TableCell className="text-sm">{job.tech_name || "—"}</TableCell>
              <TableCell className="text-sm">{job.po_number || "—"}</TableCell>
              <TableCell className="text-sm">{job.job_type || "—"}</TableCell>
              <TableCell><StatusBadge status={job.status} /></TableCell>
              <TableCell className="text-right text-sm font-medium">{currency(job.price)}</TableCell>
              <TableCell className="text-right text-sm">{currency(job.co_parts)}</TableCell>
              <TableCell className="text-right text-sm">{job.manual_percentage != null ? `${job.manual_percentage}%` : "—"}</TableCell>
              <TableCell className="text-right text-sm font-medium text-primary">{currency(job.total_tech)}</TableCell>
              <TableCell className="text-right text-sm font-medium">{currency(job.total_office)}</TableCell>
              <TableCell className="text-right text-sm">{currency(job.tip)}</TableCell>
              <TableCell className="text-right text-sm">{currency(job.cc_fee)}</TableCell>
              <TableCell className="text-sm">{job.payment || "—"}</TableCell>
              <TableCell>
                <span className={`inline-flex h-2 w-2 rounded-full ${job.paid ? "bg-success" : "bg-muted-foreground/30"}`} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
