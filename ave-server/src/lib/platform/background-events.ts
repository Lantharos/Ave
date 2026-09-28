import type { Context } from "hono";
import { activityLogs, db, type NewActivityLog } from "../../db";
import { runInBackground } from "./background";

export type BackgroundEvent = { type: "activity_log"; values: NewActivityLog };

type BackgroundEventEnv = {
  BACKGROUND_EVENTS?: Queue<BackgroundEvent>;
};

function getQueue(c: Context): Queue<BackgroundEvent> | null {
  return ((c.env as BackgroundEventEnv | undefined)?.BACKGROUND_EVENTS) ?? null;
}

function enqueueOrFallback(c: Context, event: BackgroundEvent, fallback: () => Promise<unknown>, label: string): void {
  const queue = getQueue(c);
  const work = queue
    ? queue.send(event).catch(async (error) => {
        console.error(`${label} queue send failed:`, error);
        await fallback();
      })
    : fallback();

  runInBackground(c, work, label);
}

export function recordActivityLog(c: Context, values: NewActivityLog): void {
  enqueueOrFallback(
    c,
    { type: "activity_log", values },
    () => db.insert(activityLogs).values(values),
    "Activity log",
  );
}

async function processBackgroundEvent(event: BackgroundEvent): Promise<void> {
  switch (event.type) {
    case "activity_log":
      await db.insert(activityLogs).values(event.values);
      return;
  }
}

export async function processBackgroundEventBatch(batch: MessageBatch<BackgroundEvent>): Promise<void> {
  for (const message of batch.messages) {
    try {
      if (message.body.type === "activity_log") {
        await db.insert(activityLogs).values(message.body.values);
      }
      message.ack();
    } catch (error) {
      console.error("Background event failed:", error);
      message.retry({ delaySeconds: 60 });
    }
  }
}
