-- Kaiyns initial schema.
-- Apply with `supabase db push`, or paste into the Supabase SQL editor.

create type public.driveway_size as enum ('small', 'medium', 'large');
create type public.plan_type as enum ('one_time', 'monthly', 'full_season');
create type public.subscription_status as enum ('active', 'paused', 'expired');

create table public.customers (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null check (length(trim(full_name)) > 0),
  phone_number text not null unique,  -- stored as E.164, e.g. +14165551234
  address      text not null,         -- mailing / billing address
  created_at   timestamptz not null default now()
);

create table public.properties (
  id                      uuid primary key default gen_random_uuid(),
  customer_id             uuid not null references public.customers (id) on delete cascade,
  street_address          text not null,
  driveway_size_category  public.driveway_size,
  estimated_square_feet   integer check (estimated_square_feet > 0),
  created_at              timestamptz not null default now()
);

create index properties_customer_id_idx on public.properties (customer_id);

create table public.subscriptions (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers (id) on delete cascade,
  property_id   uuid references public.properties (id) on delete set null,
  plan_type     public.plan_type not null,
  status        public.subscription_status not null default 'active',
  quote_amount  numeric(10, 2) not null check (quote_amount >= 0),
  start_date    date not null default current_date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index subscriptions_customer_id_idx on public.subscriptions (customer_id);

-- A customer has at most one active plan per property. Upgrading or
-- downgrading expires the old row and inserts a new one, which preserves
-- plan history.
create unique index subscriptions_one_active_per_property
  on public.subscriptions (customer_id, property_id)
  where status = 'active';

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Row Level Security: enabled with no policies, so the public publishable key
-- can neither read nor write these tables. All reads and writes go through
-- server code (Server Actions / Route Handlers) that uses the secret key.
-- Add policies here later if customers or workers get logins.
alter table public.customers enable row level security;
alter table public.properties enable row level security;
alter table public.subscriptions enable row level security;
