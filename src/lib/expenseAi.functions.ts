import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

const ParseInput = z.object({ expenseId: z.string().uuid() });

const invoiceSchema = {
  type: "object",
  properties: {
    vendor_name: { type: "string", description: "Name of the seller/vendor/store" },
    vendor_tax_id: { type: "string" },
    invoice_number: { type: "string" },
    customer_po: {
      type: "string",
      description: "Customer PO number / Purchase Order # / PO Number / Your Reference printed on the invoice",
    },
    invoice_date: { type: "string", description: "ISO date YYYY-MM-DD" },
    currency: { type: "string", description: "3-letter currency code" },
    subtotal: { type: "number" },
    tax_rate: { type: "number", description: "As a percent, e.g. 8.25" },
    tax_amount: { type: "number" },
    total: { type: "number" },
    suggested_account_hint: {
      type: "string",
      description:
        "MUST match one of the provided existing account names exactly when possible; otherwise a short category like 'Fuel' or 'Parts & Materials'",
    },
    line_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          product_number: { type: "string", description: "SKU / product code / item # / part number printed on the line" },
          quantity: { type: "number" },
          unit_price: { type: "number" },
          line_total: { type: "number" },
        },
        required: ["description"],
        additionalProperties: false,
      },
    },
  },
  required: ["vendor_name", "total"],
  additionalProperties: false,
} as const;

/** Reads every uploaded page of an expense and fills its fields + line items with AI. */
export const parseExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ParseInput.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const userId = context.userId;

    const { data: pages } = await supabase
      .from("expense_attachments")
      .select("file_path, file_mime, position")
      .eq("expense_id", data.expenseId)
      .order("position");
    if (!pages || !pages.length) throw new Error("No files on this expense");

    const contentBlocks: any[] = [];
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const { data: signed } = await supabase.storage.from("expense-files").createSignedUrl(p.file_path, 300);
      if (!signed?.signedUrl) throw new Error(`Cannot read page ${i + 1}`);
      const fileRes = await fetch(signed.signedUrl);
      if (!fileRes.ok) throw new Error(`Failed to fetch page ${i + 1}`);
      const b64 = Buffer.from(await fileRes.arrayBuffer()).toString("base64");
      const mime = p.file_mime || "application/octet-stream";
      contentBlocks.push(
        mime === "application/pdf"
          ? { type: "file", file: { filename: `page-${i + 1}.pdf`, file_data: `data:${mime};base64,${b64}` } }
          : { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
      );
    }

    const { data: accounts } = await supabase.from("expense_accounts").select("id, name, number");
    const accountList =
      (accounts ?? []).map((a: any) => `${a.name}${a.number ? ` (${a.number})` : ""}`).join(", ") || "none configured";

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const res = await fetch(`${GATEWAY}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You extract invoice/receipt fields as strict JSON. The user may provide multiple pages of the SAME invoice — treat them as one document, merging line items across pages and using totals from the final page. Numbers are unformatted (no currency symbols or thousand separators). Dates in YYYY-MM-DD. If a field is unknown, omit it. tax_rate is a percent (e.g. 8.25).",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract fields from this invoice (${pages.length} page${pages.length === 1 ? "" : "s"}). Existing accounts to consider for suggested_account_hint: ${accountList}.`,
              },
              ...contentBlocks,
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: { name: "record_invoice", description: "Record structured invoice data", parameters: invoiceSchema },
          },
        ],
        tool_choice: { type: "function", function: { name: "record_invoice" } },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 429) throw new Error("Rate limit — please try again in a minute.");
      if (res.status === 402) throw new Error("AI credits exhausted. Please add credits to continue.");
      throw new Error(`AI error [${res.status}]: ${errText}`);
    }

    const json = await res.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("AI returned no structured output");
    const parsed = JSON.parse(call.function.arguments);

    // Vendor: reuse an existing name-match, otherwise create it.
    let vendorId: string | null = null;
    if (parsed.vendor_name) {
      const { data: existing } = await supabase.from("vendors").select("id").ilike("name", parsed.vendor_name).maybeSingle();
      if (existing) vendorId = existing.id;
      else {
        const { data: newVendor } = await supabase
          .from("vendors")
          .insert({ name: parsed.vendor_name, tax_id: parsed.vendor_tax_id ?? null, created_by: userId })
          .select("id")
          .single();
        vendorId = newVendor?.id ?? null;
      }
    }

    // Account: exact (case-insensitive) match first, then contains.
    let accountId: string | null = null;
    let accountName: string | null = null;
    if (parsed.suggested_account_hint && accounts?.length) {
      const hint = String(parsed.suggested_account_hint).toLowerCase().trim();
      const match =
        accounts.find((a: any) => a.name.toLowerCase() === hint) ??
        accounts.find(
          (a: any) => hint.includes(a.name.toLowerCase()) || a.name.toLowerCase().includes(hint),
        );
      if (match) {
        accountId = match.id;
        accountName = match.name;
      }
    }

    const refNo = parsed.invoice_number || parsed.customer_po || null;
    const subject =
      [accountName, parsed.vendor_name, refNo ? `#${refNo}` : null].filter(Boolean).join(" — ") || null;

    await supabase
      .from("expenses")
      .update({
        vendor_id: vendorId,
        account_id: accountId,
        invoice_number: parsed.invoice_number ?? null,
        customer_po: parsed.customer_po ?? null,
        subject,
        invoice_date: parsed.invoice_date ?? null,
        currency: parsed.currency ?? "USD",
        subtotal: parsed.subtotal ?? null,
        tax_rate: parsed.tax_rate ?? null,
        tax_amount: parsed.tax_amount ?? null,
        total: parsed.total ?? null,
        ai_raw: parsed,
      })
      .eq("id", data.expenseId);

    if (Array.isArray(parsed.line_items) && parsed.line_items.length) {
      await supabase.from("expense_line_items").delete().eq("expense_id", data.expenseId);
      const rows = parsed.line_items.map((li: any, i: number) => ({
        expense_id: data.expenseId,
        description: (li.description ?? "").trim() || null,
        product_number: (li.product_number ?? "").toString().trim() || null,
        quantity: li.quantity ?? 1,
        unit_price: li.unit_price ?? null,
        line_total: li.line_total ?? null,
        position: i,
      }));
      if (rows.length) await supabase.from("expense_line_items").insert(rows);
    }

    return { ok: true as const, pageCount: pages.length };
  });
