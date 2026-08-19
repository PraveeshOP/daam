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
    log("email", `RESEND_API_KEY/EMAIL_FROM not configured — would have sent "${input.subject}" to ${input.to}`);
    throw new Error("Email provider is not configured (missing RESEND_API_KEY or EMAIL_FROM)");
  }

  if (!resendClient) resendClient = new Resend(apiKey);
  const { error } = await resendClient.emails.send({ from, to: input.to, subject: input.subject, html: input.html, text: input.text });
  if (error) {
    logError("email", `send failed: ${error.message}`);
    throw new Error(`Email send failed: ${error.message}`);
  }
}
