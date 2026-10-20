"use server";

import { redirect } from "next/navigation";
import { BUSINESS_PHONE, PLANS, getQuoteAmount } from "@/lib/business";
import { normalizePhone } from "@/lib/db/customers";
import { signUpCustomer, type SignupResult } from "@/lib/db/signup";
import { estimateDriveway } from "@/lib/estimator";
import type { PlanType } from "@/lib/pocketbase/types";

export type SignupValues = {
  plan: string;
  fullName: string;
  phone: string;
  address: string;
  smsOptIn: boolean;
};

export type SignupState = {
  values: SignupValues;
  errors: Partial<Record<Exclude<keyof SignupValues, "smsOptIn">, string>>;
  formError?: string;
};

export async function submitSignup(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const values: SignupValues = {
    plan: String(formData.get("plan") ?? ""),
    fullName: String(formData.get("fullName") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    smsOptIn: formData.get("smsOptIn") === "on",
  };

  const errors: SignupState["errors"] = {};
  const plan = PLANS.find((p) => p.type === values.plan);
  if (!plan) errors.plan = "Please choose a plan.";
  if (!values.fullName) errors.fullName = "Please enter your name.";
  else if (values.fullName.length > 100) errors.fullName = "Please use a shorter name.";
  const phone = normalizePhone(values.phone);
  if (!phone) errors.phone = "Please enter a 10-digit phone number, like 647-555-1234.";
  if (!values.address) errors.address = "Please enter your address.";
  else if (values.address.length > 200) errors.address = "Please use a shorter address.";

  if (!plan || !phone || Object.keys(errors).length > 0) {
    return { values, errors };
  }

  // Cached from the quote page, so this usually doesn't call Gemini again
  const estimate = await estimateDriveway(values.address);
  const drivewaySize = estimate.status === "ok" ? estimate.size : null;
  const estimatedSquareFeet = estimate.status === "ok" ? estimate.squareFeet : null;

  let result: SignupResult;
  try {
    result = await signUpCustomer({
      fullName: values.fullName,
      phoneNumber: phone,
      address: values.address,
      smsOptIn: values.smsOptIn,
      streetAddress: values.address,
      drivewaySize,
      estimatedSquareFeet,
      planType: plan.type as PlanType,
      quoteAmount: getQuoteAmount({ planType: plan.type, drivewaySize, estimatedSquareFeet }),
    });
  } catch (error) {
    console.error("Signup failed", error);
    return {
      values,
      errors: {},
      formError: `Sorry, something went wrong saving your details. Please try again, or call us at ${BUSINESS_PHONE.display}.`,
    };
  }

  // redirect() throws, so it must stay outside the try/catch
  if (result.status === "already_active") redirect(`/thank-you?plan=${plan.type}&already=1`);
  // On to Stripe's secure payment page
  redirect(result.checkoutUrl);
}
