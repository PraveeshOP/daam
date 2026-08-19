import { sendEmail } from "@/lib/email/client";

export type PriceAlertEmailInput = {
  to: string;
  productName: string;
  productUrl: string;
  targetPrice: number;
  currentPrice: number;
  currency: string;
};

const formatMoney = (value: number, currency: string) => `${currency} ${Math.round(value).toLocaleString("en-IN")}`;

/** Builds and sends the "price dropped below your target" email (phase-5 spec section 18). */
export async function sendPriceAlertEmail(input: PriceAlertEmailInput) {
  const target = formatMoney(input.targetPrice, input.currency);
  const current = formatMoney(input.currentPrice, input.currency);
  const subject = `Price alert: ${input.productName} is now below your target price`;

  const text = [
    "Good news!",
    "",
    `The price of ${input.productName} has dropped.`,
    "",
    `Your target: ${target}`,
    `Current lowest price: ${current}`,
    "",
    "You can compare the available stores on PriceNepal.",
    input.productUrl,
  ].join("\n");

  const html = `
    <div style="font-family: 'DM Sans', Arial, sans-serif; color: #17221f; max-width: 480px; margin: 0 auto;">
      <p style="font-size: 16px; font-weight: 700; margin: 0 0 16px;">Good news!</p>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
        The price of <strong>${escapeHtml(input.productName)}</strong> has dropped.
      </p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="padding: 12px 16px; background: #f0fbf7; border: 1px solid #a9d5c5; border-radius: 4px 0 0 4px;">
            <p style="margin: 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #0c8b67;">Your target</p>
            <p style="margin: 4px 0 0; font-size: 20px; font-weight: 700;">${target}</p>
          </td>
          <td style="padding: 12px 16px; background: #f0fbf7; border: 1px solid #a9d5c5; border-left: none; border-radius: 0 4px 4px 0;">
            <p style="margin: 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #0c8b67;">Current lowest price</p>
            <p style="margin: 4px 0 0; font-size: 20px; font-weight: 700; color: #0c8b67;">${current}</p>
          </td>
        </tr>
      </table>
      <a href="${input.productUrl}" style="display: inline-block; background: #17221f; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 3px;">
        View product
      </a>
      <p style="margin-top: 28px; font-size: 12px; color: #66736e;">
        You can compare the available stores on PriceNepal from the link above.
      </p>
    </div>
  `.trim();

  await sendEmail({ to: input.to, subject, html, text });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
