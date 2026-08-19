import { describe, expect, it } from "vitest";
import { alertStatus } from "@/lib/alerts/status";

describe("alertStatus", () => {
  it("is active while is_active is true, regardless of triggered_at", () => {
    expect(alertStatus({ is_active: true, triggered_at: null })).toBe("active");
  });

  it("is triggered once is_active is false and triggered_at is set", () => {
    expect(alertStatus({ is_active: false, triggered_at: "2026-08-19T00:00:00Z" })).toBe("triggered");
  });

  it("is disabled when is_active is false and it never triggered", () => {
    expect(alertStatus({ is_active: false, triggered_at: null })).toBe("disabled");
  });
});
