-- FIVESOM — Home Hero Banner management
-- Run once in the Supabase SQL editor of the FIVESOM project.

create table if not exists public.hero_banners (
  id uuid primary key default gen_random_uuid(),
  media_url text not null,
  media_type text not null default 'image' check (media_type in ('image','video')),
  fallback_image_url text,
  title text,
  description text,
  button_text text,
  button_type text not null default 'none'
    check (button_type in ('none','internal','gig','category','freelancer','search','orders','external')),
  button_url text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.hero_banners to anon;
grant select, insert, update, delete on public.hero_banners to authenticated;
grant all on public.hero_banners to service_role;

alter table public.hero_banners enable row level security;

drop policy if exists "Public can read published banners" on public.hero_banners;
create policy "Public can read published banners"
  on public.hero_banners for select
  to anon, authenticated
  using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

drop policy if exists "Admins can read all banners" on public.hero_banners;
create policy "Admins can read all banners"
  on public.hero_banners for select
  to authenticated
  using (public.is_admin_user(auth.uid()) or public.is_founder_user(auth.uid()));

drop policy if exists "Admins can write banners" on public.hero_banners;
create policy "Admins can write banners"
  on public.hero_banners for all
  to authenticated
  using (public.is_admin_user(auth.uid()) or public.is_founder_user(auth.uid()))
  with check (public.is_admin_user(auth.uid()) or public.is_founder_user(auth.uid()));

create or replace function public.touch_hero_banner_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists hero_banners_touch on public.hero_banners;
create trigger hero_banners_touch before update on public.hero_banners
  for each row execute function public.touch_hero_banner_updated_at();

-- Storage: the public `hero-banners` bucket already exists.
drop policy if exists "Admins manage hero banner media" on storage.objects;
create policy "Admins manage hero banner media"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'hero-banners'
    and (public.is_admin_user(auth.uid()) or public.is_founder_user(auth.uid()))
  )
  with check (
    bucket_id = 'hero-banners'
    and (public.is_admin_user(auth.uid()) or public.is_founder_user(auth.uid()))
  );

drop policy if exists "Anyone can view hero banner media" on storage.objects;
create policy "Anyone can view hero banner media"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'hero-banners');
