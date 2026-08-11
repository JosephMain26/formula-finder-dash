import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { SignaturePad } from "@/components/billing/SignaturePad";
import { getPublicDocument, signDocument } from "@/lib/billing.functions";
import { computeTotals, docDiscountAmounts, itemDiscount, itemGross, money, type BillingItem, type DiscountRule } from "@/lib/billing";

export const Route = createFileRoute("/sign/$token")({
  head: () => ({
    meta: [
      { title: "Review & Sign Your Estimate" },
      { name: "description", content: "Review your estimate and approve it with your signature." },
      { property: "og:title", content: "Review & Sign Your Estimate" },
      { property: "og:description", content: "Review your estimate and approve it with your signature." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignPage,
});

type PublicDoc = {
  id: string;
  kind: string;
  doc_number: string;
  client_name: string | null;
  client_address: string | null;
  issue_date: string | null;
  due_date: string | null;
  tax_rate: number;
  notes: string | null;
  terms: string | null;
  discounts: DiscountRule[];
  total: number;
  signer_name: string | null;
  signature_data_url: string | null;
  signed_ip: string | null;
  signed_at: string | null;
  signed_user_agent: string | null;
};

function SignPage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [reason, setReason] = useState<string>("");
  const [doc, setDoc] = useState<PublicDoc | null>(null);
  const [items, setItems] = useState<BillingItem[]>([]);
  const [fullName, setFullName] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const res = await getPublicDocument({ data: { token } });
      if (!res.ok) { setReason(res.reason); setState("error"); return; }
      setDoc(res.doc as PublicDoc);
      setItems((res.items as any[]).map((i) => ({
        id: i.id, description: i.description, qty: Number(i.qty), unit_price: Number(i.unit_price),
        discount_type: i.discount_type, discount_value: Number(i.discount_value), sort_order: Number(i.sort_order),
      })));
      setState("ready");
    } catch {
      setReason("error");
      setState("error");
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  async function submit() {
    if (fullName.trim().length < 2) { toast.error("Please type your full name."); return; }
    if (!signature) { toast.error("Please draw your signature."); return; }
    setSubmitting(true);
    try {
      const res = await signDocument({ data: { token, fullName: fullName.trim(), signature } });
      if (!res.ok) { toast.error(res.reason === "already_signed" ? "This document was already signed." : "This link is no longer valid."); }
      else toast.success("Thank you — your approval was recorded.");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Could not submit signature");
    } finally {
      setSubmitting(false);
    }
  }

  if (state === "loading") return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (state === "error" || !doc) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Link unavailable</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {reason === "expired" ? "This approval link has expired. Please ask us for a new one." : "We couldn't find this document."}
          </p>
        </div>
      </div>
    );
  }

  const totals = computeTotals(items, doc.discounts || [], doc.tax_rate);
  const docAmounts = docDiscountAmounts(items, doc.discounts || []);

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="mx-auto max-w-2xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Estimate {doc.doc_number}</CardTitle>
            <p className="text-sm text-muted-foreground">
              For {doc.client_name || "you"} · Issued {doc.issue_date || "—"}
              {doc.due_date ? ` · Valid until ${doc.due_date}` : ""}
            </p>
          </CardHeader>
          <CardContent className="text-sm space-y-4">
            <table className="w-full">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-1">Description</th>
                  <th className="text-right py-1">Qty</th>
                  <th className="text-right py-1">Unit</th>
                  <th className="text-right py-1">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-b last:border-0">
                    <td className="py-1">{i.description}</td>
                    <td className="py-1 text-right">{i.qty}</td>
                    <td className="py-1 text-right">{money(i.unit_price)}</td>
                    <td className="py-1 text-right">{money(itemGross(i) - itemDiscount(i))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="ml-auto w-full sm:w-64 space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{money(totals.subtotal)}</span></div>
              {totals.itemDiscountTotal > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Item discounts</span><span>-{money(totals.itemDiscountTotal)}</span></div>
              )}
              {(doc.discounts || []).map((d, i) => (
                <div key={d.id} className="flex justify-between">
                  <span className="text-muted-foreground">{d.label}{d.type === "percent" ? ` (${d.value}%)` : ""}</span>
                  <span>-{money(docAmounts[i] || 0)}</span>
                </div>
              ))}
              <div className="flex justify-between"><span className="text-muted-foreground">Tax ({doc.tax_rate}%)</span><span>{money(totals.tax_total)}</span></div>
              <div className="flex justify-between font-semibold border-t pt-1"><span>Total</span><span>{money(totals.total)}</span></div>
            </div>

            {doc.notes && <div><div className="text-xs text-muted-foreground">Notes</div><p>{doc.notes}</p></div>}
            {doc.terms && <div><div className="text-xs text-muted-foreground">Terms</div><p>{doc.terms}</p></div>}
          </CardContent>
        </Card>

        {doc.signed_at ? (
          <Card>
            <CardHeader><CardTitle className="text-base">Approved</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              {doc.signature_data_url && <img src={doc.signature_data_url} alt="Signature" className="h-20 bg-white rounded border" />}
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div>Signed by: {doc.signer_name}</div>
                <div>Date &amp; time: {new Date(doc.signed_at).toLocaleString()}</div>
                <div>IP address: {doc.signed_ip || "unknown"}</div>
                <div className="break-all">Device: {doc.signed_user_agent || "unknown"}</div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader><CardTitle className="text-base">Approve this estimate</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Your full name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} placeholder="Type your full name" />
              </div>
              <div>
                <Label className="text-xs">Signature</Label>
                <SignaturePad onChange={setSignature} />
              </div>
              <p className="text-xs text-muted-foreground">
                By signing you approve this estimate. Your name, signature, IP address, date, time and device information are recorded.
              </p>
              <Button className="w-full" onClick={submit} disabled={submitting}>
                {submitting ? "Submitting…" : "Approve & sign"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
