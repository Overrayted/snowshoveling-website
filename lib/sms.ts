import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { requireEnv } from "@/lib/env";

// Sends one SMS through Twilio's REST API. Throws on failure; callers sending
// to many people should catch per message so one bad number doesn't stop
// the rest. Twilio itself blocks numbers that have replied STOP.
export async function sendSms(to: string, body: string): Promise<string> {
  const sid = requireEnv("TWILIO_ACCOUNT_SID");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${sid}:${requireEnv("TWILIO_AUTH_TOKEN")}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: requireEnv("TWILIO_FROM_NUMBER"), Body: body }),
  });
  if (!res.ok) throw new Error(`Twilio HTTP ${res.status}: ${await res.text()}`);
  const message: { sid: string } = await res.json();
  return message.sid;
}

// Verifies a webhook really came from Twilio:
// https://www.twilio.com/docs/usage/webhooks/webhooks-security
// `url` must be the exact public URL configured in the Twilio console.
export function isValidTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | null,
): boolean {
  if (!signature) return false;
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  const expected = createHmac("sha1", requireEnv("TWILIO_AUTH_TOKEN")).update(data).digest();
  const given = Buffer.from(signature, "base64");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// TwiML reply that Twilio sends back to the texter (null sends nothing).
export function twimlMessage(text: string | null): Response {
  const escaped = text?.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);
  const twiml = escaped ? `<Response><Message>${escaped}</Message></Response>` : "<Response/>";
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${twiml}`, {
    headers: { "content-type": "text/xml" },
  });
}
