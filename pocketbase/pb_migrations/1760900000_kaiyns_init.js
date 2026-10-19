/// <reference path="../pb_data/types.d.ts" />

// Kaiyns schema. Copy this folder's files into your PocketBase pb_migrations
// directory and restart PocketBase (or run `pocketbase migrate up`).
// Requires PocketBase v0.23 or newer.
//
// Access rules: the website's server signs in as a superuser, which bypasses
// all rules. Signed-in staff (the `staff` auth collection) can read business
// data and update visits. The public can't read or write anything directly.

const STAFF = '@request.auth.collectionName = "staff"';

const timestamps = [
  { name: "created", type: "autodate", onCreate: true, onUpdate: false },
  { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
];

migrate(
  (app) => {
    // Staff logins. Create accounts in the PocketBase dashboard; there is no
    // public sign-up. phone_number receives storm alert texts (leave empty to
    // opt out).
    const staff = new Collection({
      type: "auth",
      name: "staff",
      listRule: "id = @request.auth.id",
      viewRule: "id = @request.auth.id",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: "full_name", type: "text", required: true, max: 100 },
        { name: "phone_number", type: "text", pattern: "^\\+1\\d{10}$" },
      ],
    });
    app.save(staff);

    const customers = new Collection({
      type: "base",
      name: "customers",
      listRule: STAFF,
      viewRule: STAFF,
      fields: [
        { name: "full_name", type: "text", required: true, max: 100 },
        // E.164, e.g. +16475551234. Phone number is the customer's identity.
        { name: "phone_number", type: "text", required: true, pattern: "^\\+1\\d{10}$" },
        { name: "address", type: "text", required: true, max: 200 },
        // Canada's anti-spam law (CASL) needs express consent before we text offers
        { name: "sms_opt_in", type: "bool" },
        { name: "sms_opt_in_at", type: "date" },
        ...timestamps,
      ],
      indexes: ["CREATE UNIQUE INDEX `idx_customers_phone` ON `customers` (`phone_number`)"],
    });
    app.save(customers);

    const properties = new Collection({
      type: "base",
      name: "properties",
      listRule: STAFF,
      viewRule: STAFF,
      fields: [
        { name: "customer", type: "relation", required: true, collectionId: customers.id, cascadeDelete: true, maxSelect: 1 },
        { name: "street_address", type: "text", required: true, max: 200 },
        { name: "driveway_size", type: "select", values: ["small", "medium", "large"], maxSelect: 1 },
        // 0 = unknown
        { name: "estimated_square_feet", type: "number", min: 0, onlyInt: true },
        ...timestamps,
      ],
      indexes: ["CREATE INDEX `idx_properties_customer` ON `properties` (`customer`)"],
    });
    app.save(properties);

    const subscriptions = new Collection({
      type: "base",
      name: "subscriptions",
      listRule: STAFF,
      viewRule: STAFF,
      fields: [
        { name: "customer", type: "relation", required: true, collectionId: customers.id, cascadeDelete: true, maxSelect: 1 },
        { name: "property", type: "relation", collectionId: properties.id, cascadeDelete: false, maxSelect: 1 },
        { name: "plan_type", type: "select", required: true, values: ["one_time", "monthly", "full_season"], maxSelect: 1 },
        { name: "status", type: "select", required: true, values: ["active", "paused", "expired"], maxSelect: 1 },
        { name: "quote_amount", type: "number", required: true, min: 0 },
        { name: "start_date", type: "text", required: true, pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        ...timestamps,
      ],
      indexes: [
        "CREATE INDEX `idx_subscriptions_customer` ON `subscriptions` (`customer`)",
        // At most one active plan per property. Changing plans expires the old
        // row and adds a new one, which keeps plan history.
        "CREATE UNIQUE INDEX `idx_subscriptions_one_active` ON `subscriptions` (`customer`, `property`) WHERE `status` = 'active'",
      ],
    });
    app.save(subscriptions);

    // One row per day we go out shovelling.
    const storms = new Collection({
      type: "base",
      name: "storms",
      listRule: STAFF,
      viewRule: STAFF,
      fields: [
        // YYYY-MM-DD in Toronto time
        { name: "service_date", type: "text", required: true, pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        // 0 = unknown (storm day started by hand)
        { name: "expected_snow_mm", type: "number", min: 0 },
        { name: "source", type: "select", required: true, values: ["forecast", "manual"], maxSelect: 1 },
        ...timestamps,
      ],
      indexes: ["CREATE UNIQUE INDEX `idx_storms_service_date` ON `storms` (`service_date`)"],
    });
    app.save(storms);

    // offered: one-time customer was texted, no reply yet
    // booked:  on the list to shovel (subscribers are booked automatically)
    const visits = new Collection({
      type: "base",
      name: "visits",
      listRule: STAFF,
      viewRule: STAFF,
      updateRule: STAFF,
      fields: [
        { name: "storm", type: "relation", required: true, collectionId: storms.id, cascadeDelete: true, maxSelect: 1 },
        { name: "property", type: "relation", required: true, collectionId: properties.id, cascadeDelete: true, maxSelect: 1 },
        { name: "subscription", type: "relation", collectionId: subscriptions.id, cascadeDelete: false, maxSelect: 1 },
        { name: "status", type: "select", required: true, values: ["offered", "booked", "done", "skipped"], maxSelect: 1 },
        // Amount to collect on the day; 0 = covered by their plan
        { name: "price", type: "number", min: 0 },
        { name: "booked_at", type: "date" },
        { name: "completed_at", type: "date" },
        { name: "completed_by", type: "relation", collectionId: staff.id, cascadeDelete: false, maxSelect: 1 },
        ...timestamps,
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_visits_storm_property` ON `visits` (`storm`, `property`)",
        "CREATE INDEX `idx_visits_storm_status` ON `visits` (`storm`, `status`)",
      ],
    });
    app.save(visits);

    // Every text we send. The unique `key` doubles as a lock, so the same text
    // (e.g. one storm offer per visit) can never be sent twice.
    const smsLog = new Collection({
      type: "base",
      name: "sms_log",
      fields: [
        { name: "key", type: "text", required: true },
        { name: "to", type: "text", required: true },
        { name: "body", type: "text", required: true },
        { name: "twilio_sid", type: "text" },
        ...timestamps,
      ],
      indexes: ["CREATE UNIQUE INDEX `idx_sms_log_key` ON `sms_log` (`key`)"],
    });
    app.save(smsLog);

    // Gemini driveway estimates, cached per address so the quote page and the
    // signup don't each pay for one.
    const estimates = new Collection({
      type: "base",
      name: "driveway_estimates",
      fields: [
        { name: "address_key", type: "text", required: true },
        { name: "status", type: "select", required: true, values: ["ok", "not_found"], maxSelect: 1 },
        { name: "size", type: "select", values: ["small", "medium", "large"], maxSelect: 1 },
        { name: "square_feet", type: "number", min: 0, onlyInt: true },
        { name: "formatted_address", type: "text" },
        ...timestamps,
      ],
      indexes: ["CREATE UNIQUE INDEX `idx_estimates_address` ON `driveway_estimates` (`address_key`)"],
    });
    app.save(estimates);
  },
  (app) => {
    for (const name of [
      "driveway_estimates",
      "sms_log",
      "visits",
      "storms",
      "subscriptions",
      "properties",
      "customers",
      "staff",
    ]) {
      app.delete(app.findCollectionByNameOrId(name));
    }
  },
);
