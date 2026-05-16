import type { Context } from "hono";

export function runInBackground(c: Context, work: Promise<unknown>, label: string): void {
  const handled = work.catch((error) => {
    console.error(`${label} failed:`, error);
  });

  const executionCtx = (c as unknown as { executionCtx?: ExecutionContext }).executionCtx;
  if (executionCtx) {
    executionCtx.waitUntil(handled);
    return;
  }

  void handled;
}
