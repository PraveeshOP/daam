import { Resend } from "resend";
import { logError, log } from "@/lib/logger";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

let resendClient: Resend | null = null;

/**
 * Thin wrapper isolating the email provider (section 17 of the phase-5 spec) so the rest of
 * the app never imports Resend directly. Throws on failure/misconfiguration instead of
 * pretending success — the caller (worker/notificationProcessor.ts) relies on that to decide
 * whether an alert may be marked as triggered (section 19: never claim an email was sent when
 * it wasn't).
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    // No provider configured: this is a deployment/config problem, not a "pretend it worked"
    // situation, so it goes through the same failure/retry path as a real provider outage.
    // §H-email (phase-9 audit): never log a real recipient address, even redacted-adjacent —
    // this fires on every retry of every notification job while misconfigured, so it's not a
    // one-off diagnostic line but a repeated PII-in-logs leak if left as-is.
    log("email", `RESEND_API_KEY/EMAIL_FROM not configured — would have sent "${input.subject}" (recipient omitted from logs)`);
    throw new Error("Email provider is not configured (missing RESEND_API_KEY or EMAIL_FROM)");
  }

  if (!resendClient) resendClient = new Resend(apiKey);
  // §H-email (phase-9 audit): the Resend SDK call had no explicit timeout, unlike every other
  // outbound call in this codebase (collectors/core/http.ts uses AbortSignal.timeout). A stalled
  // provider would otherwise stall this BullMQ job indefinitely instead of failing and retrying.
  const SEND_TIMEOUT_MS = 15_000;
  const { error } = await Promise.race([
    resendClient.emails.send({ from, to: input.to, subject: input.subject, html: input.html, text: input.text }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Email send timed out after ${SEND_TIMEOUT_MS / 1000}s`)), SEND_TIMEOUT_MS)),
  ]);
  if (error) {
    logError("email", `send failed: ${error.message}`);
    throw new Error(`Email send failed: ${error.message}`);
  }
}
