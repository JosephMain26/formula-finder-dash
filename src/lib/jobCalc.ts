// Shared totals calculation used when applying parsed-message updates to a job.
// Mirrors the math in src/components/AddJobDialog.tsx -> completeSubmit.

export type JobCalcInput = {
  price: number | null;
  co_parts: number;
  office_parts: number;
  parts: number;
  tip: number;
  cc_fee: number;
  payment: string | null;
  marketer_pct: number; // 0-100
  tech_pct: number; // 0-100
  marketer_pay_mode: "percent" | "fixed";
  marketer_fixed_amount: number;
  tech_pay_mode: "percent" | "fixed";
  tech_fixed_amount: number;
  office_pay_mode: "percent" | "fixed";
  office_fixed_amount: number;
};

export type JobCalcResult = {
  total_marketer: number;
  total_tech: number;
  total_office: number;
};

export function computeJobTotals(i: JobCalcInput): JobCalcResult {
  const isCard =
    i.payment?.toLowerCase() === "card" ||
    i.payment?.toLowerCase() === "credit card";

  const revenue =
    (i.price ?? 0) -
    i.co_parts -
    i.office_parts -
    i.parts -
    i.tip -
    (isCard ? i.cc_fee : 0);

  const marketerPct = i.marketer_pct / 100;
  const techPct = i.tech_pct / 100;

  const marketerBase =
    i.marketer_pay_mode === "fixed"
      ? i.marketer_fixed_amount
      : revenue * marketerPct;
  const techBase =
    i.tech_pay_mode === "fixed" ? i.tech_fixed_amount : revenue * techPct;
  const officeBase =
    i.office_pay_mode === "fixed"
      ? i.office_fixed_amount
      : revenue * Math.max(0, 1 - marketerPct - techPct);

  return {
    total_marketer: Math.round((marketerBase + i.co_parts) * 100) / 100,
    total_tech: Math.round((techBase + i.parts + i.tip) * 100) / 100,
    total_office: Math.round((officeBase + i.office_parts) * 100) / 100,
  };
}
