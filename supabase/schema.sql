-- Walkthrough database for Supabase.
-- Run this whole file once in your Supabase project: SQL Editor > New query > paste > Run.
-- It is safe to run again; it skips what already exists.

create extension if not exists pgcrypto;

-- One row per gallery. The public site reads its name, contacts and current exhibition from here.
create table if not exists public.galleries (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  city text,
  address text,
  whatsapp text,
  email text,
  instagram text,
  exhibition_title text,
  exhibition_dates text,
  exhibition_lede text,
  updated_at timestamptz not null default now()
);

-- Which logins can manage which gallery.
create table if not exists public.members (
  user_id uuid not null references auth.users (id) on delete cascade,
  gallery text not null references public.galleries (slug) on delete cascade,
  primary key (user_id, gallery)
);

create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  gallery text not null references public.galleries (slug) on delete cascade,
  title text not null,
  artist text not null default '',
  year text,
  medium text,
  width_cm numeric not null default 60 check (width_cm > 0),
  height_cm numeric not null default 80 check (height_cm > 0),
  price_inr numeric check (price_inr is null or price_inr >= 0),
  status text not null default 'available' check (status in ('available', 'reserved', 'sold')),
  image_url text,
  thumb_url text,
  description text,
  is_public boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists works_gallery_idx on public.works (gallery, sort_order, created_at);

-- Private viewings: a link that shows chosen works to one collector or group.
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  gallery text not null references public.galleries (slug) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  for_name text,
  message text,
  expires date,
  created_at timestamptz not null default now()
);

create table if not exists public.room_works (
  room_id uuid not null references public.rooms (id) on delete cascade,
  work_id uuid not null references public.works (id) on delete cascade,
  primary key (room_id, work_id)
);

-- What visitors do: a viewing opened, a work looked at, an enquiry started.
create table if not exists public.events (
  id bigint generated always as identity primary key,
  gallery text not null references public.galleries (slug) on delete cascade,
  room_id uuid references public.rooms (id) on delete set null,
  work_id uuid references public.works (id) on delete cascade,
  kind text not null check (kind in ('room_open', 'work_view', 'enquire')),
  created_at timestamptz not null default now()
);
create index if not exists events_gallery_idx on public.events (gallery, created_at);

-- ---------- Who may do what ----------

create or replace function public.is_member(g text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where gallery = g and user_id = auth.uid());
$$;

alter table public.galleries enable row level security;
alter table public.members enable row level security;
alter table public.works enable row level security;
alter table public.rooms enable row level security;
alter table public.room_works enable row level security;
alter table public.events enable row level security;

drop policy if exists "anyone reads galleries" on public.galleries;
create policy "anyone reads galleries" on public.galleries for select using (true);
drop policy if exists "members update their gallery" on public.galleries;
create policy "members update their gallery" on public.galleries for update
  using (public.is_member(slug)) with check (public.is_member(slug));

drop policy if exists "people read their own memberships" on public.members;
create policy "people read their own memberships" on public.members for select using (user_id = auth.uid());

-- Visitors see public works only. Private works are reachable only through open_room().
drop policy if exists "read public works or own gallery" on public.works;
create policy "read public works or own gallery" on public.works for select
  using (is_public or public.is_member(gallery));
drop policy if exists "members add works" on public.works;
create policy "members add works" on public.works for insert with check (public.is_member(gallery));
drop policy if exists "members edit works" on public.works;
create policy "members edit works" on public.works for update
  using (public.is_member(gallery)) with check (public.is_member(gallery));
drop policy if exists "members delete works" on public.works;
create policy "members delete works" on public.works for delete using (public.is_member(gallery));

drop policy if exists "members manage rooms" on public.rooms;
create policy "members manage rooms" on public.rooms for all
  using (public.is_member(gallery)) with check (public.is_member(gallery));

drop policy if exists "members manage room works" on public.room_works;
create policy "members manage room works" on public.room_works for all
  using (exists (select 1 from public.rooms r where r.id = room_id and public.is_member(r.gallery)))
  with check (exists (select 1 from public.rooms r where r.id = room_id and public.is_member(r.gallery)));

