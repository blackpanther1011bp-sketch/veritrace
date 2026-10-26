-- VeriTrace : schéma initial (appliqué sur le projet Supabase « veritrace »)

-- Marques
create table public.brands (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name text not null,
  kind text not null check (kind in ('fast_fashion', 'responsable', 'seconde_main')),
  country text not null,
  social_checks jsonb not null default '[]'::jsonb,
  is_sample boolean not null default true
);

-- Produits, indexés par code-barres (GTIN/EAN)
create table public.products (
  ean text primary key check (ean ~ '^[0-9]{8,14}$'),
  brand_id text not null references public.brands(id),
  name text not null,
  category text not null,
  origin_country text not null,
  composition text not null,
  transport text not null,
  carbon_grade text not null check (carbon_grade in ('A','B','C','D','E')),
  social_grade text not null check (social_grade in ('A','B','C','D','E')),
  global_grade text not null check (global_grade in ('A','B','C','D','E')),
  carbon_breakdown jsonb not null default '[]'::jsonb,
  is_sample boolean not null default true,
  created_at timestamptz not null default now()
);
create index products_brand_idx on public.products (brand_id);
create index products_category_grade_idx on public.products (category, global_grade);

-- Signalements de produits introuvables (écriture seule depuis l'app)
create table public.product_reports (
  id uuid primary key default gen_random_uuid(),
  ean text not null check (ean ~ '^[0-9]{8,14}$'),
  brand text check (brand is null or char_length(brand) <= 80),
  created_at timestamptz not null default now()
);

-- Événements d'usage (taux d'abandon, conversion Premium)
create table public.events (
  id bigint generated always as identity primary key,
  session_id uuid not null,
  event text not null check (event in (
    'scan', 'product_view', 'not_found', 'details_view', 'alternatives_view',
    'premium_view', 'premium_start', 'report_sent', 'exit_after_bad_grade'
  )),
  ean text check (ean is null or ean ~ '^[0-9]{8,14}$'),
  grade text check (grade is null or grade in ('A','B','C','D','E')),
  created_at timestamptz not null default now()
);
create index events_event_created_idx on public.events (event, created_at);

-- Sécurité : lecture publique du catalogue, écriture limitée aux signalements et événements
alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.product_reports enable row level security;
alter table public.events enable row level security;

create policy "Catalogue des marques lisible par tous"
  on public.brands for select to anon, authenticated using (true);

create policy "Catalogue des produits lisible par tous"
  on public.products for select to anon, authenticated using (true);

create policy "Signalement d'un code-barres valide"
  on public.product_reports for insert to anon, authenticated
  with check (ean ~ '^[0-9]{8,14}$');

create policy "Enregistrement d'un événement valide"
  on public.events for insert to anon, authenticated
  with check (session_id is not null);
