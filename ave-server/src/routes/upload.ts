import { Hono } from "hono";
import { db, identities, activityLogs } from "../db";
import { requireAuth } from "../middleware/auth";
import { eq, and } from "drizzle-orm";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const app = new Hono();

// R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "ave-uploads";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!; // e.g., https://uploads.ave.id or https://pub-xxx.r2.dev

// Initialize S3 client for R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// Generate unique filename
function generateFilename(originalName: string): string {
  const ext = originalName.split(".").pop()?.toLowerCase() || "png";
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}.${ext}`;
}

// Validate file type
function isValidImageType(type: string): boolean {
  const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  return validTypes.includes(type);
}

// Get content type from filename
function getContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

// Max file sizes (in bytes)
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_BANNER_SIZE = 10 * 1024 * 1024; // 10MB

// All routes require authentication
app.use("*", requireAuth);

// Upload to R2
async function uploadToR2(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000", // 1 year cache
    })
  );

  return `${R2_PUBLIC_URL}/${key}`;
}

// Delete from R2
async function deleteFromR2(key: string): Promise<void> {
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
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
  if (!url.startsWith(R2_PUBLIC_URL)) {
    return null;
  }
  return url.replace(`${R2_PUBLIC_URL}/`, "");
}

// Upload avatar
app.post("/avatar", async (c) => {
  const user = c.get("user")!;

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

  // Validate file type
  if (!isValidImageType(file.type)) {
    return c.json(
      { error: "Invalid file type. Allowed: JPEG, PNG, GIF, WebP" },
      400
    );
  }

  // Validate file size
  if (file.size > MAX_AVATAR_SIZE) {
    return c.json({ error: "File too large. Maximum size: 5MB" }, 400);
  }

  // Generate filename and upload to R2
  const filename = generateFilename(file.name);
  const key = `avatars/${filename}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const avatarUrl = await uploadToR2(buffer, key, file.type);

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

// Upload banner
app.post("/banner", async (c) => {
  const user = c.get("user")!;

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

  // Validate file type
  if (!isValidImageType(file.type)) {
    return c.json(
      { error: "Invalid file type. Allowed: JPEG, PNG, GIF, WebP" },
      400
    );
  }

  // Validate file size
  if (file.size > MAX_BANNER_SIZE) {
    return c.json({ error: "File too large. Maximum size: 10MB" }, 400);
  }

  // Generate filename and upload to R2
  const filename = generateFilename(file.name);
  const key = `banners/${filename}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const bannerUrl = await uploadToR2(buffer, key, file.type);

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
