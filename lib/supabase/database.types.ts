// Mirrors supabase/migrations. Once the Supabase CLI is linked, you can replace
// this file with generated types:
//   npx supabase gen types typescript --linked > lib/supabase/database.types.ts

export type DrivewaySize = "small" | "medium" | "large";
export type PlanType = "one_time" | "monthly" | "full_season";
export type SubscriptionStatus = "active" | "paused" | "expired";
export type VisitStatus = "offered" | "booked" | "done" | "skipped";

type Fk<Name extends string, Column extends string, Table extends string> = {
  foreignKeyName: Name;
  columns: [Column];
  isOneToOne: false;
  referencedRelation: Table;
  referencedColumns: ["id"];
};

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          full_name: string;
          phone_number: string;
          address: string;
          sms_opt_in: boolean;
          sms_opt_in_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          phone_number: string;
          address: string;
          sms_opt_in?: boolean;
          sms_opt_in_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
        Relationships: [];
      };
      properties: {
        Row: {
          id: string;
          customer_id: string;
          street_address: string;
          driveway_size_category: DrivewaySize | null;
          estimated_square_feet: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          street_address: string;
          driveway_size_category?: DrivewaySize | null;
          estimated_square_feet?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["properties"]["Insert"]>;
        Relationships: [Fk<"properties_customer_id_fkey", "customer_id", "customers">];
      };
      subscriptions: {
        Row: {
          id: string;
          customer_id: string;
          property_id: string | null;
          plan_type: PlanType;
          status: SubscriptionStatus;
          quote_amount: number;
          start_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          property_id?: string | null;
          plan_type: PlanType;
          status?: SubscriptionStatus;
          quote_amount: number;
          start_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
        Relationships: [
          Fk<"subscriptions_customer_id_fkey", "customer_id", "customers">,
          Fk<"subscriptions_property_id_fkey", "property_id", "properties">,
        ];
      };
      staff: {
        Row: {
          user_id: string;
          full_name: string;
          phone_number: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          full_name: string;
          phone_number?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["staff"]["Insert"]>;
        Relationships: [];
      };
      storms: {
        Row: {
          id: string;
          service_date: string;
          expected_snow_mm: number | null;
          source: "forecast" | "manual";
          workers_notified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          service_date: string;
          expected_snow_mm?: number | null;
          source: "forecast" | "manual";
          workers_notified_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["storms"]["Insert"]>;
        Relationships: [];
      };
      visits: {
        Row: {
          id: string;
          storm_id: string;
          property_id: string;
          subscription_id: string | null;
          status: VisitStatus;
          price: number | null;
          offer_sent_at: string | null;
          booked_at: string | null;
          completed_at: string | null;
          completed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          storm_id: string;
          property_id: string;
          subscription_id?: string | null;
          status: VisitStatus;
          price?: number | null;
          offer_sent_at?: string | null;
          booked_at?: string | null;
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["visits"]["Insert"]>;
        Relationships: [
          Fk<"visits_storm_id_fkey", "storm_id", "storms">,
          Fk<"visits_property_id_fkey", "property_id", "properties">,
          Fk<"visits_subscription_id_fkey", "subscription_id", "subscriptions">,
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_staff: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      driveway_size: DrivewaySize;
      plan_type: PlanType;
      subscription_status: SubscriptionStatus;
      visit_status: VisitStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type Tables = Database["public"]["Tables"];
export type Customer = Tables["customers"]["Row"];
export type Property = Tables["properties"]["Row"];
export type Subscription = Tables["subscriptions"]["Row"];
export type Storm = Tables["storms"]["Row"];
export type Visit = Tables["visits"]["Row"];
