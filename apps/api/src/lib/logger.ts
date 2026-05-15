type LogLevel = "debug" | "info" | "warn" | "error";

const isDev = process.env["NODE_ENV"] !== "production";

export const logger = {
  debug: (msg: string, data?: unknown) => log("debug", msg, data),
  info:  (msg: string, data?: unknown) => log("info",  msg, data),
  warn:  (msg: string, data?: unknown) => log("warn",  msg, data),
  error: (msg: string, data?: unknown) => log("error", msg, data),
};

function log(level: LogLevel, message: string, data?: unknown) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(data !== undefined ? { data } : {}),
  };

  if (isDev) {
    const icon = { debug: "🔍", info: "ℹ️ ", warn: "⚠️ ", error: "❌" }[level];
    const dataStr = data !== undefined ? `\n  ${JSON.stringify(data, null, 2)}` : "";
    console.log(`${icon} [${entry.timestamp}] ${message}${dataStr}`);
  } else {
    // JSON in production — Railway can parse and filter this
    const out = JSON.stringify(entry);
    level === "error" ? console.error(out) : console.log(out);
  }
}