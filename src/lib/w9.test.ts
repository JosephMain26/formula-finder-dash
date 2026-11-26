import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { canManageW9, mergeEmptyFields, normalizeW9, w9Schema } from "./w9";

describe("W9 auto-fill", () => {
  it("allows admins to read private W9 details", () => assert.equal(canManageW9(true, false), true));
  it("allows managers to read private W9 details", () => assert.equal(canManageW9(false, true), true));
  it("denies other roles access to private W9 details", () => assert.equal(canManageW9(false, false), false));
  it("fills empty fields without replacing entered contact values", () => {
    assert.deepEqual(mergeEmptyFields({ name: "Joseph", email: "", phone: "555" }, { name: "W9 name", email: "joseph@example.com", phone: "999" }), { name: "Joseph", email: "joseph@example.com", phone: "555" });
  });
  it("normalizes a nine-digit SSN", () => {
    const parsed = w9Schema.parse({ name: null, business_name: null, address: null, city: null, state: null, zip: null, email: null, phone: null, tax_id_type: "SSN", tax_id: "000-12-3456" });
    assert.equal(normalizeW9(parsed).tax_id, "000123456");
    assert.equal(normalizeW9(parsed).tax_id_type, "SSN");
  });
  it("rejects uncertain or incomplete tax IDs instead of saving guessed digits", () => {
    const parsed = w9Schema.parse({ name: null, business_name: null, address: null, city: null, state: null, zip: null, email: null, phone: null, tax_id_type: "EIN", tax_id: "12-345" });
    assert.equal(normalizeW9(parsed).tax_id, null);
    assert.equal(normalizeW9(parsed).tax_id_type, null);
  });
  it("normalizes an EIN while preserving leading zeroes", () => {
    const parsed = w9Schema.parse({ name: null, business_name: null, address: null, city: null, state: null, zip: null, email: null, phone: null, tax_id_type: "EIN", tax_id: "00-1234567" });
    assert.equal(normalizeW9(parsed).tax_id, "001234567");
    assert.equal(normalizeW9(parsed).tax_id_type, "EIN");
  });
});