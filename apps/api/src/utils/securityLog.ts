export function securityLog(event: string, details: Record<string, unknown> = {}) {
  const redacted = Object.fromEntries(
    Object.entries(details).filter(([key]) => !/password|secret|token|key/i.test(key))
  );
  console.warn(JSON.stringify({ level: "warn", event, ...redacted, at: new Date().toISOString() }));
}
