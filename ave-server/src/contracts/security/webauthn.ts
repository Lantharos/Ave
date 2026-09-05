import { z } from "zod";

const encodedBytes = (maxLength: number) => z.string()
  .min(1)
  .max(maxLength)
  .regex(/^[A-Za-z0-9_-]+={0,2}$/, "Expected base64url data");

const credentialId = encodedBytes(2048);
const authenticatorTransport = z.enum([
  "ble",
  "cable",
  "hybrid",
  "internal",
  "nfc",
  "smart-card",
  "usb",
]);

const credentialExtensions = z.object({
  appid: z.boolean().optional(),
  credProps: z.object({ rk: z.boolean().optional() }).optional(),
  hmacCreateSecret: z.boolean().optional(),
  prf: z.object({
    enabled: z.boolean().optional(),
  }).optional(),
}).passthrough();

const credentialBase = {
  id: credentialId,
  rawId: credentialId,
  type: z.literal("public-key"),
  authenticatorAttachment: z.enum(["cross-platform", "platform"]).nullable().optional(),
  clientExtensionResults: credentialExtensions,
};

export const authenticationCredentialSchema = z.object({
  ...credentialBase,
  response: z.object({
    clientDataJSON: encodedBytes(64 * 1024),
    authenticatorData: encodedBytes(64 * 1024),
    signature: encodedBytes(64 * 1024),
    userHandle: encodedBytes(64 * 1024).nullable().optional(),
  }),
});

export const registrationCredentialSchema = z.object({
  ...credentialBase,
  response: z.object({
    clientDataJSON: encodedBytes(64 * 1024),
    attestationObject: encodedBytes(768 * 1024),
    transports: z.array(authenticatorTransport).max(8).optional(),
    publicKey: encodedBytes(768 * 1024).optional(),
    publicKeyAlgorithm: z.number().int().optional(),
  }),
});
