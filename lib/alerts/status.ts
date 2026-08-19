export type AlertStatus = "active" | "triggered" | "disabled";

/** A price_alerts row only has is_active + triggered_at (see the phase-5 migration) — this
 * derives the 3-state display the spec asks for (Active / Triggered / Disabled) from those two
 * columns instead of adding a redundant status enum column. */
export function alertStatus(alert: { is_active: boolean; triggered_at: string | null }): AlertStatus {
  if (alert.is_active) return "active";
  return alert.triggered_at ? "triggered" : "disabled";
}
