import { Hono } from "hono";
import { db, identities, activityLogs, organizations, organizationMembers } from "../db";
import { requireAuth, requireWritable } from "../middleware/auth";
import { eq, and } from "drizzle-orm";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const app = new Hono();

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
};

let r2Client: S3Client | null = null;
let r2ClientCacheKey = "";

function getR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || "ave-uploads";
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !publicUrl) {
    throw new Error("R2 configuration is incomplete");
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl };
}

function getR2Client(): { client: S3Client; config: R2Config } {
  const config = getR2Config();
  const cacheKey = `${config.accountId}:${config.accessKeyId}:${config.bucketName}`;

  if (!r2Client || r2ClientCacheKey !== cacheKey) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    r2ClientCacheKey = cacheKey;
  }

  return { client: r2Client, config };
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
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const { client, config } = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000", // 1 year cache
    })
  );

  return `${config.publicUrl}/${key}`;
}

// Delete from R2
async function deleteFromR2(key: string): Promise<void> {
  try {
    const { client, config } = getR2Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      })
    );
  } catch (error) {
    console.error("Failed to delete from R2:", error);
    // Don't throw - deletion failure shouldn't break the flow
  }
}

// Extract key from URL
function getKeyFromUrl(url: string): string | null {
  const { publicUrl } = getR2Config();
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
  const avatarUrl = await uploadToR2(upload.buffer, key, upload.contentType);

  // Delete old avatar if exists
  if (identity.avatarUrl) {
    const oldKey = getKeyFromUrl(identity.avatarUrl);
    if (oldKey) {
      await deleteFromR2(oldKey);
    }
  }

  // Update identity
  await db
    .update(identities)
    .set({ avatarUrl, updatedAt: new Date() })
    .where(eq(identities.id, identityId));

  // Log activity
  await db.insert(activityLogs).values({
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

  const [membership] = await db
    .select({
      role: organizationMembers.role,
      status: organizationMembers.status,
    })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, user.id)))
    .limit(1);

  if (!membership || membership.status !== "active" || (membership.role !== "owner" && membership.role !== "admin")) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!organization) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const upload = await prepareImageUpload(file, MAX_WORKSPACE_LOGO_SIZE);
  if (!upload.ok) {
    return c.json({ error: upload.error }, upload.status);
  }

  const key = `workspace-logos/${upload.filename}`;
  const logoUrl = await uploadToR2(upload.buffer, key, upload.contentType);

  if (organization.logoUrl) {
    const oldKey = getKeyFromUrl(organization.logoUrl);
    if (oldKey) {
      await deleteFromR2(oldKey);
    }
  }

  await db
    .update(organizations)
    .set({ logoUrl, updatedAt: new Date() })
    .where(eq(organizations.id, organizationId));

  await db.insert(activityLogs).values({
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
  const bannerUrl = await uploadToR2(upload.buffer, key, upload.contentType);

  // Delete old banner if exists (only if it's an R2 URL, not a color)
  if (identity.bannerUrl && !identity.bannerUrl.startsWith("#")) {
    const oldKey = getKeyFromUrl(identity.bannerUrl);
    if (oldKey) {
      await deleteFromR2(oldKey);
    }
  }

  // Update identity
  await db
    .update(identities)
    .set({ bannerUrl, updatedAt: new Date() })
    .where(eq(identities.id, identityId));

  // Log activity
  await db.insert(activityLogs).values({
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
    const key = getKeyFromUrl(identity.avatarUrl);
    if (key) {
      await deleteFromR2(key);
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
    const key = getKeyFromUrl(identity.bannerUrl);
    if (key) {
      await deleteFromR2(key);
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
