import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { JobDialog } from "@/components/AddJobDialog";
import { toast } from "sonner";
import { loadAITraining, applyMarketerRules, recordMatchOverride } from "@/lib/aiTraining";
import { fetchCandidateJobs, findMatches, type JobLite, type ScoredMatch } from "@/lib/jobMatching";
import { MatchReviewDialog } from "@/components/parseMessage/MatchReviewDialog";
import { DiffPreviewDialog } from "@/components/parseMessage/DiffPreviewDialog";

type Prefill = {
  phone_no?: string;
  address?: string;
  job_type?: string;
  job_date?: string;
  notes?: string;
  price?: string;
  parts?: string;
  co_parts?: string;
  office_parts?: string;
  tech_name?: string;
  payment?: string;
  customer_name?: string;
  _companyName?: string;
};

export function ParseMessageDialog({ onJobSaved }: { onJobSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);

  const [matches, setMatches] = useState<ScoredMatch[]>([]);
  const [matchReviewOpen, setMatchReviewOpen] = useState(false);
  const [confirmNewOpen, setConfirmNewOpen] = useState(false);

  const [pickedJob, setPickedJob] = useState<JobLite | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [lastSnippet, setLastSnippet] = useState("");

  function buildPrefill(ex: any): Prefill {
    const noteParts: string[] = [];
    if (ex.customer_name) noteParts.push(`Customer: ${ex.customer_name}`);
    if (ex.notes) noteParts.push(ex.notes);
    return {
      phone_no: ex.phone_no || "",
      address: ex.address || "",
      job_type: ex.job_type || "",
      job_date: ex.job_date || "",
      notes: noteParts.join(" • "),
      price: ex.price != null ? String(ex.price) : "",
      parts: ex.parts != null ? String(ex.parts) : "",
      co_parts: ex.co_parts != null ? String(ex.co_parts) : "",
      office_parts: ex.office_parts != null ? String(ex.office_parts) : "",
      tech_name: ex.tech_name || "",
      payment: ex.payment || "",
      customer_name: ex.customer_name || "",
      _companyName: ex.company || "",
    };
  }

  async function handleParse() {
    const trimmed = message.trim();
    if (!trimmed) {
      toast.error("Please paste a message first");
      return;
    }
    if (trimmed.length > 5000) {
      toast.error("Message too long (max 5000 chars)");
      return;
    }
    setLoading(true);
    try {
      const [companiesRes, techsRes, jobTypesRes, training, candidates] = await Promise.all([
        supabase.from("companies").select("company_name"),
        supabase.from("technicians").select("tech_name"),
        supabase.from("job_types").select("name"),
        loadAITraining(),
        fetchCandidateJobs(),
      ]);

      const { data, error } = await supabase.functions.invoke("parse-job-message", {
        body: {
          message: trimmed,
          companies: (companiesRes.data || []).map((c) => c.company_name),
          technicians: (techsRes.data || []).map((t) => t.tech_name),
          jobTypes: (jobTypesRes.data || []).map((j) => j.name),
          generalRules: training.generalRules || "",
          marketerRules: training.marketerRules || [],
          recentCorrections: (training.corrections || []).slice(0, 25),
        },
      });

      if (error) {
        const msg = (error as any).message || "";
        if (msg.includes("429")) toast.error("Rate limit reached. Try again shortly.");
        else if (msg.includes("402")) toast.error("AI credits exhausted. Add credits in Settings → Workspace.");
        else toast.error("Could not parse message. Try again.");
        return;
      }

      const ex = data?.extracted || {};

      const ruleMatch = applyMarketerRules(
        { company: ex.company, customer_name: ex.customer_name, notes: ex.notes },
        trimmed,
        training.marketerRules || []
      );
      if (ruleMatch && (!ex.company || ex.company.toLowerCase() !== ruleMatch.toLowerCase())) {
        ex.company = ruleMatch;
      }

      const next = buildPrefill(ex);
      setLastSnippet(trimmed);

      // Local match
      const found = findMatches(
        {
          phone_no: ex.phone_no,
          address: ex.address,
          customer_name: ex.customer_name,
        },
        candidates
      );

      setPrefill(next);
      setOpen(false);
      setMessage("");

      if (found.length > 0) {
        setMatches(found);
        setTimeout(() => setMatchReviewOpen(true), 50);
      } else {
        setTimeout(() => setConfirmNewOpen(true), 50);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to parse message");
    } finally {
      setLoading(false);
    }
  }

  function openNewJobFlow() {
    setTimeout(() => setJobDialogOpen(true), 50);
  }

  async function handlePickJob(jobId: string, suggestedJobId: string | null) {
    const m = matches.find((x) => x.job.id === jobId);
    if (!m) return;
    if (suggestedJobId && suggestedJobId !== jobId) {
      await recordMatchOverride({
        phone: prefill?.phone_no,
        customerNameParsed: prefill?.customer_name,
        addressParsed: prefill?.address,
        pickedJobId: jobId,
        suggestedJobId,
        snippet: lastSnippet.slice(0, 120),
      });
    }
    setPickedJob(m.job);
    setMatchReviewOpen(false);
    setTimeout(() => setDiffOpen(true), 50);
  }

  async function handleCreateNewFromMatch(suggestedJobId: string | null) {
    if (suggestedJobId) {
      await recordMatchOverride({
        phone: prefill?.phone_no,
        customerNameParsed: prefill?.customer_name,
        addressParsed: prefill?.address,
        pickedJobId: null,
        suggestedJobId,
        snippet: lastSnippet.slice(0, 120),
      });
    }
    setMatchReviewOpen(false);
    openNewJobFlow();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Sparkles className="h-4 w-4 mr-2" /> Parse Message
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Parse Job from Message</DialogTitle>
            <DialogDescription>
              Paste a WhatsApp/SMS job message. AI will extract details, check for an existing job from the last 30 days, and let you confirm an update or create a new job.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`Customer: John Smith\nPhone: +1 555-1234\nAddress: 123 Main St, Atlanta GA\nGarage Door Repair\nClosed 350$\nParts 40$`}
            rows={10}
            maxLength={5000}
            className="font-mono text-sm"
          />
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>{message.length} / 5000</span>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
            <Button onClick={handleParse} disabled={loading || !message.trim()}>
              {loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Parsing...</>) : (<><Sparkles className="h-4 w-4 mr-2" /> Parse & Continue</>)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {prefill && matches.length > 0 && (
        <MatchReviewDialog
          open={matchReviewOpen}
          onOpenChange={setMatchReviewOpen}
          parsed={prefill}
          matches={matches}
          onPickJob={handlePickJob}
          onCreateNew={handleCreateNewFromMatch}
        />
      )}

      {/* No-match confirmation */}
      <Dialog open={confirmNewOpen} onOpenChange={setConfirmNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>No matching job found</DialogTitle>
            <DialogDescription>
              I didn't find a scheduled job from the last 30 days matching the phone, address or customer. Create a new job?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmNewOpen(false)}>Cancel</Button>
            <Button onClick={() => { setConfirmNewOpen(false); openNewJobFlow(); }}>Create new job</Button>
          </div>
        </DialogContent>
      </Dialog>

      {prefill && pickedJob && (
        <DiffPreviewDialog
          open={diffOpen}
          onOpenChange={setDiffOpen}
          job={pickedJob}
          parsed={prefill}
          snippet={lastSnippet}
          onApplied={() => { onJobSaved(); setPickedJob(null); }}
        />
      )}

      {prefill && (
        <JobDialog
          onJobSaved={() => { onJobSaved(); }}
          open={jobDialogOpen}
          onOpenChange={(o) => { setJobDialogOpen(o); }}
          prefill={prefill}
        />
      )}
    </>
  );
}
