type LogLevel = "error" | "info" | "warn";

function redact(details: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(details).filter(([key]) => !/password|secret|token|key/i.test(key))
  );
}

// Emits a single-line JSON record so Promtail can ship it to Loki and Grafana
// can extract metrics by `event` and `outcome`. High-cardinality fields
// (username, ip) stay as content, never as labels.
function emit(level: LogLevel, event: string, details: Record<string, unknown> = {}) {
  const record = JSON.stringify({ level, event, ...redact(details), at: new Date().toISOString() });
  if (level === "error") console.error(record);
  else if (level === "info") console.info(record);
  else console.warn(record);
}

export const logger = {
  error: (event: string, details?: Record<string, unknown>) => emit("error", event, details),
  info: (event: string, details?: Record<string, unknown>) => emit("info", event, details),
  warn: (event: string, details?: Record<string, unknown>) => emit("warn", event, details)
};

// Backward-compatible security event helper (warn level).
export function securityLog(event: string, details: Record<string, unknown> = {}) {
  emit("warn", event, details);
}
