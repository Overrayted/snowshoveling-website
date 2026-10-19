# Kaiyns setup guide

How to connect every service the site uses and put it online. Do the steps in
order: each one gets another part of the site working.

Prices below were checked in October 2026 and can change, so confirm them on
each provider's pricing page.

## What it costs

| Service | What it does | Plan | Approx. cost |
|---|---|---|---|
| Vercel | Hosts the website, runs the daily storm check | Pro | US$20/month |
| Supabase | Database and staff logins | Free | $0 |
| Google Maps | Finds the address, takes the satellite photo | Free up to 10,000 of each per month | $0 at our size |
| Gemini | Estimates driveway size from the photo | Paid tier (see step 3) | A few cents/month |
| OpenWeatherMap | Snow forecast | Free | $0 |
| Twilio | Storm texts to customers and staff | Pay as you go | Number about $1–2/month, plus under 1¢ per text |

Total: roughly **US$25/month**.

**Why Vercel?** Vercel makes Next.js, so the features this site uses work with
no extra setup, and it runs the daily storm check from `vercel.json`
automatically. Vercel's free Hobby plan is only for personal, non-commercial
projects, so upgrade to **Pro** before taking real customers.

All keys go in `.env.local` for local development (copy `.env.example`), and
in Vercel's Environment Variables for the live site. Never share the secret
keys or commit `.env.local`.

---

## 1. Supabase (database and staff logins)

