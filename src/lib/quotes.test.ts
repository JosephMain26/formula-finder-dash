import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { isOpenJob, isQuoteJob, followupState, nextFollowup } from "./quotes";

describe("quotes", () => {
  it("open = not completed/cancelled", () => {
    assert.equal(isOpenJob({ status: "Scheduled" }), true);
    assert.equal(isOpenJob({ status: "Completed" }), false);
    assert.equal(isOpenJob({ status: "Cancelled" }), false);
  });
  it("quote status", () => assert.equal(isQuoteJob({ status: "Quote" }), true));
  it("follow-up state", () => {
    assert.equal(followupState("2026-01-01", "2026-01-02"), "overdue");
    assert.equal(followupState("2026-01-02", "2026-01-02"), "today");
    assert.equal(followupState("2026-01-03", "2026-01-02"), "upcoming");
  });
  it("default follow-up is 2 days after quote", () => {
    assert.equal(nextFollowup({ created_at: "2026-01-01T10:00:00Z" }, 2), "2026-01-03");
  });
});
