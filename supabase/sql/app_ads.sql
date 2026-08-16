-- FIVESOM — In-app Ads / Promotions management
-- Run once in the Supabase SQL editor of the FIVESOM project.

create table if not exists public.app_ads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  cta_text text,
  link_type text not null default 'none' check (link_type in ('none','internal','external')),
  link_url text,
  placement text not null default 'home_feed'
    check (placement in ('home_top','home_feed','search','gig_detail')),
  is_active boolean not null default true,
  priority integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  impressions integer not null default 0,
  clicks integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.app_ads to anon;
grant select, insert, update, delete on public.app_ads to authenticated;
grant all on public.app_ads to service_role;

alter table public.app_ads enable row level security;

drop policy if exists "Public can read live ads" on public.app_ads;
create policy "Public can read live ads"
  on public.app_ads for select
  to anon, authenticated
  using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

drop policy if exists "Admins can read all ads" on public.app_ads;
create policy "Admins can read all ads"
  on public.app_ads for select
  to authenticated
  using (public.is_admin_user(auth.uid()) or public.is_founder_user(auth.uid()));

drop policy if exists "Admins can write ads" on public.app_ads;
create policy "Admins can write ads"
  on public.app_ads for all
  to authenticated
  using (public.is_admin_user(auth.uid()) or public.is_founder_user(auth.uid()))
  with check (public.is_admin_user(auth.uid()) or public.is_founder_user(auth.uid()));

create or replace function public.touch_app_ads_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists app_ads_touch on public.app_ads;
create trigger app_ads_touch before update on public.app_ads
  for each row execute function public.touch_app_ads_updated_at();

-- Counters (viewers may not update the row directly).
create or replace function public.track_ad_event(_ad_id uuid, _kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _kind = 'click' then
    update public.app_ads set clicks = clicks + 1 where id = _ad_id;
  else
    update public.app_ads set impressions = impressions + 1 where id = _ad_id;
  end if;
end $$;

grant execute on function public.track_ad_event(uuid, text) to anon, authenticated;

-- Ad creatives reuse the public `hero-banners` bucket policies.
