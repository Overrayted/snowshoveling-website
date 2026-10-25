# Kaiyns setup guide

How to put the site online and connect every service it uses, start to finish.
Do the steps **in order**: some need something from an earlier step (for
example, Twilio and Stripe need the live web address from step 7).

Prices below were checked in October 2026 and can change, so confirm them on
each provider's pricing page.

## How it fits together

| Address | What it is | Runs on |
|---|---|---|
| `https://kaiyns.com` | The website customers use, plus `/staff` for you | Cloudflare Workers |
| `https://api.kaiyns.com` | PocketBase: database and staff logins | Your homelab, through a Cloudflare Tunnel |
| `https://api.kaiyns.com/_/` | PocketBase dashboard (only for you) | Your homelab |

```
Customers' browsers ──► kaiyns.com on Cloudflare Workers (always up)
Twilio (texts) ───────►        │
Stripe (payments) ────►        │  website signs in to PocketBase
Daily storm check ────►        ▼
                     api.kaiyns.com → Tunnel → PocketBase on the homelab
```

Customers never talk to PocketBase directly. Only the website does.

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
| Cloudflare Workers | Hosts the website, runs the daily storm check | Free (Paid if needed, see step 7) | $0 (or US$5/month) |
| PocketBase | Database and staff logins | Your homelab | $0 |
| Cloudflare Tunnel + Access | Connects the website to the homelab securely | Free | $0 |
| Google Maps | Finds the address, takes the satellite photo | Free up to 10,000 of each per month | $0 at our size |
| Gemini | Estimates driveway size from the photo | Paid tier (see step 4) | A few cents/month |
| OpenWeatherMap | Snow forecast | Free | $0 |
| Twilio | Storm texts to customers and staff | Pay as you go | Number about $1–2/month, plus under 1¢ per text |
| Stripe | Card payments | Pay as you go | A percentage + a few cents per payment (see Stripe's Canadian pricing page) |

Total: roughly **$2–7/month** plus texts and Stripe's per-payment fees.

---

## Checklist

- [ ] 0. Get the code onto your computer
- [ ] 1. PocketBase: log in, add the tables, create the website's login, add staff, backups
- [ ] 2. Lock PocketBase down with Cloudflare Access
- [ ] 3. Google Maps key
- [ ] 4. Gemini key
- [ ] 5. OpenWeatherMap key
- [ ] 6. Stripe secret key (test mode)
- [ ] 7. Put the site online at kaiyns.com and upload all the keys
- [ ] 8. Twilio: buy a number and point it at the site
- [ ] 9. Stripe: point payment notifications at the site
- [ ] 10. Test everything with your own phone

### Keep your keys in one file while you work

Steps 1–6 each give you a key or password. Collect them in a file called
`.env.live` in the project folder, so you can upload them all at once in
step 7:

```sh
cp .env.example .env.live
```

Fill in each value as you go. `.env.live` is ignored by git (never commit it),
and Next.js doesn't read it, so it can't leak into the build. After step 7,
save it in a password manager and delete it from your computer.

---

## 0. Get the code onto your computer

You need [Node.js](https://nodejs.org) 20 or newer (`node -v` to check) and git.

```sh
git clone https://github.com/Overrayted/kaiyns.git
cd kaiyns
npm install
```

Already have the folder? Run `git pull` and `npm install` instead.

## 1. PocketBase (on the homelab)

Yours is already online: `https://api.kaiyns.com/api/health` should say
"API is healthy". Needs PocketBase **v0.23 or newer** (tested with v0.40.4).

### Can't log in to the dashboard?

The dashboard is at `https://api.kaiyns.com/_/` and takes a **superuser**
email and password. If you've forgotten it or never made one, set it from the
homelab's terminal. This creates the account, or resets its password if it
exists:

```sh
# PocketBase installed directly (run it in the folder with the pocketbase file)
./pocketbase superuser upsert you@example.com 'a-new-long-password'

# PocketBase in Docker (find the container name with `docker ps`)
docker exec -it <container> pocketbase superuser upsert you@example.com 'a-new-long-password'
```

Then log in at `https://api.kaiyns.com/_/`. No restart is needed.

If it still says the login is wrong:
- **Same data folder:** the command must use the same `pb_data` folder as the
  running PocketBase. If PocketBase is started with `--dir /some/path`, add
  the same `--dir /some/path` to the command. In Docker, this is usually
  already right when you use `docker exec`. If the binary isn't on the path
  inside the container, `docker exec -it <container> ls /` will help find it
  (often `/usr/local/bin/pocketbase` or `/pb/pocketbase`).
- **Too many attempts:** PocketBase pauses logins after repeated failures.
  Wait a few minutes and try again.
- **Check which PocketBase you're reaching:** `docker logs <container>` (or the
  terminal PocketBase runs in) shows each request. If your login attempt
  doesn't appear, the tunnel points somewhere else (see step 2).

### Set it up

1. **Add the tables:** copy **every file** in this project's
   `pocketbase/pb_migrations/` folder into your PocketBase's `pb_migrations`
   folder (it sits next to `pb_data`; create it if it's missing, and in Docker
   use the folder mounted into the container). Restart PocketBase. It applies
   any it hasn't run yet, in order. You should then see these collections:
   `staff`, `customers`, `properties`, `subscriptions`, `storms`, `visits`,
   `sms_log` and `driveway_estimates`. Do the same whenever a new migration
   file is added to the project.
2. **Create a separate superuser just for the website:** dashboard →
   **System → Superusers → New**, e.g. `website@kaiyns.com` with a long random
   password (`openssl rand -hex 24` makes one). Don't reuse your own login.
   Put them in `.env.live`:
   - `POCKETBASE_URL=https://api.kaiyns.com`
   - `POCKETBASE_SUPERUSER_EMAIL=website@kaiyns.com`
   - `POCKETBASE_SUPERUSER_PASSWORD=` the password
3. **Add staff** (you, your partner, workers): **Collections → staff → New
   record**:
   - email and password: what they log in to `kaiyns.com/staff` with
   - `full_name`
   - `phone_number` in `+16475551234` format: gets storm alert texts. Leave
     empty for no texts.

   There's no public sign-up for staff. To remove someone, delete their record.
4. **Backups (do this):** **Settings → Backups** → turn on automatic backups,
   and under **S3** point them somewhere off the homelab. Cloudflare R2's free
   tier works. Then a dead disk doesn't take the customer list with it.

## 2. Lock PocketBase down (Cloudflare Access)

`api.kaiyns.com` already goes through Cloudflare (likely a Tunnel). Check
under **Cloudflare dashboard → Zero Trust → Networks → Tunnels**: there should
be a tunnel with public hostname `api.kaiyns.com` → `http://localhost:8090`
(or wherever PocketBase listens). If there isn't one, create it there and
install `cloudflared` on the homelab using the command it shows.

Right now anyone can find the dashboard login page. Cloudflare Access puts a
second lock in front: the website gets in with a service token, and you get in
by entering a code sent to your email.

1. **Zero Trust → Access → Service auth → Service Tokens → Create** a token
   called "kaiyns website", duration **Non-expiring**. Copy the Client ID and
   Secret into `.env.live` (the secret is shown only once):
   - `CF_ACCESS_CLIENT_ID`
   - `CF_ACCESS_CLIENT_SECRET`
2. **Zero Trust → Access → Applications → Add → Self-hosted**, domain
   `api.kaiyns.com`, with two policies:
   - Action **Service Auth**, include that service token (for the website)
   - Action **Allow**, include your and your partner's emails (for the
     dashboard)

