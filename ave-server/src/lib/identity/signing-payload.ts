export function buildAuditPayload(action: string, details: Record<string, unknown>) {
  return JSON.stringify({ version: 1, action, details });
}
