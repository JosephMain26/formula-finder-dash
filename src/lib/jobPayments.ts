// Multiple payments recorded per job. Stored as a JSON array on the job's
// `extra_fields.payments` column (no dedicated table). Each entry records who
// received the money so marketer-collected amounts can feed the balances math.

export type PaymentRecipient = "Marketer" | "Office" | "Tech";

export const PAYMENT_RECIPIENTS: PaymentRecipient[] = ["Marketer", "Office", "Tech"];

export type JobPayment = {
  id: string;
  amount: number;
  recipient: PaymentRecipient;
  method: string;
  check_no?: string | null;
  check_front_url?: string | null;
  check_back_url?: string | null;
  date?: string | null;
};

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Read the payments array off a job's extra_fields, tolerating bad data. */
export function getJobPayments(job: any): JobPayment[] {
  const raw = job?.extra_fields?.payments;
  if (!Array.isArray(raw)) return [];
  return raw.filter((p) => p && typeof p === "object") as JobPayment[];
}

/**
 * Resolve who is assumed to have collected a job's payment, using the
 * per-marketer rule first, then the per-technician rule, then the global
 * default from Settings → Payment Collection.
 */
export function resolveDefaultRecipient(
  settings: { default: PaymentRecipient; byMarketer: Record<string, PaymentRecipient>; byTech: Record<string, PaymentRecipient> } | null,
  marketer?: string | null,
  tech?: string | null
): PaymentRecipient {
  if (!settings) return "Office";
  const m = (marketer || "").trim();
  const t = (tech || "").trim();
  if (m && settings.byMarketer?.[m]) return settings.byMarketer[m];
  if (t && settings.byTech?.[t]) return settings.byTech[t];
  return settings.default || "Office";
}

/** Sum of payment amounts received by a given recipient. */
export function sumCollectedBy(payments: JobPayment[], recipient: PaymentRecipient): number {
  return payments.reduce(
    (acc, p) => acc + (p.recipient === recipient ? num(p.amount) : 0),
    0
  );
}
