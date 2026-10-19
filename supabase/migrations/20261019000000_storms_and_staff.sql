-- Storm days, the visits list, staff accounts and SMS consent.

-- Canada's anti-spam law (CASL) needs express consent before we text offers.
alter table public.customers
  add column sms_opt_in boolean not null default false,
  add column sms_opt_in_at timestamptz;

-- Staff accounts. Create the login in Supabase (Authentication > Users >
-- Add user), then add a row here, e.g.:
--   insert into public.staff (user_id, full_name, phone_number)
--   values ('<auth user id>', 'Your Name', '+16475551234');
-- phone_number receives storm alert texts (leave null to opt out).
create table public.staff (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  full_name    text not null,
  phone_number text,
  created_at   timestamptz not null default now()
);

-- One row per day we go out shovelling.
create table public.storms (
  id                  uuid primary key default gen_random_uuid(),
  service_date        date not null unique,
  expected_snow_mm    numeric(6, 1),
  source              text not null check (source in ('forecast', 'manual')),
  workers_notified_at timestamptz,
  created_at          timestamptz not null default now()
);

-- offered: one-time customer was texted, no reply yet
-- booked:  on the list to shovel (subscribers are booked automatically)
create type public.visit_status as enum ('offered', 'booked', 'done', 'skipped');

create table public.visits (
  id              uuid primary key default gen_random_uuid(),
  storm_id        uuid not null references public.storms (id) on delete cascade,
  property_id     uuid not null references public.properties (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  status          public.visit_status not null,
  price           numeric(10, 2),
  offer_sent_at   timestamptz,
  booked_at       timestamptz,
  completed_at    timestamptz,
  completed_by    uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (storm_id, property_id)
);

create index visits_storm_status_idx on public.visits (storm_id, status);

-- Row Level Security: signed-in staff can read everything and update visits.
-- Everything else (signup, storm creation, SMS webhooks) uses the secret key.
create function public.is_staff() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.staff where user_id = (select auth.uid()));
$$;

alter table public.staff enable row level security;
alter table public.storms enable row level security;
alter table public.visits enable row level security;

create policy "Staff can see their own staff row" on public.staff
  for select to authenticated using (user_id = (select auth.uid()));

create policy "Staff can read customers" on public.customers
  for select to authenticated using ((select public.is_staff()));
create policy "Staff can read properties" on public.properties
  for select to authenticated using ((select public.is_staff()));
create policy "Staff can read subscriptions" on public.subscriptions
  for select to authenticated using ((select public.is_staff()));
create policy "Staff can read storms" on public.storms
  for select to authenticated using ((select public.is_staff()));
create policy "Staff can read visits" on public.visits
  for select to authenticated using ((select public.is_staff()));
create policy "Staff can update visits" on public.visits
  for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));
