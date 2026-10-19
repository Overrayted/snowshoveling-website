import "server-only";
import { BUSINESS_PHONE, formatPrice, getPlan } from "@/lib/business";
import { formatServiceDate, localDate } from "@/lib/dates";
import { publicEnv } from "@/lib/env";
import { sendSms } from "@/lib/sms";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Storm } from "@/lib/supabase/database.types";

type VisitInsert = Database["public"]["Tables"]["visits"]["Insert"];

export type StormDayResult = {
  storm: Storm;
  bookedSubscribers: number;
  offersSent: number;
  offerFailures: number;
  workersNotified: number;
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
  const db = createAdminClient();

  const { error: insertError } = await db
    .from("storms")
    .upsert(
      {
        service_date: input.serviceDate,
        expected_snow_mm: input.expectedSnowMm,
        source: input.source,
      },
      { onConflict: "service_date", ignoreDuplicates: true },
    );
  if (insertError) throw insertError;
  const { data: storm, error: stormError } = await db
    .from("storms")
    .select()
    .eq("service_date", input.serviceDate)
    .single();
  if (stormError) throw stormError;

  const { data: subscriptions, error: subsError } = await db
    .from("subscriptions")
    .select("id, plan_type, property_id, customers!inner(sms_opt_in)")
    .eq("status", "active")
    .not("property_id", "is", null);
  if (subsError) throw subsError;

  const now = new Date().toISOString();
  const visits: VisitInsert[] = [];
  for (const sub of subscriptions) {
    if (sub.plan_type === "one_time") {
      // Without consent we can't text them; staff can still call.
      if (!sub.customers.sms_opt_in) continue;
      visits.push({
        storm_id: storm.id,
        property_id: sub.property_id!,
        subscription_id: sub.id,
        status: "offered",
        price: getPlan("one_time").price,
      });
    } else {
      visits.push({
        storm_id: storm.id,
        property_id: sub.property_id!,
        subscription_id: sub.id,
        status: "booked",
        booked_at: now,
      });
    }
  }
  if (visits.length > 0) {
    const { error } = await db
      .from("visits")
      .upsert(visits, { onConflict: "storm_id,property_id", ignoreDuplicates: true });
    if (error) throw error;
  }

  const offers = await sendPendingOffers(storm);
  const bookedSubscribers = visits.filter((v) => v.status === "booked").length;
  const workersNotified = await notifyStaff(storm, bookedSubscribers, offers.sent);

  return {
    storm,
    bookedSubscribers,
    offersSent: offers.sent,
    offerFailures: offers.failed,
    workersNotified,
  };
}

async function sendPendingOffers(storm: Storm) {
  const db = createAdminClient();
  const { data: pending, error } = await db
    .from("visits")
    .select("id, properties!inner(customers!inner(phone_number))")
    .eq("storm_id", storm.id)
    .eq("status", "offered")
    .is("offer_sent_at", null);
  if (error) throw error;

  const body = offerMessage(storm);
  let sent = 0;
  let failed = 0;
  for (const visit of pending) {
    // Claim the row first so a concurrent run can't text the same person
    const { data: claimed } = await db
      .from("visits")
      .update({ offer_sent_at: new Date().toISOString() })
      .eq("id", visit.id)
      .is("offer_sent_at", null)
      .select("id");
    if (!claimed?.length) continue;

    try {
      await sendSms(visit.properties.customers.phone_number, body);
      sent++;
    } catch (err) {
      console.error(`Storm offer SMS failed for visit ${visit.id}`, err);
      failed++;
      // Release the claim so the next run retries
      await db.from("visits").update({ offer_sent_at: null }).eq("id", visit.id);
    }
  }
  return { sent, failed };
}

function offerMessage(storm: Storm): string {
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

async function notifyStaff(storm: Storm, booked: number, offers: number): Promise<number> {
  const db = createAdminClient();
  // Claim, so staff get one summary per storm day even if this runs again
  const { data: claimed } = await db
    .from("storms")
    .update({ workers_notified_at: new Date().toISOString() })
    .eq("id", storm.id)
    .is("workers_notified_at", null)
    .select("id");
  if (!claimed?.length) return 0;

  const { data: staff, error } = await db
    .from("staff")
    .select("phone_number")
    .not("phone_number", "is", null);
  if (error) throw error;

  const snow = storm.expected_snow_mm ? `About ${Math.round(storm.expected_snow_mm)} cm of snow expected. ` : "";
  const body =
    `Kaiyns storm day: ${formatServiceDate(storm.service_date)}. ${snow}` +
    `${booked} subscriber driveway(s) booked, ${offers} one-time customer(s) texted. ` +
    `Visit list: ${publicEnv.siteUrl}/staff`;

  let notified = 0;
  for (const member of staff) {
    try {
      await sendSms(member.phone_number!, body);
      notified++;
    } catch (err) {
      console.error("Staff storm SMS failed", err);
    }
  }
  return notified;
}

// Handles a one-time customer's text reply. Returns the text to send back,
// or null for no reply.
export async function handleCustomerReply(fromPhone: string, text: string): Promise<string | null> {
  const db = createAdminClient();
  const word = text.trim().toLowerCase().split(/\s+/)[0]?.replace(/[^a-z]/g, "") ?? "";

  // Twilio answers these opt-out keywords itself; we just record the opt-out.
  if (["stop", "stopall", "unsubscribe", "cancel", "end", "quit"].includes(word)) {
    await db.from("customers").update({ sms_opt_in: false }).eq("phone_number", fromPhone);
    return null;
  }
  if (["start", "unstop", "help", "info"].includes(word)) return null;

  const callUs = `call us at ${BUSINESS_PHONE.display}`;
  const { data: customer } = await db
    .from("customers")
    .select("id")
    .eq("phone_number", fromPhone)
    .maybeSingle();
  if (!customer) {
    return `Kaiyns Snow Shovelling: we couldn't find your number in our list. Please ${callUs}.`;
  }

  if (["no", "n", "nope", "nah"].includes(word)) {
    return "No problem. We'll text you next time snow is on the way.";
  }
  if (!["yes", "y", "yeah", "yep", "yup", "ok", "okay", "sure", "book", "please"].includes(word)) {
    return `Sorry, we didn't understand. Reply YES to book a visit, or ${callUs}.`;
  }

  const { data: visits, error } = await db
    .from("visits")
    .select("id, status, storms!inner(service_date), properties!inner(customer_id)")
    .eq("properties.customer_id", customer.id)
    .in("status", ["offered", "booked"])
    .gte("storms.service_date", localDate());
  if (error) throw error;

  const next = visits.sort((a, b) => a.storms.service_date.localeCompare(b.storms.service_date))[0];
  if (!next) {
    return `There's no snow day to book right now. We'll text you when snow is coming, or ${callUs}.`;
  }
  const day = formatServiceDate(next.storms.service_date);
  if (next.status === "booked") return `You're already booked for ${day}. See you then!`;

  const { error: updateError } = await db
    .from("visits")
    .update({ status: "booked", booked_at: new Date().toISOString() })
    .eq("id", next.id);
  if (updateError) throw updateError;

  return (
    `Thank you! You're booked: we'll shovel your driveway on ${day}. ` +
    `The price is ${formatPrice(getPlan("one_time").price)}, no HST. Questions? ${callUs[0].toUpperCase()}${callUs.slice(1)}.`
  );
}
