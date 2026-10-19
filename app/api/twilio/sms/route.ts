import { BUSINESS_PHONE } from "@/lib/business";
import { siteUrl } from "@/lib/env";
import { isValidTwilioSignature, twimlMessage } from "@/lib/sms";
import { handleCustomerReply } from "@/lib/storms";

// Twilio calls this when someone texts our number. In the Twilio console, set
// the number's "A message comes in" webhook to
// <SITE_URL>/api/twilio/sms (HTTP POST).
export async function POST(request: Request) {
  const form = await request.formData();
  const params = Object.fromEntries(
    [...form.entries()].map(([key, value]) => [key, String(value)]),
  );

  // Behind a proxy request.url may not match what Twilio signed, so rebuild
  // the public URL from config.
  const publicUrl = `${siteUrl()}/api/twilio/sms`;
  if (!isValidTwilioSignature(publicUrl, params, request.headers.get("x-twilio-signature"))) {
    return new Response("Invalid signature", { status: 403 });
  }

  try {
    return twimlMessage(await handleCustomerReply(params.From ?? "", params.Body ?? ""));
  } catch (err) {
    console.error("SMS reply handling failed", err);
    return twimlMessage(
      `Sorry, something went wrong on our end. Please call us at ${BUSINESS_PHONE.display}.`,
    );
  }
}
