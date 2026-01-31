export function isAllowedWebauthnOrigin(origin: string): boolean {
  const prodOrigin = process.env.RP_ORIGIN;
  if (origin.match(/^http:\/\/localhost(:\d+)?$/)) return true;
  if (origin.match(/^http:\/\/127\.0\.0\.1(:\d+)?$/)) return true;
  if (prodOrigin && origin === prodOrigin) return true;
  return false;
}
