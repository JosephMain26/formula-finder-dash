import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse a YYYY-MM-DD date string as a local calendar Date so timezones west of UTC
 * never shift it to the previous day. Falls back to `new Date(value)` for timestamps.
 */
export function parseLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = ISO_DATE_ONLY.exec(value.trim());
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format a YYYY-MM-DD date (or timestamp) without UTC midnight day-shift. */
export function formatLocalDate(value: string | null | undefined, fallback = "—"): string {
  const d = parseLocalDate(value);
  return d ? d.toLocaleDateString() : fallback;
}
