import { Hono } from "hono";
import { db, identities, organizations } from "../db";
import { requireAuth, requireWritable } from "../middleware/auth";
import { eq, and } from "drizzle-orm";
import { recordActivityLog } from "../lib/background-events";
import { requireBusinessAccess } from "../lib/business";

type Bindings = {
  UPLOADS: R2Bucket;
  R2_PUBLIC_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

function getUploadsBucket(c: { env: Partial<Bindings> }): R2Bucket {
  if (!c.env.UPLOADS) {
    throw new Error("R2 bucket binding UPLOADS is not configured");
  }

  return c.env.UPLOADS;
}

function getUploadsPublicUrl(c: { env: Partial<Bindings> }): string {
  if (!c.env.R2_PUBLIC_URL) {
    throw new Error("R2_PUBLIC_URL is not configured");
  }

  return c.env.R2_PUBLIC_URL.replace(/\/+$/, "");
}

type ImageType = {
  contentType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  extension: "jpg" | "png" | "gif" | "webp";
};

function detectImageType(buffer: Buffer): ImageType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }

  if (
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a
  ) {
    return { contentType: "image/png", extension: "png" };
  }

  if (buffer.length >= 6 && (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a")) {
    return { contentType: "image/gif", extension: "gif" };
  }

  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return { contentType: "image/webp", extension: "webp" };
  }

  return null;
}

function generateFilename(imageType: ImageType): string {
  return `${Date.now()}-${crypto.randomUUID()}.${imageType.extension}`;
}

function rejectLargeRequest(c: any, maxSize: number): Response | null {
  const contentLength = Number(c.req.header("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > maxSize + 1024 * 1024) {
    return c.json({ error: "File too large" }, 413);
  }
  return null;
}

async function prepareImageUpload(file: File, maxSize: number): Promise<
  | { ok: true; buffer: Buffer; contentType: ImageType["contentType"]; filename: string }
  | { ok: false; error: string; status: 400 | 413 }
> {
  if (file.size <= 0) {
    return { ok: false, error: "File is empty", status: 400 };
  }

  if (file.size > maxSize) {
    return { ok: false, error: "File too large", status: 413 };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const imageType = detectImageType(buffer);
  if (!imageType) {
    return { ok: false, error: "Invalid file type. Allowed: JPEG, PNG, GIF, WebP", status: 400 };
  }

  return {
    ok: true,
    buffer,
    contentType: imageType.contentType,
    filename: generateFilename(imageType),
  };
}

// Max file sizes (in bytes)
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_BANNER_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_WORKSPACE_LOGO_SIZE = 5 * 1024 * 1024; // 5MB

// All routes require authentication
app.use("*", requireAuth);
app.use("*", requireWritable);

// Upload to R2
async function uploadToR2(
  c: { env: Partial<Bindings> },
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  await getUploadsBucket(c).put(key, buffer, {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000",
    },
  });

  return `${getUploadsPublicUrl(c)}/${key}`;
}

// Delete from R2
async function deleteFromR2(c: { env: Partial<Bindings> }, key: string): Promise<void> {
  try {
    await getUploadsBucket(c).delete(key);
  } catch (error) {
    console.error("Failed to delete from R2:", error);
    // Don't throw - deletion failure shouldn't break the flow
  }
}

// Extract key from URL
function getKeyFromUrl(c: { env: Partial<Bindings> }, url: string): string | null {
  const publicUrl = getUploadsPublicUrl(c);
  let parsedUrl: URL;
  let parsedPublicUrl: URL;
  try {
    parsedUrl = new URL(url);
    parsedPublicUrl = new URL(publicUrl);
  } catch {
    return null;
  }

  const publicPath = parsedPublicUrl.pathname.replace(/\/+$/, "");
  if (parsedUrl.origin !== parsedPublicUrl.origin || !parsedUrl.pathname.startsWith(`${publicPath}/`)) {
    return null;
  }

  let key: string;
  try {
    key = decodeURIComponent(parsedUrl.pathname.slice(publicPath.length + 1));
  } catch {
    return null;
  }
  if (!key || key.startsWith("/") || key.includes("..")) {
    return null;
  }

  return key;
}

// Upload avatar
app.post("/avatar", async (c) => {
  const user = c.get("user")!;
  const sizeResponse = rejectLargeRequest(c, MAX_AVATAR_SIZE);
  if (sizeResponse) return sizeResponse;

  const body = await c.req.parseBody();
  const file = body.file as File | undefined;
  const identityId = body.identityId as string | undefined;

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file provided" }, 400);
  }

  if (!identityId) {
    return c.json({ error: "Identity ID required" }, 400);
  }

  // Validate identity belongs to user
  const [identity] = await db
    .select()
    .from(identities)
    .where(and(eq(identities.id, identityId), eq(identities.userId, user.id)))
    .limit(1);

  if (!identity) {
    return c.json({ error: "Identity not found" }, 404);
  }

  const upload = await prepareImageUpload(file, MAX_AVATAR_SIZE);
  if (!upload.ok) {
    return c.json({ error: upload.error }, upload.status);
  }

  const key = `avatars/${upload.filename}`;
  const avatarUrl = await uploadToR2(c, upload.buffer, key, upload.contentType);

  // Delete old avatar if exists
  if (identity.avatarUrl) {
    const oldKey = getKeyFromUrl(c, identity.avatarUrl);
    if (oldKey) {
      await deleteFromR2(c, oldKey);
    }
  }

  // Update identity
  await db
    .update(identities)
    .set({ avatarUrl, updatedAt: new Date() })
    .where(eq(identities.id, identityId));

  recordActivityLog(c, {
    userId: user.id,
    action: "avatar_updated",
    details: { identityId },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });

  return c.json({ avatarUrl });
});

