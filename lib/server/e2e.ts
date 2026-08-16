export function e2eSessionDurationMs(req: Request, productionDurationMs: number): number {
  if (process.env.E2E_TEST_MODE !== 'true' || process.env.NODE_ENV === 'production') return productionDurationMs;
  const cookie = req.headers.get('cookie') || '';
  const match = cookie.match(/(?:^|;\s*)jft-e2e-duration-seconds=(\d+)/);
  if (!match) return productionDurationMs;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds < 2 || seconds > 300) return productionDurationMs;
  return seconds * 1000;
}
