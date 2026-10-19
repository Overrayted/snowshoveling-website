import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DrivewaySize, Property } from "@/lib/supabase/database.types";

// Trims and collapses whitespace so "12  Main St " and "12 Main St" match.
export function normalizeStreetAddress(address: string): string {
  return address.trim().replace(/\s+/g, " ");
}

export async function createProperty(input: {
  customerId: string;
  streetAddress: string;
  drivewaySize: DrivewaySize | null;
  estimatedSquareFeet: number | null;
}): Promise<Property> {
  const { data, error } = await createAdminClient()
    .from("properties")
    .insert({
      customer_id: input.customerId,
      street_address: normalizeStreetAddress(input.streetAddress),
      driveway_size_category: input.drivewaySize,
      estimated_square_feet: input.estimatedSquareFeet,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function findProperty(
  customerId: string,
  streetAddress: string,
): Promise<Property | null> {
  const { data, error } = await createAdminClient()
    .from("properties")
    .select()
    .eq("customer_id", customerId)
    .eq("street_address", normalizeStreetAddress(streetAddress))
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listPropertiesForCustomer(customerId: string): Promise<Property[]> {
  const { data, error } = await createAdminClient()
    .from("properties")
    .select()
    .eq("customer_id", customerId)
    .order("created_at");
  if (error) throw error;
  return data;
}
