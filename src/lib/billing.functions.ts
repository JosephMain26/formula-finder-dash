import { createServerFn } from "@tanstack/react-start";
import { getRequest, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const TokenSchema = z.object({ token: z.string().min(10).max(120) });

const SignSchema = z.object({
  token: z.string().min(10).max(120),
  fullName: z.string().trim().min(2).max(120),
  signature: z.string().min(100).max(400000).refine((s) => s.startsWith("data:image/"), {
    message: "Invalid signature image",
  }),
});

const SAFE_COLUMNS =
  "id, kind, doc_number, client_name, client_email, client_phone, client_address, status, issue_date, due_date, tax_rate, notes, terms, discounts, subtotal, discount_total, tax_total, total, signer_name, signature_data_url, signed_ip, signed_at, signed_user_agent, share_expires_at";

/** Public, read-only view of a shared estimate/invoice by share token. */
export const getPublicDocument = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: doc, error } = await (supabaseAdmin as any)
      .from("billing_documents")
      .select(SAFE_COLUMNS)
      .eq("share_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) return { ok: false as const, reason: "not_found" as const };
    if (doc.share_expires_at && new Date(doc.share_expires_at).getTime() < Date.now()) {
      return { ok: false as const, reason: "expired" as const };
    }
    const { data: items } = await (supabaseAdmin as any)
      .from("billing_items")
      .select("id, description, qty, unit_price, discount_type, discount_value, sort_order")
      .eq("document_id", doc.id)
      .order("sort_order");
    return { ok: true as const, doc, items: (items as any[]) || [] };
  });

/** Client-side approval: records name, drawn signature, IP, time and device. */
export const signDocument = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SignSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: doc, error } = await (supabaseAdmin as any)
      .from("billing_documents")
      .select("id, status, signed_at, share_expires_at")
      .eq("share_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) return { ok: false as const, reason: "not_found" as const };
    if (doc.share_expires_at && new Date(doc.share_expires_at).getTime() < Date.now()) {
      return { ok: false as const, reason: "expired" as const };
    }
    if (doc.signed_at) return { ok: false as const, reason: "already_signed" as const };

    const forwarded = getRequestHeader("x-forwarded-for") || "";
    const ip =
      getRequestHeader("cf-connecting-ip") ||
      forwarded.split(",")[0]?.trim() ||
      getRequestHeader("x-real-ip") ||
      null;
    let ua = getRequestHeader("user-agent") || null;
    if (!ua) {
      try {
        ua = getRequest().headers.get("user-agent");
      } catch {
        ua = null;
      }
    }

    const { error: upErr } = await (supabaseAdmin as any)
      .from("billing_documents")
      .update({
        status: "approved",
        approval_mode: "client_signature",
        approved_at: new Date().toISOString(),
        approved_by: data.fullName,
        signer_name: data.fullName,
        signature_data_url: data.signature,
        signed_ip: ip,
        signed_at: new Date().toISOString(),
        signed_user_agent: ua,
      })
      .eq("id", doc.id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true as const };
  });
