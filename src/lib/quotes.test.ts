import { describe, it, expect } from "vitest";
import { isOpenJob, isQuoteJob, followupState, nextFollowup } from "./quotes";

describe("quotes", () => {
  it("open = not completed/cancelled", () => {
    expect(isOpenJob({ status: "Scheduled" })).toBe(true);
    expect(isOpenJob({ status: "Completed" })).toBe(false);
    expect(isOpenJob({ status: "Cancelled" })).toBe(false);
  });
  it("quote status", () => expect(isQuoteJob({ status: "Quote" })).toBe(true));
  it("follow-up state", () => {
    expect(followupState("2026-01-01", "2026-01-02")).toBe("overdue");
    expect(followupState("2026-01-02", "2026-01-02")).toBe("today");
    expect(followupState("2026-01-03", "2026-01-02")).toBe("upcoming");
  });
  it("default follow-up is 2 days after quote", () => {
    expect(nextFollowup({ created_at: "2026-01-01T10:00:00Z" }, 2)).toBe("2026-01-03");
  });
});
