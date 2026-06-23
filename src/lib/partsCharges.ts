import { supabase } from "@/integrations/supabase/client";

/**
 * Flat fees charged to a company/marketer for parts purchased on their behalf.
 * These are NOT jobs — they represent money the company owes the office, so in
 * the marketer balance they reduce the net amount the office owes the marketer.
 *
 * `marketer` matches the same name string used for jobs (company_1 / company),
 * so charges group alongside a marketer's job-based balance.
 */
export interface PartsCharge {
  id: string;
  marketer: string;
  amount: number;
  charge_date: string | null;
  description: string | null;
  paid: boolean;
  created_at?: string;
  updated_at?: string;
}

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export async function loadPartsCharges(): Promise<PartsCharge[]> {
  const { data, error } = await supabase
    .from("parts_charges" as any)
    .select("*")
    .order("charge_date", { ascending: false });
  if (error) throw error;
  return ((data as any[]) || []).map((r) => ({
    id: r.id,
    marketer: (r.marketer || "").trim(),
    amount: num(r.amount),
    charge_date: r.charge_date,
    description: r.description,
    paid: !!r.paid,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export async function upsertPartsCharge(
  charge: Partial<PartsCharge> & { marketer: string; amount: number }
): Promise<void> {
  const payload = {
    marketer: charge.marketer.trim(),
    amount: num(charge.amount),
    charge_date: charge.charge_date || null,
    description: charge.description?.trim() || null,
  };
  if (charge.id) {
    const { error } = await supabase
      .from("parts_charges" as any)
      .update(payload)
      .eq("id", charge.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("parts_charges" as any).insert(payload);
    if (error) throw error;
  }
}

export async function deletePartsCharge(id: string): Promise<void> {
  const { error } = await supabase.from("parts_charges" as any).delete().eq("id", id);
  if (error) throw error;
}

/** Filter charges to an inclusive date range (by charge_date). */
export function filterChargesByRange(
  charges: PartsCharge[],
  fromDate?: string,
  toDate?: string
): PartsCharge[] {
  return charges.filter((c) => {
    if (fromDate && (!c.charge_date || c.charge_date < fromDate)) return false;
    if (toDate && (!c.charge_date || c.charge_date > toDate)) return false;
    return true;
  });
}
