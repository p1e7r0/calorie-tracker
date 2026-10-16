import "server-only";

type Email = { to: string; subject: string; text: string; html: string };

export const isEmailDeliveryConfigured = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export async function sendEmail(email: Email) {
  if (!isEmailDeliveryConfigured) {
    if (process.env.NODE_ENV === "production") throw new Error("Email delivery is not configured.");
    console.info(`[email] To: ${email.to}\nSubject: ${email.subject}\n\n${email.text}`);
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, ...email }),
  });
  if (!response.ok) {
    throw new Error(`Resend responded ${response.status}: ${await response.text()}`);
  }
}
