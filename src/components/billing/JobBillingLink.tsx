import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Receipt } from "lucide-react";
import { DocumentEditorDialog } from "@/components/billing/DocumentEditorDialog";
import { loadDocumentsForJob, money, type BillingDoc } from "@/lib/billing";

/** Compact billing section shown inside the job form (edit mode). */
export function JobBillingLink({ jobId }: { jobId: string }) {
  const [docs, setDocs] = useState<BillingDoc[]>([]);

  function refresh() {
    loadDocumentsForJob(jobId).then(setDocs).catch(() => setDocs([]));
  }
  useEffect(refresh, [jobId]);

  return (
    <div className="md:col-span-2 mt-2 pt-3 border-t">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Receipt className="h-3.5 w-3.5" /> Estimates &amp; Invoices
        </label>
        <div className="flex gap-1">
          <DocumentEditorDialog
            kind="estimate" presetJobId={jobId} onSaved={refresh}
            trigger={<Button type="button" variant="outline" size="sm">New estimate</Button>}
          />
          <DocumentEditorDialog
            kind="invoice" presetJobId={jobId} onSaved={refresh}
            trigger={<Button type="button" variant="outline" size="sm">New invoice</Button>}
          />
        </div>
      </div>
      {docs.length === 0 ? (
        <p className="text-xs text-muted-foreground mt-1">
          Nothing linked yet. Create one here, or attach an existing document from the{" "}
          <Link to="/billing" className="text-primary hover:underline">Billing page</Link>.
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="capitalize">{d.kind}</Badge>
              <span className="font-medium">{d.doc_number}</span>
              <span className="text-muted-foreground capitalize">· {d.status}</span>
              <span className="ml-auto">{money(d.total)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
