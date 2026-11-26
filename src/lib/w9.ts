import { z } from "zod";

export const w9Schema = z.object({
  name: z.string().nullable(), business_name: z.string().nullable(),
  address: z.string().nullable(), city: z.string().nullable(), state: z.string().nullable(), zip: z.string().nullable(),
  email: z.string().nullable(), phone: z.string().nullable(),
  tax_id_type: z.enum(["SSN", "EIN"]).nullable(), tax_id: z.string().nullable(),
});
export type W9Parsed = z.infer<typeof w9Schema>;
export type W9Entity = "company" | "installer" | "technician";
export const emptyW9Details = { business_name: "", address: "", city: "", state: "", zip: "", tax_id_type: "", tax_id: "" };
export type W9Details = typeof emptyW9Details;

export function canManageW9(isAdmin: boolean, isManager: boolean): boolean {
  return isAdmin || isManager;
}

export function mergeEmptyFields<T extends Record<string, unknown>>(current: T, extracted: Partial<T>): T {
  const next = { ...current };
  for (const key of Object.keys(extracted) as (keyof T)[]) {
    const value = extracted[key];
    if (typeof current[key] === "string" && !String(current[key]).trim() && typeof value === "string" && value.trim()) Object.assign(next, { [key]: value });
  }
  return next;
}

export function normalizeW9(parsed: W9Parsed): W9Parsed {
  const digits = (parsed.tax_id || "").replace(/\D/g, "");
  return { ...parsed, tax_id: digits.length === 9 ? digits : null, tax_id_type: digits.length === 9 ? parsed.tax_id_type : null };
}