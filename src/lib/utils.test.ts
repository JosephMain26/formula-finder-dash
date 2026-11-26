import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatLocalDate, parseLocalDate } from "./utils";

describe("parseLocalDate & formatLocalDate", () => {
  it("keeps the exact calendar date for YYYY-MM-DD strings without UTC day-shift", () => {
    const d = parseLocalDate("2026-11-26");
    assert.ok(d !== null);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 10);
    assert.equal(d.getDate(), 26);
    assert.equal(formatLocalDate("2026-11-26"), new Date(2026, 10, 26).toLocaleDateString());
  });

  it("returns fallback for empty or null values", () => {
    assert.equal(formatLocalDate(null), "—");
    assert.equal(formatLocalDate("", ""), "");
  });
});