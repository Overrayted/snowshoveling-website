import "server-only";
import { getAdminClient, isNotFound } from "@/lib/pocketbase/client";
import type { DrivewaySize, PropertyRecord } from "@/lib/pocketbase/types";

// Trims and collapses whitespace so "12  Main St " and "12 Main St" match.
export function normalizeStreetAddress(address: string): string {
  return address.trim().replace(/\s+/g, " ");
}

export async function createProperty(input: {
  customerId: string;
  streetAddress: string;
  drivewaySize: DrivewaySize | null;
  estimatedSquareFeet: number | null;
}): Promise<PropertyRecord> {
  const pb = await getAdminClient();
  return pb.collection("properties").create({
    customer: input.customerId,
    street_address: normalizeStreetAddress(input.streetAddress),
    driveway_size: input.drivewaySize ?? "",
    estimated_square_feet: input.estimatedSquareFeet ?? 0,
  });
}

export async function findProperty(
  customerId: string,
  streetAddress: string,
): Promise<PropertyRecord | null> {
  const pb = await getAdminClient();
  try {
    return await pb.collection("properties").getFirstListItem(
      pb.filter("customer = {:customerId} && street_address = {:street}", {
        customerId,
        street: normalizeStreetAddress(streetAddress),
      }),
    );
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}