1. Sign up at [supabase.com](https://supabase.com) → **New project**. Choose
   the **Canada (Central)** region and save the database password somewhere safe.
2. **Project Settings → API Keys**: copy these into `.env.local`:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Secret key → `SUPABASE_SECRET_KEY`
3. **SQL Editor**: paste and run each file in `supabase/migrations/`, in this
   order:
   1. `20261018000000_init.sql`
   2. `20261019000000_storms_and_staff.sql`
4. **Authentication → Sign In / Providers**: turn **off** "Allow new users to
   sign up", so only people you add can log in.
5. Add each staff member (owners and workers):
   1. **Authentication → Users → Add user → Create new user**. Enter their
      email and a password, and tick auto-confirm.
   2. Copy their **user ID** from the users list.
   3. In the **SQL Editor**, run:
      ```sql
      insert into public.staff (user_id, full_name, phone_number)
      values ('paste-user-id', 'Their Name', '+16475551234');
      ```
      The phone number gets storm alert texts. Use `null` for no texts.

**Now working:** customer signups save to the database, and staff can log in
at `/staff`.

## 2. Google Maps (address lookup and satellite photo)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and
   create a project called "Kaiyns".
2. **Billing**: add a billing account. A card is required even though we stay
   inside the free allowance.
3. **APIs & Services → Library**: enable **Geocoding API** and **Maps Static API**.
4. **APIs & Services → Credentials → Create credentials → API key**. Edit the
   key → **API restrictions** → **Restrict key** → tick only those two APIs.
   Save it as `GOOGLE_MAPS_API_KEY`.
5. **Protect against abuse.** Anyone can type addresses into the quote page,
   and each new address costs a lookup.
   - **Billing → Budgets & alerts**: create a budget (e.g. $10) with email alerts.
   - **APIs & Services → Geocoding API → Quotas**: cap requests per day
     (e.g. 500). Do the same for **Maps Static API**.

## 3. Gemini (driveway size)

1. Go to [aistudio.google.com](https://aistudio.google.com) → **Get API key**
   → create it in the same "Kaiyns" Google project.
2. Save it as `GEMINI_API_KEY`. The model is set by `GEMINI_MODEL`
   (default `gemini-2.5-flash`).
3. Turn on billing for the key (the paid tier). On the free tier, Google may
   use what we send (photos of customers' homes) to improve its products, and
   usage limits are lower. At our volume the paid tier costs pennies.

**Now working:** the quote page shows "Your driveway looks medium-sized…", and
the size is saved with each signup for future square-footage pricing.

## 4. Put the site online with Vercel

1. Put the code on GitHub in a **private** repository.
2. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import the
   repository.
3. **Settings → Environment Variables**: add every variable from `.env.local`,
   with these values for the live site:
   - `NEXT_PUBLIC_SITE_URL`: the real address, e.g. `https://kaiyns.ca`
     (no slash at the end). Texts link to it, and the Twilio security check
     depends on it being exact.
   - `CRON_SECRET`: a long random string. Make one by running
     `openssl rand -hex 32` in a terminal.
4. **Deploy.**
5. **Settings → Domains**: buy or connect the domain.
6. Upgrade to **Pro** before taking real customers.

The daily storm check runs automatically at 21:00 UTC (5pm in summer, 4pm in
winter, Toronto time). Vercel sends `CRON_SECRET` with it, so there's nothing
else to set up. To change the time, edit `schedule` in `vercel.json`.

> **Hosting somewhere else?** Have the host call
> `GET https://yourdomain/api/cron/storm-check` once a day with the header
> `Authorization: Bearer <CRON_SECRET>`.

## 5. OpenWeatherMap (snow forecast)

1. Sign up at [openweathermap.org](https://openweathermap.org) → **API keys**
   tab → copy the default key into `OPENWEATHER_API_KEY`. The free plan
   includes the 5-day forecast the site uses.
2. New keys can take a couple of hours to start working.
3. Set the middle of the service area. Defaults are downtown Toronto; right-click
   a spot in Google Maps to copy its coordinates.
   - `SERVICE_AREA_LAT`, e.g. `43.6532`
   - `SERVICE_AREA_LON`, e.g. `-79.3832`
4. `SNOW_ALERT_THRESHOLD_MM` (default `5`) is how much snow starts a storm day.
   OpenWeatherMap reports snow as millimetres of precipitation, and 1 mm is
   *roughly* 1 cm on the ground. Watch the first few storms and adjust.

## 6. Twilio (texts)

Do this after step 4, because Twilio needs the live web address.

1. Sign up at [twilio.com](https://www.twilio.com). Trial accounts can only
   text numbers you've verified, so **upgrade** by adding about $20 of credit.
2. **Phone Numbers → Buy a number**: choose **Canada**, search for 647 or 416,
   and make sure **SMS** is ticked. Twilio may ask us to register the business
   for messaging. Follow its prompts, and start early since approval can take
   a few days.
3. From the Twilio console home page, copy these into Vercel:
   - Account SID → `TWILIO_ACCOUNT_SID`
   - Auth Token → `TWILIO_AUTH_TOKEN`
   - The number, as `+1647…` → `TWILIO_FROM_NUMBER`
4. **Phone Numbers → Manage → Active numbers** → click the number →
   **Messaging configuration** → "A message comes in":
   - **Webhook**, URL `https://yourdomain/api/twilio/sms`, **HTTP POST**
   - Save.
5. **Redeploy** in Vercel (Deployments → ⋯ → Redeploy) so the new settings
   take effect.

Twilio handles STOP/START replies by itself, and the site also records STOP so
that customer isn't offered visits again.

## 7. Test everything with your own phone

1. On the live site, enter your address and check the quote page shows a
   driveway size.
2. Sign up as a **One Storm** customer with your own phone number, and tick
   "Text me when snow is coming".
3. Log in at `/staff` → **Start a storm day** for tomorrow.
4. You should get:
   - the offer text ("Snow is on the way… Reply YES to book")
   - the staff summary text (if your number is in the `staff` table)
5. Reply **YES**. You should get a confirmation, and your house should move to
   **To shovel** on the staff page.
6. Clean up: in Supabase **Table Editor**, delete the test row from `storms`
   (its visits go with it), then your test customer from `customers`.

If something doesn't work, check **Vercel → Logs** for the error message.

---

## Known issue: Supabase pauses idle free projects

Supabase pauses free projects after about a week with no database activity.
The daily storm check only touches the database on storm days, so during a dry
spell, or all summer, the project can pause. Signups and the staff page then
fail until it's restored by hand in the Supabase dashboard.

Fixes (pick one before launch):
- Make the daily storm check also touch the database so the project never goes
  idle (a small code change).
- Or upgrade to Supabase Pro (about $25/month), which doesn't pause.

## Adding a worker later

Repeat step 1.5: create their login in Supabase, then add their row to the
`staff` table. To remove someone, delete their user under
**Authentication → Users**; their staff row is removed with it.
