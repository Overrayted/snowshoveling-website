import "server-only";
import { BUSINESS_PHONE, formatPrice, getPlan } from "@/lib/business";
import { formatServiceDate, localDate } from "@/lib/dates";
import { siteUrl } from "@/lib/env";
import { getAdminClient, isNotFound, isValidationError } from "@/lib/pocketbase/client";
import type {
  CustomerRecord,
  PropertyRecord,
  StormRecord,
  SubscriptionRecord,
  VisitRecord,
  WithExpand,
} from "@/lib/pocketbase/types";
import { sendSms } from "@/lib/sms";

export type StormDayResult = {
  storm: StormRecord;
  bookedVisits: number;
  offersSent: number;
  offerFailures: number;
  staffNotified: number;
};

// Creates (or resumes) a storm day and does everything that follows from it:
//  1. Monthly and Full Season customers are booked automatically.
//  2. One-time customers who agreed to texts are offered a visit by SMS.
//  3. Staff are texted a summary.
// Safe to run more than once for the same date: nobody is texted twice.
export async function startStormDay(input: {
  serviceDate: string;
  expectedSnowMm: number | null;
  source: "forecast" | "manual";
}): Promise<StormDayResult> {
  const pb = await getAdminClient();
  const storm = await findOrCreateStorm(input);

  const [subscriptions, existing] = await Promise.all([
    pb
      .collection("subscriptions")
      .getFullList<WithExpand<SubscriptionRecord, { customer: CustomerRecord }>>({
        filter: 'status = "active" && property != ""',
        expand: "customer",
      }),
    pb.collection("visits").getFullList({
      filter: pb.filter("storm = {:storm}", { storm: storm.id }),
      fields: "property",
    }),
  ]);
  const alreadyListed = new Set(existing.map((v) => v.property));

  const now = new Date().toISOString();
  for (const sub of subscriptions) {
    if (alreadyListed.has(sub.property)) continue;
    const isOneTime = sub.plan_type === "one_time";
    // Without consent we can't text them; staff can still call.
    if (isOneTime && !sub.expand?.customer?.sms_opt_in) continue;

    try {
      await pb.collection("visits").create({
        storm: storm.id,
        property: sub.property,
        subscription: sub.id,
        status: isOneTime ? "offered" : "booked",
        price: isOneTime ? getPlan("one_time").price : 0,
        booked_at: isOneTime ? "" : now,
      });
    } catch (error) {
      // Another run added this visit in the meantime
      if (!isValidationError(error)) throw error;
    }
  }

  const offers = await sendPendingOffers(storm);
  const { totalItems: bookedVisits } = await pb.collection("visits").getList(1, 1, {
    filter: pb.filter('storm = {:storm} && status = "booked"', { storm: storm.id }),
  });
  const staffNotified = await notifyStaff(storm, bookedVisits, offers.sent);

  return { storm, bookedVisits, offersSent: offers.sent, offerFailures: offers.failed, staffNotified };
}

