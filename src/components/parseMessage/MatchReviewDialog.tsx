import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import type { ScoredMatch } from "@/lib/jobMatching";

type Parsed = {
  customer_name?: string;
  phone_no?: string;
  address?: string;
  price?: string;
  parts?: string;
  payment?: string;
  tech_name?: string;
  job_type?: string;
};

export function MatchReviewDialog({
  open,
  onOpenChange,
  parsed,
  matches,
  onPickJob,
  onCreateNew,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  parsed: Parsed;
  matches: ScoredMatch[];
  onPickJob: (jobId: string, suggestedJobId: string | null) => void;
  onCreateNew: (suggestedJobId: string | null) => void;
}) {
  const suggested = matches[0]?.job.id ?? null;
  const [picked, setPicked] = useState<string>(matches[0]?.job.id ?? "__new__");

  function handleContinue() {
    if (picked === "__new__") onCreateNew(suggested);
    else onPickJob(picked, suggested);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Match existing job?</DialogTitle>
          <DialogDescription>
            I found {matches.length} possible match{matches.length === 1 ? "" : "es"} from the last 30 days. Pick one to update, or create a new job.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border p-3 text-sm bg-muted/30 space-y-1">
          <div className="font-medium">Parsed details</div>
          {parsed.customer_name && <div>Customer: {parsed.customer_name}</div>}
          {parsed.phone_no && <div>Phone: {parsed.phone_no}</div>}
          {parsed.address && <div>Address: {parsed.address}</div>}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
            {parsed.price && <span>Price: ${parsed.price}</span>}
            {parsed.parts && <span>Parts: ${parsed.parts}</span>}
            {parsed.payment && <span>Payment: {parsed.payment}</span>}
            {parsed.tech_name && <span>Tech: {parsed.tech_name}</span>}
            {parsed.job_type && <span>Type: {parsed.job_type}</span>}
          </div>
        </div>

        <RadioGroup value={picked} onValueChange={setPicked} className="space-y-2">
          {matches.map((m) => (
            <label
              key={m.job.id}
              htmlFor={`m-${m.job.id}`}
              className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent"
            >
              <RadioGroupItem id={`m-${m.job.id}`} value={m.job.id} className="mt-1" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">Score {m.score}</Badge>
                  {m.reasons.map((r) => (
                    <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                  ))}
                  {m.job.status && <Badge>{m.job.status}</Badge>}
                </div>
                <div className="text-sm mt-1">
                  {m.job.job_date || "no date"} • {m.job.address || "no address"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {m.job.phone_no || "—"} • {m.job.tech_name || "no tech"} • {m.job.job_type || ""}
                </div>
              </div>
            </label>
          ))}

          <label
            htmlFor="m-new"
            className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent"
          >
            <RadioGroupItem id="m-new" value="__new__" className="mt-1" />
            <div className="flex-1">
              <div className="text-sm font-medium">Create a new job instead</div>
              <div className="text-xs text-muted-foreground">Opens the new-job form prefilled with parsed details.</div>
            </div>
          </label>
        </RadioGroup>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleContinue}>Continue</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
