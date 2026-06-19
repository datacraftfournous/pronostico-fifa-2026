-- Polla FIFA 2026 - Ejecutar en Supabase SQL Editor

-- Perfiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz default now()
);

-- Partidos
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  home_team text not null,
  away_team text not null,
  stage text not null,
  kickoff_at timestamptz not null,
  home_score int,
  away_score int,
  is_finished boolean default false,
  created_at timestamptz default now()
);

-- Pronósticos
create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  home_score int not null check (home_score >= 0),
  away_score int not null check (away_score >= 0),
  points int default 0,
  updated_at timestamptz default now(),
  unique (user_id, match_id)
);

alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;

-- Función helper: es admin
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Perfiles: leer todos los autenticados (ranking)
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid());

-- Partidos: todos leen; solo admin escribe
drop policy if exists "matches_select" on public.matches;
create policy "matches_select" on public.matches
  for select to authenticated using (true);

drop policy if exists "matches_insert_admin" on public.matches;
create policy "matches_insert_admin" on public.matches
  for insert to authenticated with check (public.is_admin());

drop policy if exists "matches_update_admin" on public.matches;
create policy "matches_update_admin" on public.matches
  for update to authenticated using (public.is_admin());

drop policy if exists "matches_delete_admin" on public.matches;
create policy "matches_delete_admin" on public.matches
  for delete to authenticated using (public.is_admin());

-- Pronósticos: leer todos; insert/update propios si partido no bloqueado
drop policy if exists "predictions_select" on public.predictions;
create policy "predictions_select" on public.predictions
  for select to authenticated using (true);

drop policy if exists "predictions_insert_own" on public.predictions;
create policy "predictions_insert_own" on public.predictions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "predictions_update_own" on public.predictions;
create policy "predictions_update_own" on public.predictions
  for update to authenticated using (user_id = auth.uid());

-- Trigger: crear perfil al registrarse (para registro manual en dashboard)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'user')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Partidos de ejemplo (puedes borrarlos y cargar el calendario real)
insert into public.matches (home_team, away_team, stage, kickoff_at)
select * from (values
  ('Colombia', 'Brasil', 'Grupo C', '2026-06-15 15:00:00-05'),
  ('Argentina', 'México', 'Grupo A', '2026-06-16 18:00:00-05'),
  ('España', 'Francia', 'Grupo B', '2026-06-17 20:00:00-05'),
  ('Estados Unidos', 'Canadá', 'Grupo D', '2026-06-18 16:00:00-05')
) as v(home_team, away_team, stage, kickoff_at)
where not exists (select 1 from public.matches limit 1);