async function findOrCreateStorm(input: {
  serviceDate: string;
  expectedSnowMm: number | null;
  source: "forecast" | "manual";
}): Promise<StormRecord> {
  const pb = await getAdminClient();
  const find = () =>
    pb
      .collection("storms")
      .getFirstListItem(pb.filter("service_date = {:date}", { date: input.serviceDate }));
  try {
    return await find();
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  try {
    return await pb.collection("storms").create({
      service_date: input.serviceDate,
      expected_snow_mm: input.expectedSnowMm ?? 0,
      source: input.source,
    });
  } catch (error) {
    if (isValidationError(error)) return find();
    throw error;
  }
}

type SendResult = "sent" | "already_sent" | "failed";

// Sends a text at most once per `key`. The sms_log row is written first and
// its unique key acts as a lock; it's removed again if Twilio fails, so the
// next run retries.
async function sendSmsOnce(key: string, to: string, body: string): Promise<SendResult> {
  const pb = await getAdminClient();
  let log;
  try {
    log = await pb.collection("sms_log").create({ key, to, body });
  } catch (error) {
    if (isValidationError(error)) return "already_sent";
    throw error;
  }
  try {
    const sid = await sendSms(to, body);
    await pb.collection("sms_log").update(log.id, { twilio_sid: sid });
    return "sent";
  } catch (error) {
    console.error(`SMS failed (${key})`, error);
    await pb.collection("sms_log").delete(log.id);
    return "failed";
  }
}

async function sendPendingOffers(storm: StormRecord) {
  const pb = await getAdminClient();
  const offered = await pb.collection("visits").getFullList<
    WithExpand<VisitRecord, { property: WithExpand<PropertyRecord, { customer: CustomerRecord }> }>
  >({
    filter: pb.filter('storm = {:storm} && status = "offered"', { storm: storm.id }),
    expand: "property.customer",
  });

  const body = offerMessage(storm);
  let sent = 0;
  let failed = 0;
  for (const visit of offered) {
    const phone = visit.expand?.property?.expand?.customer?.phone_number;
    if (!phone) continue;
    const result = await sendSmsOnce(`offer:${visit.id}`, phone, body);
    if (result === "sent") sent++;
    if (result === "failed") failed++;
  }
  return { sent, failed };
}

function offerMessage(storm: StormRecord): string {
  const day = formatServiceDate(storm.service_date);
  const snow = storm.expected_snow_mm ? ` (about ${Math.round(storm.expected_snow_mm)} cm expected)` : "";
  const price = formatPrice(getPlan("one_time").price);
  return (
    `Kaiyns Snow Shovelling: snow is on the way${snow}. ` +
    `Would you like us to shovel your driveway on ${day}? ` +
    `It's ${price}, no HST. Reply YES to book, or call ${BUSINESS_PHONE.display}. ` +
    `Reply STOP to stop these texts.`
  );
}

async function notifyStaff(storm: StormRecord, booked: number, offers: number): Promise<number> {
  const pb = await getAdminClient();
  const staff = await pb.collection("staff").getFullList({ filter: 'phone_number != ""' });

  const snow = storm.expected_snow_mm ? `About ${Math.round(storm.expected_snow_mm)} cm of snow expected. ` : "";
  const body =
    `Kaiyns storm day: ${formatServiceDate(storm.service_date)}. ${snow}` +
    `${booked} driveway(s) booked, ${offers} one-time customer(s) texted. ` +
    `Visit list: ${siteUrl()}/staff`;

  let notified = 0;
  for (const member of staff) {
    const result = await sendSmsOnce(`storm-staff:${storm.id}:${member.id}`, member.phone_number, body);
    if (result === "sent") notified++;
  }
  return notified;
}

// Handles a one-time customer's text reply. Returns the text to send back,
// or null for no reply.
export async function handleCustomerReply(fromPhone: string, text: string): Promise<string | null> {
  const pb = await getAdminClient();
  const word = text.trim().toLowerCase().split(/\s+/)[0]?.replace(/[^a-z]/g, "") ?? "";

  let customer: CustomerRecord | null = null;
  try {
    customer = await pb
      .collection("customers")
      .getFirstListItem(pb.filter("phone_number = {:phone}", { phone: fromPhone }));
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  // Twilio answers these opt-out keywords itself; we just record the opt-out.
  if (["stop", "stopall", "unsubscribe", "cancel", "end", "quit"].includes(word)) {
    if (customer) await pb.collection("customers").update(customer.id, { sms_opt_in: false });
    return null;
  }
  if (["start", "unstop", "help", "info"].includes(word)) return null;

  const callUs = `call us at ${BUSINESS_PHONE.display}`;
  if (!customer) {
    return `Kaiyns Snow Shovelling: we couldn't find your number in our list. Please ${callUs}.`;
  }
  if (["no", "n", "nope", "nah"].includes(word)) {
    return "No problem. We'll text you next time snow is on the way.";
  }
  if (!["yes", "y", "yeah", "yep", "yup", "ok", "okay", "sure", "book", "please"].includes(word)) {
    return `Sorry, we didn't understand. Reply YES to book a visit, or ${callUs}.`;
  }

  const visits = await pb.collection("visits").getFullList<WithExpand<VisitRecord, { storm: StormRecord }>>({
    filter: pb.filter(
      'property.customer = {:customer} && (status = "offered" || status = "booked") && storm.service_date >= {:today}',
      { customer: customer.id, today: localDate() },
    ),
    expand: "storm",
  });
  const next = visits
    .filter((v) => v.expand?.storm)
    .sort((a, b) => a.expand!.storm!.service_date.localeCompare(b.expand!.storm!.service_date))[0];
  if (!next) {
    return `There's no snow day to book right now. We'll text you when snow is coming, or ${callUs}.`;
  }

  const day = formatServiceDate(next.expand!.storm!.service_date);
  if (next.status === "booked") return `You're already booked for ${day}. See you then!`;

  await pb.collection("visits").update(next.id, {
    status: "booked",
    booked_at: new Date().toISOString(),
  });
  return (
    `Thank you! You're booked: we'll shovel your driveway on ${day}. ` +
    `The price is ${formatPrice(getPlan("one_time").price)}, no HST. ` +
    `Questions? Call us at ${BUSINESS_PHONE.display}.`
  );
}
