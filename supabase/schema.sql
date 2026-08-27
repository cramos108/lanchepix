-- Pix da Confiança — schema Supabase (PostgreSQL)
-- Cole e execute no SQL Editor: https://supabase.com/dashboard/project/kvkjidfwkugjhxddpiam/sql
-- Este app é offline-first: o celular grava no IndexedDB e sincroniza aqui quando houver internet.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  category text not null default 'Salgados',
  stock integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  status text not null check (status in ('pending', 'paid', 'cancelled')),
  customer_phone text,
  customer_name text,
  notes text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null,
  phone text not null,
  name text not null default '',
  stamps integer not null default 0 check (stamps >= 0),
  total_stamps integer not null default 0,
  rewards_claimed integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vendor_id, phone)
);

create table if not exists public.settings (
  vendor_id uuid primary key,
  store_name text not null default 'Meu Lanche',
  pix_key text not null default '',
  merchant_name text not null default '',
  merchant_city text not null default '',
  whatsapp text not null default '',
  reward_label text not null default '1 lanche grátis',
  stamps_required integer not null default 10,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------

create index if not exists products_vendor_idx on public.products (vendor_id, updated_at desc);
create index if not exists products_vendor_active_idx on public.products (vendor_id, active) where deleted_at is null;
create index if not exists sales_vendor_status_idx on public.sales (vendor_id, status, created_at desc);
create index if not exists sales_vendor_updated_idx on public.sales (vendor_id, updated_at desc);
create index if not exists customers_vendor_phone_idx on public.customers (vendor_id, phone);

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------

create or replace function public.lanchepix_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
for each row execute function public.lanchepix_touch_updated_at();

drop trigger if exists sales_touch on public.sales;
create trigger sales_touch before update on public.sales
for each row execute function public.lanchepix_touch_updated_at();

drop trigger if exists customers_touch on public.customers;
create trigger customers_touch before update on public.customers
for each row execute function public.lanchepix_touch_updated_at();

drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings
for each row execute function public.lanchepix_touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- O app usa a chave anon/publishable e um vendor_id gerado no aparelho.
-- Políticas abertas para anon: qualquer pessoa com a chave pública pode ler/escrever.
-- Para produção com vários vendedores, troque por autenticação (auth.uid()).

alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.customers enable row level security;
alter table public.settings enable row level security;

drop policy if exists "lanchepix_products_anon" on public.products;
create policy "lanchepix_products_anon" on public.products
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "lanchepix_sales_anon" on public.sales;
create policy "lanchepix_sales_anon" on public.sales
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "lanchepix_customers_anon" on public.customers;
create policy "lanchepix_customers_anon" on public.customers
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "lanchepix_settings_anon" on public.settings;
create policy "lanchepix_settings_anon" on public.settings
  for all to anon, authenticated using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.products, public.sales, public.customers, public.settings
  to anon, authenticated;
