import { geocodeAddressDetailed, normalizeAddressInput } from "@/lib/databoard/geocode";

export type AddressValidationResult =
  | { status: "empty"; originalAddress: ""; finalAddress: "" }
  | { status: "valid"; originalAddress: string; finalAddress: string }
  | { status: "suggestion"; originalAddress: string; finalAddress: string; suggestion: string }
  | { status: "unresolved"; originalAddress: string; finalAddress: string };

function stripUnitDetails(address: string) {
  return address
    .replace(/\b(?:apt|apartment|unit|ste|suite|floor|fl|building|bldg)\b\s*[#\-\w]*/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/,+/g, ",")
    .trim();
}

function buildFallbackQueries(address: string) {
  const withCountry = /\b(?:usa|us|united states|canada)\b/i.test(address)
    ? address
    : `${address}, USA`;
  const withoutUnit = stripUnitDetails(address);

  return Array.from(
    new Set(
      [
        withCountry,
        withoutUnit,
        withoutUnit && withoutUnit !== address ? `${withoutUnit}, USA` : "",
      ]
        .map((value) => normalizeAddressInput(value))
        .filter((value) => value && value !== address)
    )
  );
}

export async function validateAddressForSave(address: string): Promise<AddressValidationResult> {
  const normalized = normalizeAddressInput(address);

  if (!normalized) {
    return { status: "empty", originalAddress: "", finalAddress: "" };
  }

  const primary = await geocodeAddressDetailed(normalized);
  if (primary) {
    return {
      status: "valid",
      originalAddress: normalized,
      finalAddress: normalized,
    };
  }

  for (const candidate of buildFallbackQueries(normalized)) {
    const hit = await geocodeAddressDetailed(candidate);
    if (hit?.displayName) {
      return {
        status: "suggestion",
        originalAddress: normalized,
        finalAddress: normalized,
        suggestion: hit.displayName,
      };
    }
  }

  return {
    status: "unresolved",
    originalAddress: normalized,
    finalAddress: normalized,
  };
}