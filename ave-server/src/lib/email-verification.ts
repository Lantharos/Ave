import { createHash, randomInt } from "crypto";
import { db, identities, type Identity } from "../db";
import { and, eq } from "drizzle-orm";
import { sendMail } from "./mail";

const EMAIL_CODE_LENGTH = 6;
const EMAIL_CODE_TTL_MS = 15 * 60 * 1000;
const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function createEmailVerificationCode(): string {
  return String(randomInt(0, 10 ** EMAIL_CODE_LENGTH)).padStart(EMAIL_CODE_LENGTH, "0");
}

function hashEmailVerificationCode(identityId: string, email: string, code: string): string {
  return createHash("sha256")
    .update(`${identityId}:${normalizeEmail(email)}:${code}`)
    .digest("hex");
}

export function canResendEmailVerification(identity: Pick<Identity, "emailVerificationSentAt">): boolean {
  if (!identity.emailVerificationSentAt) {
    return true;
  }

  return Date.now() - identity.emailVerificationSentAt.getTime() >= EMAIL_RESEND_COOLDOWN_MS;
}

export function getEmailVerificationCooldownSeconds(identity: Pick<Identity, "emailVerificationSentAt">): number {
  if (!identity.emailVerificationSentAt) {
    return 0;
  }

  const remaining = EMAIL_RESEND_COOLDOWN_MS - (Date.now() - identity.emailVerificationSentAt.getTime());
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

export async function beginEmailVerification(identity: Identity, rawEmail: string): Promise<void> {
  const pendingEmail = normalizeEmail(rawEmail);
  const code = createEmailVerificationCode();
  const codeHash = hashEmailVerificationCode(identity.id, pendingEmail, code);
  const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MS);
  const sentAt = new Date();

  await db
    .update(identities)
    .set({
      pendingEmail,
      emailVerificationCodeHash: codeHash,
      emailVerificationExpiresAt: expiresAt,
      emailVerificationSentAt: sentAt,
      updatedAt: sentAt,
    })
    .where(eq(identities.id, identity.id));

  try {
    await sendMail({
      to: pendingEmail,
      subject: "Verify your Ave email",
      text: `Your Ave verification code is ${code}. It expires in 15 minutes.`,
      html: `<p>Your Ave verification code is <strong>${code}</strong>.</p><p>It expires in 15 minutes.</p>`,
    });
  } catch (error) {
    await db
      .update(identities)
      .set({
        pendingEmail: identity.pendingEmail,
        emailVerificationCodeHash: identity.emailVerificationCodeHash,
        emailVerificationExpiresAt: identity.emailVerificationExpiresAt,
        emailVerificationSentAt: identity.emailVerificationSentAt,
        updatedAt: new Date(),
      })
      .where(eq(identities.id, identity.id));

    throw error;
  }
}

export async function completeEmailVerification(identity: Identity, code: string): Promise<Identity | null> {
  if (!identity.pendingEmail || !identity.emailVerificationCodeHash || !identity.emailVerificationExpiresAt) {
    return null;
  }

  if (identity.emailVerificationExpiresAt.getTime() < Date.now()) {
    return null;
  }

  const providedHash = hashEmailVerificationCode(identity.id, identity.pendingEmail, code.trim());
  if (providedHash !== identity.emailVerificationCodeHash) {
    return null;
  }

  const [updated] = await db
    .update(identities)
    .set({
      email: identity.pendingEmail,
      pendingEmail: null,
      emailVerificationCodeHash: null,
      emailVerificationExpiresAt: null,
      emailVerificationSentAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(identities.id, identity.id), eq(identities.userId, identity.userId)))
    .returning();

  return updated ?? null;
}

export async function clearPendingEmailVerification(identityId: string): Promise<void> {
  await db
    .update(identities)
    .set({
      pendingEmail: null,
      emailVerificationCodeHash: null,
      emailVerificationExpiresAt: null,
      emailVerificationSentAt: null,
      updatedAt: new Date(),
    })
    .where(eq(identities.id, identityId));
}
