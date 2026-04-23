import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { JobDialog } from "@/components/AddJobDialog";
import { EditableCell } from "@/components/EditableCell";
import type { Tables } from "@/integrations/supabase/types";
import type { ColumnKey } from "@/components/ColumnToggle";

const STATUS_OPTIONS = ["Pending", "Completed", "Cancelled", "In Progress"];

type Job = Tables<"jobs">;

interface JobsTableProps {
  jobs: Job[];
  onJobsChanged: () => void;
  visibleColumns: Set<ColumnKey>;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: (ids: string[], select: boolean) => void;
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const lower = status.toLowerCase();
  let className = "bg-muted text-muted-foreground hover:bg-muted";
  if (lower === "completed" || lower === "done") className = "bg-green-500 text-white hover:bg-green-500";
  else if (lower === "pending") className = "bg-yellow-400 text-black hover:bg-yellow-400";
  else if (lower === "cancelled" || lower === "canceled") className = "bg-red-500 text-white hover:bg-red-500";
  else if (lower === "in progress") className = "bg-blue-500 text-white hover:bg-blue-500";
  return <Badge className={className}>{status}</Badge>;
}

function currency(val: number | null) {
  if (val == null) return "—";
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function JobsTable({ jobs, onJobsChanged, visibleColumns, selectedIds, onToggleSelect, onToggleSelectAll }: JobsTableProps) {
  const show = (key: ColumnKey) => visibleColumns.has(key);
  const selectionEnabled = !!selectedIds && !!onToggleSelect;
  const allSelected = selectionEnabled && jobs.length > 0 && jobs.every((j) => selectedIds!.has(j.id));
  const someSelected = selectionEnabled && jobs.some((j) => selectedIds!.has(j.id));

  async function deleteJob(id: string) {
    if (!confirm("Are you sure you want to delete this job?")) return;
    await supabase.from("jobs").delete().eq("id", id);
    onJobsChanged();
  }

  async function togglePaid(job: Job) {
    await supabase.from("jobs").update({ paid: !job.paid }).eq("id", job.id);
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
            {selectionEnabled && (
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={(v) => onToggleSelectAll?.(jobs.map((j) => j.id), !!v)}
                  aria-label="Select all"
                />
              </TableHead>
            )}
            {show("actions") && <TableHead className="w-[80px]">Actions</TableHead>}
            {show("job_date") && <TableHead>Date</TableHead>}
            {show("company") && <TableHead>Marketer</TableHead>}
            {show("tech_name") && <TableHead>Tech</TableHead>}
            {show("po_number") && <TableHead>PO #</TableHead>}
            {show("job_type") && <TableHead>Job Type</TableHead>}
            {show("status") && <TableHead>Status</TableHead>}
            {show("price") && <TableHead className="text-right">Price</TableHead>}
            {show("co_parts") && <TableHead className="text-right">Co Parts</TableHead>}
            {show("office_parts") && <TableHead className="text-right">Office Parts</TableHead>}
            {show("parts") && <TableHead className="text-right">Parts</TableHead>}
            {show("manual_percentage") && <TableHead className="text-right">Tech %</TableHead>}
            {show("total_marketer") && <TableHead className="text-right">Total Marketer</TableHead>}
            {show("total_office") && <TableHead className="text-right">Total Office</TableHead>}
            {show("total_tech") && <TableHead className="text-right">Total Tech</TableHead>}
            {show("tip") && <TableHead className="text-right">Tip</TableHead>}
            {show("cc_fee") && <TableHead className="text-right">CC Fee</TableHead>}
            {show("payment") && <TableHead>Payment</TableHead>}
            {show("paid") && <TableHead>Paid</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.id} data-state={selectionEnabled && selectedIds!.has(job.id) ? "selected" : undefined}>
              {selectionEnabled && (
                <TableCell>
                  <Checkbox
                    checked={selectedIds!.has(job.id)}
                    onCheckedChange={() => onToggleSelect!(job.id)}
                    aria-label="Select row"
                  />
                </TableCell>
              )}
              {show("actions") && (
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
              )}
              {show("job_date") && (
                <TableCell className="whitespace-nowrap text-sm p-1">
                  <EditableCell jobId={job.id} field="job_date" type="date" value={job.job_date}
                    display={<span className="px-2">{job.job_date ? new Date(job.job_date).toLocaleDateString() : "—"}</span>}
                    onSaved={onJobsChanged} />
                  {job.created_by === "remote_link" && (
                    <div
                      className="px-2 mt-0.5 text-[10px] font-semibold text-red-500 leading-tight"
                      title={`Submitted via remote upload link on ${new Date(job.created_at).toLocaleString()}`}
                    >
                      Created by remote link
                      <div className="font-normal text-red-500/80">
                        {new Date(job.created_at).toLocaleString()}
                      </div>
                    </div>
                  )}
                </TableCell>
              )}
              {show("company") && <TableCell className="text-sm font-medium">{job.company_1 || job.company || "—"}</TableCell>}
              {show("tech_name") && (
                <TableCell className="text-sm p-1">
                  <EditableCell jobId={job.id} field="tech_name" value={job.tech_name}
                    display={<span className="px-2">{job.tech_name || "—"}</span>}
                    onSaved={onJobsChanged} />
                </TableCell>
              )}
              {show("po_number") && (
                <TableCell className="text-sm p-1">
                  <EditableCell jobId={job.id} field="po_number" value={job.po_number}
                    display={<span className="px-2">{job.po_number || "—"}</span>}
                    onSaved={onJobsChanged} />
                </TableCell>
              )}
              {show("job_type") && (
                <TableCell className="text-sm p-1">
                  <EditableCell jobId={job.id} field="job_type" value={job.job_type}
                    display={<span className="px-2">{job.job_type || "—"}</span>}
                    onSaved={onJobsChanged} />
                </TableCell>
              )}
              {show("status") && (
                <TableCell className="p-1">
                  <EditableCell jobId={job.id} field="status" type="select" options={STATUS_OPTIONS} value={job.status}
                    display={<span className="px-2"><StatusBadge status={job.status} /></span>}
                    onSaved={onJobsChanged} />
                </TableCell>
              )}
              {show("price") && (
                <TableCell className="text-right text-sm font-medium p-1">
                  <EditableCell jobId={job.id} field="price" type="number" value={job.price} align="right"
                    display={<span className="px-2">{currency(job.price)}</span>}
                    onSaved={onJobsChanged} />
                </TableCell>
              )}
              {show("co_parts") && (
                <TableCell className="text-right text-sm p-1">
                  <EditableCell jobId={job.id} field="co_parts" type="number" value={job.co_parts} align="right"
                    display={<span className="px-2">{currency(job.co_parts)}</span>}
                    onSaved={onJobsChanged} />
                </TableCell>
              )}
              {show("office_parts") && (
                <TableCell className="text-right text-sm p-1">
                  <EditableCell jobId={job.id} field="office_parts" type="number" value={(job as any).office_parts ?? 0} align="right"
                    display={<span className="px-2">{currency((job as any).office_parts ?? 0)}</span>}
                    onSaved={onJobsChanged} />
                </TableCell>
              )}
              {show("parts") && (
                <TableCell className="text-right text-sm p-1">
                  <EditableCell jobId={job.id} field="parts" type="number" value={job.parts} align="right"
                    display={<span className="px-2">{currency(job.parts)}</span>}
                    onSaved={onJobsChanged} />
                </TableCell>
              )}
              {show("manual_percentage") && (
                <TableCell className="text-right text-sm p-1">
                  <EditableCell jobId={job.id} field="manual_percentage" type="number" value={job.manual_percentage} align="right"
                    display={<span className="px-2">{job.manual_percentage != null ? `${job.manual_percentage}%` : "—"}</span>}
                    onSaved={onJobsChanged} />
                </TableCell>
              )}
              {show("total_marketer") && <TableCell className="text-right text-sm font-medium">{currency((job as any).total_marketer ?? 0)}</TableCell>}
              {show("total_office") && <TableCell className="text-right text-sm font-medium">{currency(job.total_office)}</TableCell>}
              {show("total_tech") && <TableCell className="text-right text-sm font-medium text-primary">{currency(job.total_tech)}</TableCell>}
              {show("tip") && (
                <TableCell className="text-right text-sm p-1">
                  <EditableCell jobId={job.id} field="tip" type="number" value={job.tip} align="right"
                    display={<span className="px-2">{currency(job.tip)}</span>}
                    onSaved={onJobsChanged} />
                </TableCell>
              )}
              {show("cc_fee") && (
                <TableCell className="text-right text-sm p-1">
                  <EditableCell jobId={job.id} field="cc_fee" type="number" value={job.cc_fee} align="right"
                    display={<span className="px-2">{currency(job.cc_fee)}</span>}
                    onSaved={onJobsChanged} />
                </TableCell>
              )}
              {show("payment") && (
                <TableCell className="text-sm p-1">
                  <EditableCell jobId={job.id} field="payment" value={job.payment}
                    display={<span className="px-2">{job.payment || "—"}</span>}
                    onSaved={onJobsChanged} />
                </TableCell>
              )}
              {show("paid") && (
                <TableCell>
                  <button
                    onClick={() => togglePaid(job)}
                    title={job.paid ? "Mark as unpaid" : "Mark as paid"}
                    className={`inline-flex h-4 w-4 rounded-full border-2 transition-colors ${job.paid ? "bg-success border-success" : "border-muted-foreground/40 hover:border-muted-foreground"}`}
                    aria-label={job.paid ? "Paid" : "Not paid"}
                  />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