Do this **before** step 7's upload, or straight after it with those two values
added: once Access is on, the website can only reach PocketBase if it has the
token. Afterwards, opening `https://api.kaiyns.com/_/` asks for your email
first, then PocketBase's own login.

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
2. Save it as `GEMINI_API_KEY`. Leave `GEMINI_MODEL=gemini-2.5-flash`.
3. Turn on billing for the key (the paid tier). On the free tier, Google may
   use what we send (photos of customers' homes) to improve its products, and
   usage limits are lower. At our volume the paid tier costs pennies.

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

## 6. Stripe keys (payments)

How customers pay:

| Plan | At signup | After that |
|---|---|---|
| One Time | Card saved on Stripe's page, **nothing charged** | $50 charged automatically when staff press **Mark done** |
| Monthly | $300 | $300 every month until `SEASON_END_DATE`, then it stops |
| Full Season | $1,000 | Nothing; the plan ends after `SEASON_END_DATE` |

A plan only becomes active (and gets booked on storm days) once Stripe
confirms payment. Until then it shows as `pending` in PocketBase.

1. Sign up at [stripe.com](https://stripe.com) and activate your account for
   Canada. Start in **test mode** (toggle at the top of the dashboard) so you
   can try everything with fake cards before taking real money.
2. **Developers → API keys**: copy the **Secret key** (`sk_test_…`) →
   `STRIPE_SECRET_KEY`.
3. Set `SEASON_END_DATE` to your last day of service, e.g. `2027-04-30`, and
   **update it every year** before the next season's signups.
4. Leave `STRIPE_WEBHOOK_SECRET` empty for now; you get it in step 9.

## 7. Put the site online (Cloudflare Workers)

Cloudflare runs Next.js sites on **Workers** (Pages is for plain static
sites). The adapter is `@opennextjs/cloudflare`; config is in `wrangler.jsonc`
and `open-next.config.ts`.

1. **Finish `.env.live`** with these two:
   - `SITE_URL=https://kaiyns.com` (exactly this, no slash at the end). Texts
     link to it, and the Twilio security check depends on it being exact.
   - `CRON_SECRET=` a long random string from `openssl rand -hex 32`.

   Leave the Twilio and `STRIPE_WEBHOOK_SECRET` lines empty for now.
2. **Log in to Cloudflare** from the project folder: `npx wrangler login`
   (opens the browser once; pick the account that has kaiyns.com).
3. **Deploy:** `npm run deploy`. This builds the site and creates a Worker
   called `kaiyns` at a `….workers.dev` address.
4. **Upload all the keys at once:**

   ```sh
   npx wrangler secret bulk .env.live
   ```

   They appear under **Workers & Pages → kaiyns → Settings → Variables and
   Secrets**. To add or change one later: `npx wrangler secret put NAME`
   (it asks for the value), or edit it in that dashboard page.
5. **Connect the domain:** **Workers & Pages → kaiyns → Settings → Domains &
   Routes → Add → Custom domain** → `kaiyns.com`. Cloudflare creates the DNS
   record and HTTPS certificate itself; give it a few minutes. Optionally add
   `www.kaiyns.com` too, then a **Redirect Rule** (kaiyns.com → Rules) sending
   `www.kaiyns.com/*` to `https://kaiyns.com/${1}`.
6. **Check:** open `https://kaiyns.com` (home page), then
   `https://kaiyns.com/staff` and log in with your staff record from step 1.
   If the staff login says "Can't reach the server", see Troubleshooting.

The daily storm check runs automatically at 21:00 UTC (5pm Toronto in summer,
4pm in winter), set by `triggers` in `wrangler.jsonc`. It's also when storm
texts go out: customers are only texted the day before a storm day, even if
staff add the storm day earlier.

**Deploying changes later:** `npm run deploy` again. Or deploy automatically on
every `git push`: **Workers & Pages → kaiyns → Settings → Build** → connect the
GitHub repo, with build command `npx opennextjs-cloudflare build` and deploy
command `npx opennextjs-cloudflare deploy`. Secrets stay as they are either way.

**Free vs. Paid plan:** the site's code is 1.2 MiB compressed, under the free
plan's 3 MiB limit. The free plan also allows only 10 ms of CPU per request,
which Next.js pages can exceed. If pages fail with **Error 1102** or "Exceeded
CPU limit" in **Workers → kaiyns → Logs**, switch to **Workers Paid**
(US$5/month).

## 8. Twilio (texts)

1. Sign up at [twilio.com](https://www.twilio.com). Trial accounts can only
   text numbers you've verified, so **upgrade** by adding about $20 of credit.
2. **Phone Numbers → Buy a number**: choose **Canada**, search for 647 or 416,
   and make sure **SMS** is ticked. Twilio may ask us to register the business
   for messaging. Follow its prompts, and start early since approval can take
   a few days.
3. From the Twilio console home page, add these to the site, one at a time
   (each asks for the value):

   ```sh
   npx wrangler secret put TWILIO_ACCOUNT_SID   # Account SID, starts with AC
   npx wrangler secret put TWILIO_AUTH_TOKEN    # Auth Token
   npx wrangler secret put TWILIO_FROM_NUMBER   # the number, as +1647…
   ```
4. **Phone Numbers → Manage → Active numbers** → click the number →
   **Messaging configuration** → "A message comes in":
   - **Webhook**, URL `https://kaiyns.com/api/twilio/sms`, **HTTP POST**
   - Save.

**Replies to STOP:** Twilio handles these itself. It blocks the number and texts
back its own confirmation ("You have successfully been unsubscribed… Reply
START to resubscribe"); we can't send our own, because Twilio stops all texts
to that number once they reply STOP. The site also records it so that customer
isn't offered visits again. To change the wording of Twilio's confirmation,
move the number into a **Messaging Service** (Messaging → Services) and edit
its **Opt-Out Management** messages.

## 9. Stripe webhook (payment notifications)

This is how Stripe tells the site a payment went through.

1. Stripe dashboard (still in test mode) → **Developers → Webhooks → Add
   endpoint**:
   - URL: `https://kaiyns.com/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`,
     `customer.subscription.deleted`
2. Copy the endpoint's **Signing secret** (`whsec_…`) and add it:
   `npx wrangler secret put STRIPE_WEBHOOK_SECRET`
3. **Settings → Business → Customer emails**: turn on receipts for successful
   payments, if you'd like customers to get emailed receipts.

**Going live** (after step 10 works): switch the dashboard to live mode, create
a new webhook endpoint there with the same URL and events (live and test
webhooks are separate), then replace both Stripe secrets with the live
`sk_live_…` and live `whsec_…` values using `npx wrangler secret put`.

**Everyday tasks in the Stripe dashboard:**
- **Cancel a Monthly plan:** Customers → the customer → their subscription →
  Cancel. The site sees this and ends the plan.
- **Refunds:** Payments → the payment → Refund. Changing a customer from
  Monthly to Full Season cancels the Monthly subscription but doesn't refund
  the current month automatically; refund it here if you want to.
- **Declined One Time cards:** shown in red on the staff visit list with the
  reason and a **Try charging $50 again** button.

## 10. Test everything with your own phone

1. On `https://kaiyns.com`, enter your address and check the quote page shows
   a driveway size.
2. With Stripe in **test mode**, sign up as a **One Time** customer with your
   own phone number, tick "Text me when snow is coming", and on Stripe's page
   use the test card `4242 4242 4242 4242` (any future date, any CVC).
   Check PocketBase: your plan should change from `pending` to `active`
   within a few seconds.
3. Log in at `kaiyns.com/staff` → **Start a storm day** for tomorrow.
4. You should get:
   - the offer text ("Snow is on the way… Reply YES to book")
   - the staff summary text (if your staff record has a phone number)
5. Reply **YES**. You should get a "You're booked" text, and within about 20
   seconds your house should move to **Confirmed: ready to shovel** on the
   staff page (no need to reload).
6. Press **Mark done**. It should show **Paid $50 ✓**, the payment should
   appear in Stripe → Payments, and you should get a "we've finished
   shovelling your driveway" text. To test a decline, sign up another test
   customer with card `4000 0000 0000 0341` (saves fine, declines when charged).
7. Clean up in PocketBase: delete the test record in `storms` (its visits go
   with it), then your test customer in `customers`.

When it all works, do Stripe's **Going live** steps (step 9).

---

## Every setting, and where it comes from

| Setting | Where you get it | Step |
|---|---|---|
| `POCKETBASE_URL` | `https://api.kaiyns.com` | 1 |
| `POCKETBASE_SUPERUSER_EMAIL` / `_PASSWORD` | The website superuser you create | 1 |
| `CF_ACCESS_CLIENT_ID` / `_SECRET` | Zero Trust → Service Tokens | 2 |
| `GOOGLE_MAPS_API_KEY` | Google Cloud → Credentials | 3 |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Google AI Studio | 4 |
| `OPENWEATHER_API_KEY` | openweathermap.org → API keys | 5 |
| `SERVICE_AREA_LAT` / `_LON`, `SNOW_ALERT_THRESHOLD_MM`, `SERVICE_TIMEZONE` | Your choice (defaults are Toronto, 5 mm) | 5 |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys | 6 |
| `SEASON_END_DATE` | Your last day of service | 6 |
| `SITE_URL` | `https://kaiyns.com` | 7 |
| `CRON_SECRET` | `openssl rand -hex 32` | 7 |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Twilio console | 8 |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks → your endpoint | 9 |

Addresses you give other services:

| Service | Setting there | Value |
|---|---|---|
| Cloudflare Tunnel | Public hostname | `api.kaiyns.com` → `http://localhost:8090` |
| Twilio | Number → "A message comes in" | `https://kaiyns.com/api/twilio/sms` (POST) |
| Stripe | Webhook endpoint | `https://kaiyns.com/api/stripe/webhook` |

## Troubleshooting

Start with **Cloudflare → Workers & Pages → kaiyns → Logs**: most problems show
an error message there.

| Problem | Likely cause |
|---|---|
| Can't log in to `api.kaiyns.com/_/` | See "Can't log in to the dashboard?" in step 1 |
| Staff login says "Can't reach the server", or signups say "call us" | The website can't reach PocketBase: check `POCKETBASE_URL`, the website superuser's email/password, and (if Access is on) the two `CF_ACCESS_…` values and the Service Auth policy |
| Staff login says the email and password didn't match | It uses the **staff** collection record, not your superuser login |
| Plan stays `pending` after paying | Stripe → Webhooks → your endpoint → look at recent deliveries. A 400 means a wrong `STRIPE_WEBHOOK_SECRET`; a 500 means the site couldn't save it (often PocketBase down); Stripe retries |
| Replies to texts get no answer | Twilio → Monitor → Logs → Errors. An "11200" error or a 403 usually means `SITE_URL` isn't exactly `https://kaiyns.com` |
| No storm day when snow was forecast | Check the logs around 21:00 UTC; meanwhile start one by hand on the staff page |
| Error 1102 / "Exceeded CPU limit" | Switch to Workers Paid (step 7) |

---

## Local development

- `npm run dev`: fast development server, reads `.env.local` (copy
  `.env.example`).
- `npm run preview`: builds the real Cloudflare version and runs it locally,
  reads `.dev.vars` (same contents). Use this before deploying big changes.

Note: `POCKETBASE_URL` in `.env.example` defaults to `http://127.0.0.1:8090`.
If you have an SSH tunnel to the homelab on that port, local development will
use **real customer data**. Point it at a separate test PocketBase instead.

## Upgrading Next.js

Cloudflare's adapter (`@opennextjs/cloudflare`) usually supports a new Next.js
version a little after it's released. Before bumping `next`, check that the
adapter's supported range (`npm view @opennextjs/cloudflare peerDependencies`)
includes it, then run `npm run preview` and click through the site.
