// All "today/tomorrow" logic runs in the business's local time zone, not the
// server's (Vercel servers run in UTC).
export const SERVICE_TIMEZONE = process.env.SERVICE_TIMEZONE || "America/Toronto";

// YYYY-MM-DD for the given instant in the service time zone.
export function localDate(at: Date = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SERVICE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// "Tuesday, October 20"
export function formatServiceDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-CA", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
