import { describe, it as test } from "node:test";
import { strict as assert } from "node:assert";
import type { Tables } from "@/integrations/supabase/types";
import { summarizeByTech, expandTechPartsKeys, techCellValue } from "./techReport";

type Job = Tables<"jobs">;
const job = (values: Partial<Job>) => ({ tech_name: "Alex", job_date: "2026-10-18", status: "Completed", ...values } as Job);

describe("Technician report job values", () => {
  const row = (values: Partial<Job>) => {
    const result = summarizeByTech([job(values)])[0]?.rows[0];
    if (!result) throw new Error("Expected a technician report row");
    return result;
  };
  test("uses the stored technician percentage", () => {
    assert.equal(techCellValue(row({ manual_percentage: 37.5 }), "techPercentage"), "37.5%");
    assert.equal(techCellValue(row({ manual_percentage: 0 }), "techPercentage"), "0%");
  });
  test("uses the stored card fee", () => {
    assert.equal(techCellValue(row({ cc_fee: 12.5 }), "ccFee"), "$12.50");
  });
  test("uses the job paid flag for Yes or No", () => {
    assert.equal(techCellValue(row({ paid: true }), "paid"), "Yes");
    assert.equal(techCellValue(row({ paid: false }), "paid"), "No");
  });
  test("uses the job payment method", () => {
    assert.equal(techCellValue(row({ payment: "Check" }), "payment"), "Check");
  });
  test("preserves the job PO number", () => {
    assert.equal(techCellValue(row({ po_number: "PO-00123" }), "po"), "PO-00123");
  });
  test("uses the payment receiver and supports split receipts", () => {
    for (const recipient of ["Tech", "Office", "Marketer"]) {
      assert.equal(techCellValue(row({ extra_fields: { collected_by: recipient } }), "collectedBy"), recipient);
    }
    assert.equal(techCellValue(row({ extra_fields: { payments: [
      { amount: 100, recipient: "Tech" }, { amount: 200, recipient: "Office" },
    ] } }), "collectedBy"), "Tech, Office");
  });
});

describe("Technician report parts costs", () => {
  for (const [key, field, value] of [
    ["techParts", "parts", 20],
    ["officeParts", "office_parts", 30],
    ["companyParts", "co_parts", 40],
  ] as const) {
    test(`${key} reads only ${field}`, () => {
      const [summary] = summarizeByTech([job({ parts: 20, office_parts: 30, co_parts: 40 })]);
      assert.equal(summary?.[key], value);
      assert.equal(summary?.rows[0]?.[key], value);
    });
  }
  test("previous combined parts selections become three separate selections", () => {
    assert.deepEqual(expandTechPartsKeys(["techCut", "partsCost"]), ["techCut", "techParts", "officeParts", "companyParts"]);
  });
  test("includes all three stored parts costs without changing either cut", () => {
    const [summary] = summarizeByTech([
      job({ parts: 20, office_parts: 30, co_parts: 40, total_tech: 150, total_office: 60, total_marketer: 90 }),
      job({ parts: 5.25, office_parts: null, co_parts: null }),
    ]);
    assert.equal(summary?.partsCost, 95.25);
    assert.equal(summary?.rows[0]?.partsCost, 90);
    assert.equal(summary?.techCut, 150);
    assert.equal(summary?.officeCut, 150);
  });

  test("only totals parts from jobs matching the report filters", () => {
    const [summary] = summarizeByTech([
      job({ parts: 10 }),
      job({ parts: 100, status: "Pending" }),
      job({ parts: 200, job_date: "2026-10-01" }),
      job({ parts: 300, tech_name: "Other" }),
    ], { from: "2026-10-12", to: "2026-10-18", statuses: ["Completed"], techNames: ["Alex"] });
    assert.equal(summary?.partsCost, 10);
    assert.equal(summary?.jobsCount, 1);
  });
});
import { techCollectedAmount } from "./techReport";

describe("Technician report payment filter", () => {
  test("all includes every job; paid and unpaid keep only matching jobs", () => {
    const jobs = [job({ id: "1" as any, paid: true }), job({ id: "2" as any, paid: false })];
    assert.equal(summarizeByTech(jobs, { paidFilter: "all" })[0]?.jobsCount, 2);
    assert.equal(summarizeByTech(jobs, { paidFilter: "paid" })[0]?.jobsCount, 1);
    assert.equal(summarizeByTech(jobs, { paidFilter: "unpaid" })[0]?.jobsCount, 1);
  });
  test("unpaid also includes jobs with no paid flag recorded", () => {
    const [summary] = summarizeByTech([job({ id: "3" as any })], { paidFilter: "unpaid" });
    assert.equal(summary?.jobsCount, 1);
    assert.equal(summarizeByTech([job({ id: "4" as any })], { paidFilter: "paid" }).length, 0);
  });
});

test("net balance: tech collected owes office, office collected is owed to tech", () => {
  const base: any = { tech_name: "T", price: 500, total_tech: 200, total_marketer: 100, total_office: 200, job_date: "2026-01-01", status: "Completed" };
  const s = summarizeByTech([
    { ...base, id: "a", extra_fields: { collected_by: "Tech" } },
    { ...base, id: "b", extra_fields: { collected_by: "Office" } },
  ] as any)[0];
  assert.equal(s.collectedByTech, 500);
  assert.equal(s.netBalance, 100); // 300 owed - 200 owed to tech
  assert.equal(techCollectedAmount({ price: 500, extra_fields: { payments: [{ amount: 120, recipient: "Tech" }, { amount: 380, recipient: "Office" }] } } as any), 120);
});
