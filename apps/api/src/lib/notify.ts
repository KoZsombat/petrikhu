import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { user } from "../db/schema";
import { env } from "../env";

/**
 * Workflow e-mail. Delivery goes through Resend when `RESEND_API_KEY` and `MAIL_FROM` are set;
 * otherwise the message is logged and dropped, which is the documented dev behaviour.
 */
const REVIEW_QUEUE_ROLES = ["reviewer", "editor"];

type Mail = { to: string[]; subject: string; text: string };

async function sendMail({ to, subject, text }: Mail): Promise<void> {
  const recipients = [...new Set(to.filter(Boolean))];
  if (recipients.length === 0) return;

  if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
    console.log(`[mail:skipped] ${subject} -> ${recipients.join(", ")}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: recipients,
      subject,
      text,
    }),
  });

  if (!response.ok) {
    console.error(
      `[mail:failed] ${subject}: ${response.status} ${await response.text()}`,
    );
  }
}

/** Deputy-director equivalent: every account that can act on the approval queue. */
export async function reviewerEmails(): Promise<string[]> {
  const rows = await db
    .select({ email: user.email })
    .from(user)
    .where(inArray(user.role, REVIEW_QUEUE_ROLES));

  if (rows.length > 0) return rows.map((row) => row.email);

  const admins = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.role, "admin"));

  return admins.map((row) => row.email);
}

const publicPostUrl = (slug: string) =>
  `${env.PUBLIC_SITE_URL.replace(/\/$/, "")}/hirek/${slug}`;

const trimmer = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

export async function notifySubmitted(input: {
  postId: string;
  title: string;
  authorName: string;
}): Promise<void> {
  const to = await reviewerEmails();
  await sendMail({
    to,
    subject: `[Petrik Hírkezelő] Jóváhagyásra vár: ${trimmer(input.title, 80)}`,
    text: [
      "Új hír érkezett jóváhagyásra.",
      "",
      `Cím: ${input.title}`,
      `Beküldő: ${input.authorName}`,
      `Hírkezelő: ${env.PUBLIC_SITE_URL.replace(/\/$/, "")}/admin/hirek`,
    ].join("\n"),
  });
}

export async function notifyRejected(input: {
  to: string | null;
  title: string;
  note: string;
}): Promise<void> {
  if (!input.to) return;
  await sendMail({
    to: [input.to],
    subject: `[Petrik Hírkezelő] Javításra visszaküldve: ${trimmer(input.title, 80)}`,
    text: [
      "A hírt a vezetőség javításra visszaküldte.",
      "",
      `Cím: ${input.title}`,
      `Indoklás: ${input.note}`,
      "",
      "A hír a Hírkezelőben újra szerkeszthető és javítás után újraküldhető.",
    ].join("\n"),
  });
}

export async function notifyApproved(input: {
  to: string | null;
  title: string;
  slug: string;
}): Promise<void> {
  if (!input.to) return;
  await sendMail({
    to: [input.to],
    subject: `[Petrik Hírkezelő] Publikálva: ${trimmer(input.title, 80)}`,
    text: [
      "A hírt a vezetőség jóváhagyta és publikálta.",
      "",
      `Cím: ${input.title}`,
      `Hír: ${publicPostUrl(input.slug)}`,
    ].join("\n"),
  });
}