app.post("/workspace-logo", async (c) => {
  const user = c.get("user")!;
  const sizeResponse = rejectLargeRequest(c, MAX_WORKSPACE_LOGO_SIZE);
  if (sizeResponse) return sizeResponse;

  const body = await c.req.parseBody();
  const file = body.file as File | undefined;
  const organizationId = body.organizationId as string | undefined;

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file provided" }, 400);
  }

  if (!organizationId) {
    return c.json({ error: "Organization ID required" }, 400);
  }

  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!organization) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const access = await requireBusinessAccess(user.id, organizationId, "admin");
  if (!access) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const upload = await prepareImageUpload(file, MAX_WORKSPACE_LOGO_SIZE);
  if (!upload.ok) {
    return c.json({ error: upload.error }, upload.status);
  }

  const key = `workspace-logos/${upload.filename}`;
  const logoUrl = await uploadToR2(c, upload.buffer, key, upload.contentType);

  if (organization.logoUrl) {
    const oldKey = getKeyFromUrl(c, organization.logoUrl);
    if (oldKey) {
      await deleteFromR2(c, oldKey);
    }
  }

  await db
    .update(organizations)
    .set({ logoUrl, updatedAt: new Date() })
    .where(eq(organizations.id, organizationId));

  recordActivityLog(c, {
    userId: user.id,
    action: "workspace_logo_updated",
    details: { organizationId },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });

  return c.json({ logoUrl });
});

// Upload banner
app.post("/banner", async (c) => {
  const user = c.get("user")!;
  const sizeResponse = rejectLargeRequest(c, MAX_BANNER_SIZE);
  if (sizeResponse) return sizeResponse;

  const body = await c.req.parseBody();
  const file = body.file as File | undefined;
  const identityId = body.identityId as string | undefined;

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file provided" }, 400);
  }

  if (!identityId) {
    return c.json({ error: "Identity ID required" }, 400);
  }

  // Validate identity belongs to user
  const [identity] = await db
    .select()
    .from(identities)
    .where(and(eq(identities.id, identityId), eq(identities.userId, user.id)))
    .limit(1);

  if (!identity) {
    return c.json({ error: "Identity not found" }, 404);
  }

  const upload = await prepareImageUpload(file, MAX_BANNER_SIZE);
  if (!upload.ok) {
    return c.json({ error: upload.error }, upload.status);
  }

  const key = `banners/${upload.filename}`;
  const bannerUrl = await uploadToR2(c, upload.buffer, key, upload.contentType);

  // Delete old banner if exists (only if it's an R2 URL, not a color)
  if (identity.bannerUrl && !identity.bannerUrl.startsWith("#")) {
    const oldKey = getKeyFromUrl(c, identity.bannerUrl);
    if (oldKey) {
      await deleteFromR2(c, oldKey);
    }
  }

  // Update identity
  await db
    .update(identities)
    .set({ bannerUrl, updatedAt: new Date() })
    .where(eq(identities.id, identityId));

  recordActivityLog(c, {
    userId: user.id,
    action: "banner_updated",
    details: { identityId },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });

  return c.json({ bannerUrl });
});

// Delete avatar
app.delete("/avatar/:identityId", async (c) => {
  const user = c.get("user")!;
  const identityId = c.req.param("identityId");

  // Validate identity belongs to user
  const [identity] = await db
    .select()
    .from(identities)
    .where(and(eq(identities.id, identityId), eq(identities.userId, user.id)))
    .limit(1);

  if (!identity) {
    return c.json({ error: "Identity not found" }, 404);
  }

  // Delete from R2 if exists
  if (identity.avatarUrl) {
    const key = getKeyFromUrl(c, identity.avatarUrl);
    if (key) {
      await deleteFromR2(c, key);
    }
  }

  // Update identity
  await db
    .update(identities)
    .set({ avatarUrl: null, updatedAt: new Date() })
    .where(eq(identities.id, identityId));

  return c.json({ success: true });
});

// Delete banner
app.delete("/banner/:identityId", async (c) => {
  const user = c.get("user")!;
  const identityId = c.req.param("identityId");

  // Validate identity belongs to user
  const [identity] = await db
    .select()
    .from(identities)
    .where(and(eq(identities.id, identityId), eq(identities.userId, user.id)))
    .limit(1);

  if (!identity) {
    return c.json({ error: "Identity not found" }, 404);
  }

  // Delete from R2 if exists (only if it's an R2 URL, not a color)
  if (identity.bannerUrl && !identity.bannerUrl.startsWith("#")) {
    const key = getKeyFromUrl(c, identity.bannerUrl);
    if (key) {
      await deleteFromR2(c, key);
    }
  }

  // Update identity
  await db
    .update(identities)
    .set({ bannerUrl: null, updatedAt: new Date() })
    .where(eq(identities.id, identityId));

  return c.json({ success: true });
});

export default app;
