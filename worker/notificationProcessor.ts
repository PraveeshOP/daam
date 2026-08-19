import type { Job } from "bullmq";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPriceAlertEmail } from "@/lib/email/priceAlert";
import { log } from "@/lib/logger";
import type { NotificationJobData } from "@/lib/queue/notifications";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/**
 * Sends the price-alert email for one already-claimed alert (evaluateProductPriceAlerts set
 * triggered_at when it enqueued this job). Only marks the alert fully "Triggered"
 * (is_active = false) once the email has actually been sent — a thrown error here leaves
 * is_active/triggered_at untouched so BullMQ's own retry/backoff can try again, and
 * worker/index.ts's `failed` handler releases the claim if every attempt is exhausted.
 */
export async function processNotificationJob(job: Job<NotificationJobData>): Promise<void> {
  const { alertId, triggeredPrice } = job.data;
  const client = createServiceClient();

  const { data: alert, error: alertError } = await client
    .from("price_alerts")
    .select("id, user_id, target_price, currency, is_active, products(name, slug)")
    .eq("id", alertId)
    .maybeSingle();
  if (alertError) throw new Error(`could not read alert ${alertId}: ${alertError.message}`);
  if (!alert) {
    log("notifications", `alert ${alertId} no longer exists, skipping`);
    return;
  }
  if (!alert.is_active) {
    // Already completed (or disabled) by a previous attempt/action — nothing to send.
    log("notifications", `alert ${alertId} is no longer active, skipping`);
    return;
  }
  const product = alert.products as unknown as { name: string; slug: string } | null;
  if (!product) throw new Error(`alert ${alertId} has no linked product`);

  const { data: userResult, error: userError } = await client.auth.admin.getUserById(alert.user_id);
  if (userError || !userResult?.user?.email) throw new Error(`could not resolve email for user ${alert.user_id}: ${userError?.message || "no email on file"}`);

  await sendPriceAlertEmail({
    to: userResult.user.email,
    productName: product.name,
    productUrl: `${siteUrl()}/product/${product.slug}`,
    targetPrice: Number(alert.target_price),
    currentPrice: triggeredPrice,
    currency: alert.currency,
  });

  const { error: updateError } = await client.from("price_alerts").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", alertId);
  if (updateError) throw new Error(`email sent but could not mark alert ${alertId} triggered: ${updateError.message}`);

  log("notifications", `alert ${alertId} email sent and marked triggered`);
}

/**
 * Called from worker/index.ts's `failed` handler once BullMQ has exhausted every retry for a
 * notification job — releases the claim (triggered_at back to null, is_active stays true) so
 * the next price change re-evaluates this alert from scratch instead of it being stuck
 * "in-flight" forever with no email ever sent (section 19: never silently drop a failed send).
 */
export async function releaseFailedNotification(alertId: string): Promise<void> {
  const client = createServiceClient();
  const { error } = await client.from("price_alerts").update({ triggered_at: null }).eq("id", alertId).eq("is_active", true);
  if (error) throw new Error(`could not release failed alert ${alertId}: ${error.message}`);
}
