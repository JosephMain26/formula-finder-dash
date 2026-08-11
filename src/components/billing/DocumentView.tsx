import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import {
  computeTotals, docDiscountAmounts, itemGross, itemDiscount, loadItems, money,
  type BillingDoc, type BillingItem,
} from "@/lib/billing";

interface Props {
  doc: BillingDoc | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/** Read-only, print-friendly view of an estimate/invoice, including the signature audit block. */
export function DocumentView({ doc, open, onOpenChange }: Props) {
  const [items, setItems] = useState<BillingItem[]>([]);

  useEffect(() => {
    if (open && doc?.id) loadItems(doc.id).then(setItems);
  }, [open, doc?.id]);

  if (!doc) return null;
  const totals = computeTotals(items, doc.discounts, doc.tax_rate);
  const docAmounts = docDiscountAmounts(items, doc.discounts);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>{doc.kind === "estimate" ? "Estimate" : "Invoice"} {doc.doc_number}</span>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5 mr-1" /> Print / PDF
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div id="billing-print" className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Billed to</div>
              <div className="font-medium">{doc.client_name || "—"}</div>
              {doc.client_email && <div>{doc.client_email}</div>}
              {doc.client_phone && <div>{doc.client_phone}</div>}
              {doc.client_address && <div className="text-muted-foreground">{doc.client_address}</div>}
            </div>
            <div className="text-right">
              <div>Issued: {doc.issue_date || "—"}</div>
              <div>{doc.kind === "invoice" ? "Due" : "Valid until"}: {doc.due_date || "—"}</div>
              <div className="capitalize">Status: {doc.status}</div>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left py-1">Description</th>
                <th className="text-right py-1">Qty</th>
                <th className="text-right py-1">Unit</th>
                <th className="text-right py-1">Discount</th>
                <th className="text-right py-1">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-b last:border-0">
                  <td className="py-1">{i.description}</td>
                  <td className="py-1 text-right">{i.qty}</td>
                  <td className="py-1 text-right">{money(i.unit_price)}</td>
                  <td className="py-1 text-right">{itemDiscount(i) ? `-${money(itemDiscount(i))}` : "—"}</td>
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
            {doc.discounts.map((d, i) => (
              <div key={d.id} className="flex justify-between">
                <span className="text-muted-foreground">{d.label} {d.type === "percent" ? `(${d.value}%)` : ""}</span>
                <span>-{money(docAmounts[i] || 0)}</span>
              </div>
            ))}
            <div className="flex justify-between"><span className="text-muted-foreground">Tax ({doc.tax_rate}%)</span><span>{money(totals.tax_total)}</span></div>
            <div className="flex justify-between font-semibold border-t pt-1"><span>Total</span><span>{money(totals.total)}</span></div>
            {doc.kind === "invoice" && (
              <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span>{money(doc.amount_paid)}</span></div>
            )}
          </div>

          {doc.notes && <div><div className="text-xs text-muted-foreground">Notes</div><p>{doc.notes}</p></div>}
          {doc.terms && <div><div className="text-xs text-muted-foreground">Terms</div><p>{doc.terms}</p></div>}

          {doc.signed_at ? (
            <div className="rounded-md border p-3 space-y-2">
              <div className="text-xs font-medium">Approved &amp; signed by client</div>
              {doc.signature_data_url && (
                <img src={doc.signature_data_url} alt="Client signature" className="h-20 bg-white rounded border" />
              )}
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div>Name: {doc.signer_name}</div>
                <div>Date &amp; time: {new Date(doc.signed_at).toLocaleString()}</div>
                <div>IP address: {doc.signed_ip || "unknown"}</div>
                <div className="break-all">Device: {doc.signed_user_agent || "unknown"}</div>
              </div>
            </div>
          ) : doc.approved_at ? (
            <div className="rounded-md border p-3 text-xs text-muted-foreground">
              Manually approved by {doc.approved_by || "office"} on {new Date(doc.approved_at).toLocaleString()}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
