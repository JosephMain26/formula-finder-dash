import { describe, it as test } from "node:test";
import { strict as assert } from "node:assert";
import type { Tables } from "@/integrations/supabase/types";
import { summarizeByTech } from "./techReport";

type Job = Tables<"jobs">;
const job = (values: Partial<Job>) => ({ tech_name: "Alex", job_date: "2026-10-18", status: "Completed", ...values } as Job);

describe("Technician report parts costs", () => {
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