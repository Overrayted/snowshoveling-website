# Kaiyns setup guide

How to connect every service the site uses and put it online. Do the steps in
order: each one gets another part of the site working.

Prices below were checked in October 2026 and can change, so confirm them on
each provider's pricing page.

## How it fits together

```
Customers' browsers ──► Cloudflare Workers (the website, always up)
Twilio texts ─────────►        │
Daily storm check ────►        │  over the internet (Cloudflare Tunnel)
                               ▼
                     PocketBase on the homelab (database + staff logins)
```

If the homelab goes down:

| Still works | Stops working until it's back |
|---|---|
| Home page, prices, call button | Signups (customers see "call us at 647-643-7864") |
| Quote page and driveway estimate | Staff visit list and logins |
| | Storm texts and YES replies |
| | Payment confirmations wait: Stripe keeps retrying, and plans activate once it's back |

## What it costs

| Service | What it does | Plan | Approx. cost |
|---|---|---|---|
| Cloudflare Workers | Hosts the website, runs the daily storm check | Free (Paid if needed, see step 5) | $0 (or US$5/month) |
| PocketBase | Database and staff logins | Your homelab | $0 |
| Cloudflare Tunnel + Access | Connects the website to the homelab securely | Free | $0 |
| Google Maps | Finds the address, takes the satellite photo | Free up to 10,000 of each per month | $0 at our size |
| Gemini | Estimates driveway size from the photo | Paid tier (see step 4) | A few cents/month |
| OpenWeatherMap | Snow forecast | Free | $0 |
| Twilio | Storm texts to customers and staff | Pay as you go | Number about $1–2/month, plus under 1¢ per text |
| Stripe | Card payments | Pay as you go | A percentage + a few cents per payment (see Stripe's Canadian pricing page) |

Total: roughly **$2–7/month** plus texts and Stripe's per-payment fees.

## Where settings go

| Where | Used by | File / place |
|---|---|---|
| Your computer, `npm run dev` | Development | `.env.local` (copy `.env.example`) |
| Your computer, `npm run preview` | Testing the real Cloudflare build | `.dev.vars` (same contents) |
| Live site | Customers | Cloudflare dashboard → Workers → kaiyns → Settings → Variables and Secrets |

Never share the secret values or commit `.env.local` / `.dev.vars` (both are
in `.gitignore`).

---

## 1. PocketBase (on the homelab)

Needs PocketBase **v0.23 or newer** (tested with v0.40.4).

1. **Add the schema:** copy **every file** in `pocketbase/pb_migrations/` into
   your PocketBase's `pb_migrations` folder (next to `pb_data`), then restart
   PocketBase. It applies any it hasn't run yet, in order. They create these
   collections: `staff`, `customers`, `properties`, `subscriptions`, `storms`,
   `visits`, `sms_log` and `driveway_estimates`. Do the same whenever a new
   migration file is added.
2. **Create a superuser just for the website:** PocketBase dashboard →
   **Superusers** → **New**, e.g. `website@kaiyns.ca` with a long random
   password. Don't reuse your own login.
   - `POCKETBASE_SUPERUSER_EMAIL`
   - `POCKETBASE_SUPERUSER_PASSWORD`
3. **Add staff** (you, your partner, workers): **Collections → staff → New
   record**:
   - email and password: what they log in to `/staff` with
   - `full_name`
   - `phone_number` in `+16475551234` format: gets storm alert texts. Leave
     empty for no texts.

   There's no public sign-up for staff. To remove someone, delete their record.
4. **Backups (do this):** **Settings → Backups** → turn on automatic backups,
   and under **S3** point them somewhere off the homelab. Cloudflare R2's free
   tier works. Then a dead disk doesn't take the customer list with it.

## 2. Connect PocketBase to the internet (Cloudflare Tunnel)

The website runs on Cloudflare, so it needs a public HTTPS address for
PocketBase. A tunnel gives it one without opening ports on your router.

1. Add your domain to Cloudflare (free plan) if it isn't already.
2. **Zero Trust → Networks → Tunnels → Create a tunnel** → install
   `cloudflared` on the homelab using the command shown.
3. **Public hostname**: e.g. `db.kaiyns.ca` → service `http://localhost:8090`
   (or wherever PocketBase listens).
4. Set `POCKETBASE_URL=https://db.kaiyns.ca`.

**Recommended: lock it down with Cloudflare Access.** Without this, anyone can
reach the PocketBase dashboard login page. With it, only the website, and you
after logging in with your email, can reach PocketBase.

1. **Zero Trust → Access → Service auth → Service Tokens → Create** a token
   called "kaiyns website". Copy the Client ID and Secret:
   - `CF_ACCESS_CLIENT_ID`
   - `CF_ACCESS_CLIENT_SECRET`
2. **Zero Trust → Access → Applications → Add → Self-hosted** for
   `db.kaiyns.ca` with two policies:
   - Action **Service Auth**, include that service token (for the website)
   - Action **Allow**, include your and your partner's emails (for the
     PocketBase dashboard)

