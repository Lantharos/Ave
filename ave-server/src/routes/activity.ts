import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, activityLogs } from "../db";
import { requireAuth } from "../middleware/auth";
import { eq, desc, like, and, gte, lte } from "drizzle-orm";

const app = new Hono();

// All routes require authentication
app.use("*", requireAuth);

// Get activity log
app.get("/", zValidator("query", z.object({
  limit: z.coerce.number().min(1).max(100).default(50).optional(),
  offset: z.coerce.number().min(0).default(0).optional(),
  action: z.string().optional(),
  severity: z.enum(["info", "warning", "danger"]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})), async (c) => {
  const user = c.get("user")!;
  const { limit = 50, offset = 0, action, severity, startDate, endDate } = c.req.valid("query");
  
  // Build conditions
  const conditions = [eq(activityLogs.userId, user.id)];
  
  if (action) {
    conditions.push(like(activityLogs.action, `%${action}%`));
  }
  
  if (severity) {
    conditions.push(eq(activityLogs.severity, severity));
  }
  
  if (startDate) {
    conditions.push(gte(activityLogs.createdAt, new Date(startDate)));
  }
  
  if (endDate) {
    conditions.push(lte(activityLogs.createdAt, new Date(endDate)));
  }
  
  const logs = await db
    .select()
    .from(activityLogs)
    .where(and(...conditions))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit)
    .offset(offset);
  
  return c.json({
    logs: logs.map((log) => ({
      id: log.id,
      action: log.action,
      details: log.details,
      severity: log.severity,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
    })),
  });
});

export default app;
