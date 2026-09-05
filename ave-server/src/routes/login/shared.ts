import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, devices, trustCodes } from "../../db";
import { verifyTrustCode } from "../../lib/crypto";
import { getRequiredEnterpriseSsoForEmail } from "../../lib/enterprise-sso-policy";
import { sendAccountEventNotification, type PushSubscription } from "../../lib/webpush";

export type Bindings = Pick<Env, "API_APP" | "HEAVY_SERVICES"> & {
  INTERNAL_API_TOKEN?: string;
};

export async function notifyLoginRequestInApiApp(
  c: { env: Bindings },
  handle: string,
  request: {
    id: string;
    deviceName: string | null;
    deviceType: string | null;
    browser: string | null;
    os: string | null;
    ipAddress: string | null;
  },
) {
  const id = c.env.API_APP.idFromName("primary");
  const stub = c.env.API_APP.get(id);
  const headers = new Headers({ "Content-Type": "application/json" });
  if (c.env.INTERNAL_API_TOKEN) {
    headers.set("x-internal-token", c.env.INTERNAL_API_TOKEN);
  }

  const response = await stub.fetch("https://internal.aveid.net/__internal/login-request", {
    method: "POST",
    headers,
    body: JSON.stringify({ handle, request }),
  });

  if (!response.ok) {
    console.warn("Login request notification failed:", response.status, await response.text());
  }
}

export async function rejectRequiredEnterpriseSso(c: any, identity: { email: string | null }) {
  const sso = await getRequiredEnterpriseSsoForEmail(identity.email);
  if (!sso) return null;
  return c.json({
    error: "Enterprise SSO is required for this identity. Sign in with your work email.",
    ssoRequired: true,
    loginUrl: sso.loginUrl,
    organization: sso.organization,
  }, 403);
}

async function getUnusedTrustCodes(userId: string) {
  return db
    .select()
    .from(trustCodes)
    .where(and(eq(trustCodes.userId, userId), isNull(trustCodes.usedAt)));
}

export async function findUnusedTrustCode(userId: string, code: string) {
  const userTrustCodes = await getUnusedTrustCodes(userId);
  let matchedCode: (typeof userTrustCodes)[number] | null = null;

  for (const trustCode of userTrustCodes) {
    if (verifyTrustCode(code, trustCode.codeHash)) {
      matchedCode = trustCode;
      break;
    }
  }

  if (!matchedCode) {
    return {
      matchedCode: null,
      availableCodes: userTrustCodes.length,
    };
  }

  return {
    matchedCode,
    availableCodes: userTrustCodes.length,
  };
}

export async function claimTrustCode(userId: string, trustCodeId: string): Promise<number | null> {
  const claimed = await db
    .update(trustCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(trustCodes.id, trustCodeId), eq(trustCodes.userId, userId), isNull(trustCodes.usedAt)))
    .returning({ id: trustCodes.id });

  if (!claimed.length) return null;

  const remainingCodes = await getUnusedTrustCodes(userId);
  return remainingCodes.length;
}

/**
 * Get or create a device for a user
 * Uses fingerprint (stored in client localStorage) to uniquely identify devices
 * Falls back to creating new device if no fingerprint match
 */
export async function getOrCreateDevice(
  userId: string,
  deviceInfo: { name: string; type: string; browser?: string; os?: string; fingerprint?: string }
): Promise<{ id: string; name: string; type: string; isNew: boolean }> {
  // Try to find an existing device with the same fingerprint
  if (deviceInfo.fingerprint) {
    const [existingDevice] = await db
      .select()
      .from(devices)
      .where(
        and(
          eq(devices.userId, userId),
          eq(devices.fingerprint, deviceInfo.fingerprint)
        )
      )
      .limit(1);

    if (existingDevice) {
      // Update last seen, device info (in case browser was updated), and return existing device
      await db
        .update(devices)
        .set({
          lastSeenAt: new Date(),
          isActive: true,
          // Update name/browser/os in case they changed (e.g., browser update)
          name: deviceInfo.name,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
        })
        .where(eq(devices.id, existingDevice.id));

      return {
        id: existingDevice.id,
        name: deviceInfo.name, // Return updated name
        type: existingDevice.type,
        isNew: false,
      };
    }
  }

  // Create new device
  const [newDevice] = await db
    .insert(devices)
    .values({
      userId,
      name: deviceInfo.name,
      type: deviceInfo.type,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      fingerprint: deviceInfo.fingerprint,
    })
    .returning();

  return {
    id: newDevice.id,
    name: newDevice.name,
    type: newDevice.type,
    isNew: true,
  };
}

export async function notifyAccountLoginEvent(
  service: Env["HEAVY_SERVICES"],
  userId: string,
  event: {
    method: "passkey" | "device_approval" | "trust_code";
    deviceName: string;
    deviceType: string;
  },
  excludeDeviceId?: string | null
): Promise<void> {
  const userDevices = await db
    .select({ id: devices.id, pushSubscription: devices.pushSubscription })
    .from(devices)
    .where(and(eq(devices.userId, userId), eq(devices.isActive, true)));

  const invalidDeviceIds = (await Promise.all(userDevices.map(async (userDevice) => {
    if ((excludeDeviceId && userDevice.id === excludeDeviceId) || !userDevice.pushSubscription) return null;
    try {
      const subscription = userDevice.pushSubscription as PushSubscription;
      const sent = await sendAccountEventNotification(service, subscription, {
        title: "New Login",
        body: `${event.deviceName} signed in to your Ave account`,
        event: "login",
        url: "/dashboard?section=activity",
        details: {
          method: event.method,
          deviceType: event.deviceType,
        },
      });

      return sent ? null : userDevice.id;
    } catch (error) {
      console.error(`[Push] Failed to send account event to device ${userDevice.id}:`, error);
      return null;
    }
  }))).filter((deviceId): deviceId is string => deviceId !== null);

  if (invalidDeviceIds.length) {
    await db
      .update(devices)
      .set({ pushSubscription: null })
      .where(inArray(devices.id, invalidDeviceIds));
  }
}
