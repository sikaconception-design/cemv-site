-- ============================================================
-- CEMV — Configuration Supabase v3 (Équipe, Partenaires, Publications, Documents)
-- À exécuter en plus des scripts v2 précédents (ne les remplace pas).
-- ============================================================

create table if not exists team (
  id bigint generated always as identity primary key,
  sort_order int not null default 0,
  name text not null,
  role text not null,
  photo text,
  bio text,
  created_at timestamptz not null default now()
);

create table if not exists partners (
  id bigint generated always as identity primary key,
  sort_order int not null default 0,
  name text not null,
  logo text,
  website text,
  created_at timestamptz not null default now()
);

create table if not exists publications (
  id bigint generated always as identity primary key,
  sort_order int not null default 0,
  title text not null,
  authors text,
  source text,
  year text,
  file_url text,
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id bigint generated always as identity primary key,
  sort_order int not null default 0,
  title text not null,
  file_url text not null,
  created_at timestamptz not null default now()
);

alter table team enable row level security;
alter table partners enable row level security;
alter table publications enable row level security;
alter table documents enable row level security;

-- Lecture publique pour tout le monde, écriture réservée à l'administrateur
-- (ces sections sont plus "officielles" : seul admin écrit, pas le rôle chercheur)
drop policy if exists "team_read_all" on team;
create policy "team_read_all" on team for select using (true);
drop policy if exists "team_write_admin" on team;
create policy "team_write_admin" on team for all
  using (current_user_role() = 'admin') with check (current_user_role() = 'admin');

drop policy if exists "partners_read_all" on partners;
create policy "partners_read_all" on partners for select using (true);
drop policy if exists "partners_write_admin" on partners;
create policy "partners_write_admin" on partners for all
  using (current_user_role() = 'admin') with check (current_user_role() = 'admin');

drop policy if exists "publications_read_all" on publications;
create policy "publications_read_all" on publications for select using (true);
drop policy if exists "publications_write_admin" on publications;
create policy "publications_write_admin" on publications for all
  using (current_user_role() = 'admin') with check (current_user_role() = 'admin');

drop policy if exists "documents_read_all" on documents;
create policy "documents_read_all" on documents for select using (true);
drop policy if exists "documents_write_admin" on documents;
create policy "documents_write_admin" on documents for all
  using (current_user_role() = 'admin') with check (current_user_role() = 'admin');