drop policy if exists "members read activity" on public.events;
create policy "members read activity" on public.events for select using (public.is_member(gallery));

-- ---------- Functions the public site calls ----------

-- Open a private viewing by the name in its link. Returns its works only while it is open.
create or replace function public.open_room(room_slug text)
returns json language plpgsql security definer set search_path = public as $$
declare
  r public.rooms;
  result json;
begin
  select * into r from public.rooms where slug = lower(trim(room_slug));
  if not found then
    return json_build_object('state', 'missing');
  end if;
  if r.expires is not null and r.expires < (now() at time zone 'Asia/Kolkata')::date then
    return json_build_object('state', 'closed', 'room', json_build_object('title', r.title, 'expires', r.expires));
  end if;
  insert into public.events (gallery, room_id, kind) values (r.gallery, r.id, 'room_open');
  select json_build_object(
    'state', 'open',
    'room', json_build_object('slug', r.slug, 'title', r.title, 'for', r.for_name,
                              'message', r.message, 'expires', r.expires, 'gallery', r.gallery),
    'works', coalesce(json_agg(w order by w.sort_order, w.created_at), '[]'::json))
  into result
  from public.room_works rw join public.works w on w.id = rw.work_id
  where rw.room_id = r.id;
  return result;
end;
$$;

-- Record that a visitor looked at a work or started an enquiry.
create or replace function public.log_event(gallery_slug text, work uuid, event_kind text, room_slug text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  rid uuid;
begin
  if event_kind not in ('work_view', 'enquire') then return; end if;
  if not exists (select 1 from public.works where id = work and gallery = gallery_slug) then return; end if;
  if room_slug is not null then
    select id into rid from public.rooms where slug = lower(trim(room_slug)) and gallery = gallery_slug;
  end if;
  insert into public.events (gallery, room_id, work_id, kind) values (gallery_slug, rid, work, event_kind);
end;
$$;

-- ---------- Functions the admin dashboard calls (members only, through the rules above) ----------

create or replace function public.work_stats(gallery_slug text, days integer default 30)
returns table (work_id uuid, views bigint, enquiries bigint)
language sql stable security invoker set search_path = public as $$
  select e.work_id,
         count(*) filter (where e.kind = 'work_view'),
         count(*) filter (where e.kind = 'enquire')
  from public.events e
  where e.gallery = gallery_slug and e.work_id is not null
    and e.created_at > now() - make_interval(days => days)
  group by e.work_id;
$$;

create or replace function public.room_stats(gallery_slug text)
returns table (room_id uuid, opens bigint, enquiries bigint, last_open timestamptz)
language sql stable security invoker set search_path = public as $$
  select e.room_id,
         count(*) filter (where e.kind = 'room_open'),
         count(*) filter (where e.kind = 'enquire'),
         max(e.created_at) filter (where e.kind = 'room_open')
  from public.events e
  where e.gallery = gallery_slug and e.room_id is not null
  group by e.room_id;
$$;

revoke all on function public.open_room(text) from public;
revoke all on function public.log_event(text, uuid, text, text) from public;
grant execute on function public.open_room(text) to anon, authenticated;
grant execute on function public.log_event(text, uuid, text, text) to anon, authenticated;
grant execute on function public.work_stats(text, integer) to authenticated;
grant execute on function public.room_stats(text) to authenticated;
grant execute on function public.is_member(text) to anon, authenticated;

-- ---------- Photos ----------
-- Photos live in a public bucket under <gallery>/<file>. File names are random, so a
-- private work's photo can only be found through its viewing.

insert into storage.buckets (id, name, public)
values ('artworks', 'artworks', true)
on conflict (id) do nothing;

drop policy if exists "members upload photos" on storage.objects;
create policy "members upload photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'artworks' and public.is_member((storage.foldername(name))[1]));
drop policy if exists "members replace photos" on storage.objects;
create policy "members replace photos" on storage.objects for update to authenticated
  using (bucket_id = 'artworks' and public.is_member((storage.foldername(name))[1]));
drop policy if exists "members delete photos" on storage.objects;
create policy "members delete photos" on storage.objects for delete to authenticated
  using (bucket_id = 'artworks' and public.is_member((storage.foldername(name))[1]));
