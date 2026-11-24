import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { computeReportData, DEFAULT_REPORT_SPEC } from "./reportSpec";
import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;

function makeJob(overrides: Partial<Job>): Job {
  return {
    id: "j1",
    job_date: "2026-11-17",
    company_1: "Godspeed Locksmith ",
    company: null,
    tech_name: "Joseph",
    status: "Completed",
    price: 300,
    paid: false,
    total_tech: 100,
    total_office: 100,
    total_marketer: 100,
    ...overrides,
  } as Job;
}

describe("computeReportData marketer whitespace trimming", () => {
  it("matches jobs whose marketer name has trailing spaces when filtering by trimmed name", () => {
    const jobs = [
      makeJob({ id: "1", job_date: "2026-11-17", company_1: "Godspeed Locksmith ", price: 300 }),
      makeJob({ id: "2", job_date: "2026-11-19", company_1: "Godspeed Locksmith ", price: 249 }),
      makeJob({ id: "3", job_date: "2026-11-18", company_1: "Other Co", price: 500 }),
    ];
    const data = computeReportData(jobs, {
      ...DEFAULT_REPORT_SPEC,
      marketers: ["Godspeed Locksmith"],
      paidFilter: "all",
    });
    assert.equal(data.jobCount, 2);
    assert.equal(data.totals.revenue, 549);
  });
});