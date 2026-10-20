/// <reference path="../pb_data/types.d.ts" />

// Stripe payments: links customers, plans and visits to Stripe, and adds a
// "pending" plan status for signups that haven't finished paying.

migrate(
  (app) => {
    const customers = app.findCollectionByNameOrId("customers");
    customers.fields.add(
      new TextField({ name: "stripe_customer_id" }),
      // Card saved at signup for One Storm customers, charged after each visit
      new TextField({ name: "stripe_payment_method" }),
    );
    app.save(customers);

    const subscriptions = app.findCollectionByNameOrId("subscriptions");
    // pending: signed up, waiting for Stripe checkout to complete
    subscriptions.fields.getByName("status").values = ["pending", "active", "paused", "expired"];
    subscriptions.fields.add(
      new TextField({ name: "stripe_checkout_session" }),
      // Monthly plans only
      new TextField({ name: "stripe_subscription_id" }),
    );
    app.save(subscriptions);

    const visits = app.findCollectionByNameOrId("visits");
    visits.fields.add(
      // not_needed: covered by their plan; due: charge when marked done
      new SelectField({
        name: "payment_status",
        values: ["not_needed", "due", "paid", "failed"],
        maxSelect: 1,
      }),
      new TextField({ name: "stripe_payment_intent" }),
      new TextField({ name: "payment_error" }),
      // Number of charge attempts, so a retry after a decline is a new charge
      new NumberField({ name: "payment_attempts", min: 0, onlyInt: true }),
    );
    app.save(visits);
  },
  (app) => {
    const customers = app.findCollectionByNameOrId("customers");
    customers.fields.removeByName("stripe_customer_id");
    customers.fields.removeByName("stripe_payment_method");
    app.save(customers);

    const subscriptions = app.findCollectionByNameOrId("subscriptions");
    subscriptions.fields.getByName("status").values = ["active", "paused", "expired"];
    subscriptions.fields.removeByName("stripe_checkout_session");
    subscriptions.fields.removeByName("stripe_subscription_id");
    app.save(subscriptions);

    const visits = app.findCollectionByNameOrId("visits");
    for (const name of ["payment_status", "stripe_payment_intent", "payment_error", "payment_attempts"]) {
      visits.fields.removeByName(name);
    }
    app.save(visits);
  },
);