## 3. Google Maps (address lookup and satellite photo)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and
   create a project called "Kaiyns".
2. **Billing**: add a billing account. A card is required even though we stay
   inside the free allowance.
3. **APIs & Services → Library**: enable **Geocoding API** and **Maps Static API**.
4. **APIs & Services → Credentials → Create credentials → API key**. Edit the
   key → **API restrictions** → **Restrict key** → tick only those two APIs.
   Save it as `GOOGLE_MAPS_API_KEY`.
5. **Protect against abuse.** Anyone can type addresses into the quote page,
   and each new address costs a lookup (repeats are cached in PocketBase).
   - **Billing → Budgets & alerts**: create a budget (e.g. $10) with email alerts.
   - **APIs & Services → Geocoding API → Quotas**: cap requests per day
     (e.g. 500). Do the same for **Maps Static API**.

## 4. Gemini (driveway size)

1. Go to [aistudio.google.com](https://aistudio.google.com) → **Get API key**
   → create it in the same "Kaiyns" Google project.
2. Save it as `GEMINI_API_KEY`. The model is set by `GEMINI_MODEL`
   (default `gemini-2.5-flash`).
3. Turn on billing for the key (the paid tier). On the free tier, Google may
   use what we send (photos of customers' homes) to improve its products, and
   usage limits are lower. At our volume the paid tier costs pennies.

## 5. Put the site online (Cloudflare Workers)

Cloudflare runs Next.js sites on **Workers** (Pages is for plain static
sites). The adapter is `@opennextjs/cloudflare`; config is in `wrangler.jsonc`
and `open-next.config.ts`.

1. On your computer: `npx wrangler login` (opens the browser once).
2. Deploy: `npm run deploy`. This creates a Worker called `kaiyns`.
   - To deploy automatically on every `git push` instead: **Workers & Pages →
     kaiyns → Settings → Build** → connect the GitHub repo, with build command
     `npx opennextjs-cloudflare build` and deploy command
     `npx opennextjs-cloudflare deploy`.
3. **Settings → Variables and Secrets**: add every value from `.env.example`
   as a **Secret**, with these for the live site:
   - `SITE_URL`: the real address, e.g. `https://kaiyns.ca` (no slash at the
     end). Texts link to it, and the Twilio security check depends on it
     being exact.
   - `CRON_SECRET`: a long random string. Make one with `openssl rand -hex 32`.
4. **Settings → Domains & Routes → Add → Custom domain**: `kaiyns.ca`.

The daily storm check runs automatically at 21:00 UTC (5pm Toronto in summer,
4pm in winter), set by `triggers` in `wrangler.jsonc`.

**Free vs. Paid plan:** the site's code is 1.2 MiB compressed, under the free
plan's 3 MiB limit. The free plan also allows only 10 ms of CPU per request,
which Next.js pages can exceed. If pages fail with **Error 1102** or "Exceeded
CPU limit" in **Workers → kaiyns → Logs**, switch to **Workers Paid**
(US$5/month).

## 6. OpenWeatherMap (snow forecast)

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

## 7. Twilio (texts)

Do this after step 5, because Twilio needs the live web address.

1. Sign up at [twilio.com](https://www.twilio.com). Trial accounts can only
   text numbers you've verified, so **upgrade** by adding about $20 of credit.
2. **Phone Numbers → Buy a number**: choose **Canada**, search for 647 or 416,
   and make sure **SMS** is ticked. Twilio may ask us to register the business
   for messaging. Follow its prompts, and start early since approval can take
   a few days.
3. From the Twilio console home page, copy these into Cloudflare:
   - Account SID → `TWILIO_ACCOUNT_SID`
   - Auth Token → `TWILIO_AUTH_TOKEN`
   - The number, as `+1647…` → `TWILIO_FROM_NUMBER`
4. **Phone Numbers → Manage → Active numbers** → click the number →
   **Messaging configuration** → "A message comes in":
   - **Webhook**, URL `https://kaiyns.ca/api/twilio/sms`, **HTTP POST**
   - Save.

Twilio handles STOP/START replies by itself, and the site also records STOP so
that customer isn't offered visits again.

## 8. Stripe (payments)

How customers pay:

| Plan | At signup | After that |
|---|---|---|
| One Storm | Card saved on Stripe's page, **nothing charged** | $50 charged automatically when staff press **Mark done** |
| Monthly | $300 | $300 every month until `SEASON_END_DATE`, then it stops |
| Full Season | $1,000 | Nothing; the plan ends after `SEASON_END_DATE` |

A plan only becomes active (and gets booked on storm days) once Stripe
confirms payment. Until then it shows as `pending` in PocketBase.

1. Sign up at [stripe.com](https://stripe.com) and activate your account for
   Canada. Everything below works in **test mode** first (toggle at the top of
   the dashboard), so you can try it with fake cards before taking real money.
2. **Developers → API keys**: copy the **Secret key** (`sk_test_…` in test
   mode) → `STRIPE_SECRET_KEY`.
3. **Developers → Webhooks → Add endpoint**:
   - URL: `https://kaiyns.ca/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`,
     `customer.subscription.deleted`
   - Copy the endpoint's **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`
4. Set `SEASON_END_DATE` (e.g. `2027-04-30`) and **update it every year**
   before the next season's signups.
5. **Settings → Business → Customer emails**: turn on receipts for successful
   payments, if you'd like customers to get emailed receipts.

**Going live:** switch the dashboard to live mode, create a new webhook
endpoint there (live and test webhooks are separate), and replace both Stripe
secrets in Cloudflare with the live `sk_live_…` and live `whsec_…` values.

**Everyday tasks in the Stripe dashboard:**
- **Cancel a Monthly plan:** Customers → the customer → their subscription →
  Cancel. The site sees this and ends the plan.
- **Refunds:** Payments → the payment → Refund. Changing a customer from
  Monthly to Full Season cancels the Monthly subscription but doesn't refund
  the current month automatically; refund it here if you want to.
- **Declined One Storm cards:** shown in red on the staff visit list with the
  reason and a **Try charging $50 again** button.

## 9. Test everything with your own phone

1. On the live site, enter your address and check the quote page shows a
   driveway size.
2. With Stripe in **test mode**, sign up as a **One Storm** customer with your
   own phone number, tick "Text me when snow is coming", and on Stripe's page
   use the test card `4242 4242 4242 4242` (any future date, any CVC).
   Check PocketBase: your plan should change from `pending` to `active`
   within a few seconds.
3. Log in at `/staff` → **Start a storm day** for tomorrow.
4. You should get:
   - the offer text ("Snow is on the way… Reply YES to book")
   - the staff summary text (if your staff record has a phone number)
5. Reply **YES**. You should get a confirmation, and your house should move to
   **To shovel** on the staff page.
6. Press **Mark done**. It should show **Paid $50 ✓**, and the payment should
   appear in Stripe → Payments. To test a decline, sign up another test
   customer with card `4000 0000 0000 0341` (saves fine, declines when charged).
7. Clean up in PocketBase: delete the test record in `storms` (its visits go
   with it), then your test customer in `customers`.

If something doesn't work, check **Cloudflare → Workers → kaiyns → Logs** for
the error message.

---

## Local development

- `npm run dev`: fast development server, reads `.env.local`.
- `npm run preview`: builds the real Cloudflare version and runs it locally,
  reads `.dev.vars`. Use this before deploying big changes.

Note: `POCKETBASE_URL` in `.env.example` defaults to `http://127.0.0.1:8090`.
If you have an SSH tunnel to the homelab on that port, local development will
use **real customer data**. Point it at a separate test PocketBase instead.

## Upgrading Next.js

Cloudflare's adapter (`@opennextjs/cloudflare`) usually supports a new Next.js
version a little after it's released. Before bumping `next`, check that the
adapter's supported range (`npm view @opennextjs/cloudflare peerDependencies`)
includes it, then run `npm run preview` and click through the site.
