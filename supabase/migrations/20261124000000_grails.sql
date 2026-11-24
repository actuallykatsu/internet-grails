-- "Grail it" likes (D36). Run once: Supabase dashboard → SQL Editor → paste → Run.
-- Safe to run again: it only creates what's missing and replaces the functions.
--
-- Each visitor gets an anonymous Supabase sign-in the first time they grail something,
-- so a like belongs to a user id, not an IP or a name. Visitors can see, add and remove
-- only their own grails; everyone can read the totals through grail_counts().

create table if not exists public.grails (
  -- What was grailed: "drop:<X post id>" or "post:<article slug>".
  target text not null check (target ~ '^(drop|post):[A-Za-z0-9_-]{1,100}$'),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (target, user_id)
);

create index if not exists grails_user_recent on public.grails (user_id, created_at desc);

alter table public.grails enable row level security;

-- Only signed-in visitors (anonymous sign-ins count) touch the table directly, and the
-- policies below limit them to their own rows. Nobody can update a row.
revoke all on public.grails from anon, authenticated;
grant select, insert, delete on public.grails to authenticated;

drop policy if exists "Visitors see their own grails" on public.grails;
create policy "Visitors see their own grails" on public.grails
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Visitors add their own grails" on public.grails;
create policy "Visitors add their own grails" on public.grails
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "Visitors remove their own grails" on public.grails;
create policy "Visitors remove their own grails" on public.grails
  for delete to authenticated using (user_id = (select auth.uid()));

-- Rate limit: at most 30 new grails a minute per visitor. The time is always the
-- server's, so it can't be faked to dodge the limit.
create or replace function public.grails_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_at := now();
  if (
    select count(*) from public.grails g
    where g.user_id = new.user_id and g.created_at > now() - interval '1 minute'
  ) >= 30 then
    raise exception 'Too many grails at once. Slow down.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.grails_before_insert() from public, anon, authenticated;

drop trigger if exists grails_before_insert on public.grails;
create trigger grails_before_insert
  before insert on public.grails
  for each row execute function public.grails_before_insert();

-- Totals for up to 200 targets at once, readable by everyone (the site asks once per page).
create or replace function public.grail_counts(targets text[])
returns table (target text, count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select g.target, count(*)
  from public.grails g
  where g.target = any (targets[1:200])
  group by g.target;
$$;

revoke all on function public.grail_counts(text[]) from public;
grant execute on function public.grail_counts(text[]) to anon, authenticated;
