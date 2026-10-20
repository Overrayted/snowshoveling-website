import type PocketBase from "pocketbase";
import type { RecordService } from "pocketbase";

// Mirrors pocketbase/pb_migrations. Empty text/select/date/relation fields
// come back as "" and empty numbers as 0, never null.

export type DrivewaySize = "small" | "medium" | "large";
export type PlanType = "one_time" | "monthly" | "full_season";
// pending: signed up, waiting for Stripe checkout to complete
export type SubscriptionStatus = "pending" | "active" | "paused" | "expired";
export type VisitStatus = "offered" | "booked" | "done" | "skipped";
export type PaymentStatus = "not_needed" | "due" | "paid" | "failed";

type BaseRecord = {
  id: string;
  collectionId: string;
  collectionName: string;
  created: string;
  updated: string;
};

export type StaffRecord = BaseRecord & {
  email: string;
  full_name: string;
  phone_number: string;
};

export type CustomerRecord = BaseRecord & {
  full_name: string;
  phone_number: string;
  address: string;
  sms_opt_in: boolean;
  sms_opt_in_at: string;
  stripe_customer_id: string;
  stripe_payment_method: string;
};

export type PropertyRecord = BaseRecord & {
  customer: string;
  street_address: string;
  driveway_size: DrivewaySize | "";
  estimated_square_feet: number;
};

export type SubscriptionRecord = BaseRecord & {
  customer: string;
  property: string;
  plan_type: PlanType;
  status: SubscriptionStatus;
  quote_amount: number;
  start_date: string;
  stripe_checkout_session: string;
  stripe_subscription_id: string;
};

export type StormRecord = BaseRecord & {
  service_date: string;
  expected_snow_mm: number;
  source: "forecast" | "manual";
};

export type VisitRecord = BaseRecord & {
  storm: string;
  property: string;
  subscription: string;
  status: VisitStatus;
  price: number;
  booked_at: string;
  completed_at: string;
  completed_by: string;
  payment_status: PaymentStatus | "";
  stripe_payment_intent: string;
  payment_error: string;
  payment_attempts: number;
};

export type SmsLogRecord = BaseRecord & {
  key: string;
  to: string;
  body: string;
  twilio_sid: string;
};

export type DrivewayEstimateRecord = BaseRecord & {
  address_key: string;
  status: "ok" | "not_found";
  size: DrivewaySize | "";
  square_feet: number;
  formatted_address: string;
};

// Adds typed `expand` data to a record fetched with the `expand` option.
export type WithExpand<R, E> = R & { expand?: Partial<E> };

export interface TypedPocketBase extends PocketBase {
  collection(idOrName: "staff"): RecordService<StaffRecord>;
  collection(idOrName: "customers"): RecordService<CustomerRecord>;
  collection(idOrName: "properties"): RecordService<PropertyRecord>;
  collection(idOrName: "subscriptions"): RecordService<SubscriptionRecord>;
  collection(idOrName: "storms"): RecordService<StormRecord>;
  collection(idOrName: "visits"): RecordService<VisitRecord>;
  collection(idOrName: "sms_log"): RecordService<SmsLogRecord>;
  collection(idOrName: "driveway_estimates"): RecordService<DrivewayEstimateRecord>;
  collection(idOrName: string): RecordService;
}
