-- Comments (D37). Run once: Supabase dashboard → SQL Editor → paste → Run.
-- Safe to run again: it only creates what's missing and replaces the functions and policies.
--
-- Anyone can read comments. Writing one needs an account (an email sign-in link) and a
-- screen name. Comments are public as soon as they're posted. Visitors can report a
-- comment; three reports from members hide it until a moderator looks. Moderators
-- (marked by hand, see the end of this file) can hide comments and ban commenters.

-- Screen names, one per account. Anonymous sign-ins (the ones "Grail it" makes) can't
-- have one, so they can't comment.
create table if not exists public.profiles (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null check (
    char_length(display_name) between 2 and 24
    and display_name ~ '^[A-Za-z0-9_.-]+( [A-Za-z0-9_.-]+)*$'
  ),
  moderator boolean not null default false,
  banned boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_display_name_unique
  on public.profiles (lower(display_name));

alter table public.profiles enable row level security;

-- Everyone may read names (they show next to comments), but not who's a moderator or
-- banned. Members may pick and change only their own name.
revoke all on public.profiles from anon, authenticated;
grant select (id, display_name) on public.profiles to anon, authenticated;
grant insert (display_name), update (display_name) on public.profiles to authenticated;

drop policy if exists "Names are public" on public.profiles;
create policy "Names are public" on public.profiles
  for select to anon, authenticated using (true);

drop policy if exists "Members pick their own name" on public.profiles;
create policy "Members pick their own name" on public.profiles
  for insert to authenticated with check (
    id = (select auth.uid())
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  );

drop policy if exists "Members change their own name" on public.profiles;
create policy "Members change their own name" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Is the signed-in visitor a moderator?
create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.moderator from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

revoke all on function public.is_moderator() from public;
grant execute on function public.is_moderator() to anon, authenticated;

-- May the signed-in visitor comment? A member with a name who isn't banned.
create or replace function public.can_comment()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and not p.banned
    );
$$;

revoke all on function public.can_comment() from public;
grant execute on function public.can_comment() to authenticated;

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  -- What the comment is on: "drop:<X post id>" or "post:<article slug>", as with grails.
  target text not null check (target ~ '^(drop|post):[A-Za-z0-9_-]{1,100}$'),
  -- Replies go one level deep: a reply to a reply is filed under the same comment.
  parent_id uuid references public.comments (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000 and body ~ '\S'),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists comments_target on public.comments (target, created_at);
create index if not exists comments_user_recent on public.comments (user_id, created_at desc);
create index if not exists comments_parent on public.comments (parent_id);

alter table public.comments enable row level security;

revoke all on public.comments from anon, authenticated;
grant select (id, target, parent_id, user_id, body, created_at) on public.comments
  to anon, authenticated;
grant insert (target, parent_id, body) on public.comments to authenticated;
grant delete on public.comments to authenticated;

drop policy if exists "Comments are public unless hidden" on public.comments;
create policy "Comments are public unless hidden" on public.comments
  for select to anon, authenticated using (not hidden);

drop policy if exists "Members comment as themselves" on public.comments;
create policy "Members comment as themselves" on public.comments
  for insert to authenticated with check (
    user_id = (select auth.uid()) and (select public.can_comment())
  );

drop policy if exists "Members delete their own comments" on public.comments;
create policy "Members delete their own comments" on public.comments
  for delete to authenticated using (user_id = (select auth.uid()));

-- Server time, never hidden on arrival, replies kept to one level on the same page, and
-- at most 5 comments a minute and 200 a day per member.
create or replace function public.comments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent record;
begin
  new.created_at := now();
  new.hidden := false;
  if new.parent_id is not null then
    select c.target, c.parent_id into parent from public.comments c where c.id = new.parent_id;
    if not found or parent.target <> new.target then
      raise exception 'That comment is gone.' using errcode = 'P0001';
    end if;
    new.parent_id := coalesce(parent.parent_id, new.parent_id);
  end if;
  if (
    select count(*) from public.comments c
    where c.user_id = new.user_id and c.created_at > now() - interval '1 minute'
  ) >= 5 or (
    select count(*) from public.comments c
    where c.user_id = new.user_id and c.created_at > now() - interval '1 day'
  ) >= 200 then
    raise exception 'You''re commenting too fast. Slow down.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.comments_before_insert() from public, anon, authenticated;

drop trigger if exists comments_before_insert on public.comments;
create trigger comments_before_insert
  before insert on public.comments
  for each row execute function public.comments_before_insert();

-- Reports. Any signed-in visitor (an anonymous one too) can report a comment once.
-- Nobody but moderators sees who reported what.
create table if not exists public.comment_reports (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.comment_reports enable row level security;

revoke all on public.comment_reports from anon, authenticated;
grant insert (comment_id) on public.comment_reports to authenticated;

drop policy if exists "Visitors report as themselves" on public.comment_reports;
create policy "Visitors report as themselves" on public.comment_reports
  for insert to authenticated with check (user_id = (select auth.uid()));

-- The third report from a member (not an anonymous visitor) hides the comment until a
-- moderator looks. Only the third: once a moderator puts it back, it stays back.
create or replace function public.comment_reports_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) from public.comment_reports r
    join auth.users u on u.id = r.user_id
    where r.comment_id = new.comment_id and not coalesce(u.is_anonymous, false)
  ) = 3 then
    update public.comments set hidden = true where id = new.comment_id;
  end if;
  return new;
end;
$$;

revoke all on function public.comment_reports_after_insert() from public, anon, authenticated;

drop trigger if exists comment_reports_after_insert on public.comment_reports;
create trigger comment_reports_after_insert
  after insert on public.comment_reports
  for each row execute function public.comment_reports_after_insert();

-- The moderation page: the latest 300 comments, hidden ones included, with reports.
-- Reported comments that are still showing come first. Empty for anyone else.
create or replace function public.moderation_comments()
returns table (
  id uuid,
  target text,
  parent_id uuid,
  body text,
  created_at timestamptz,
  hidden boolean,
  user_id uuid,
  display_name text,
  banned boolean,
  reports bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.target, c.parent_id, c.body, c.created_at, c.hidden,
         c.user_id, p.display_name, p.banned,
         (select count(*) from public.comment_reports r where r.comment_id = c.id) as reports
  from public.comments c
  join public.profiles p on p.id = c.user_id
  where public.is_moderator()
  order by
    (not c.hidden and exists (select 1 from public.comment_reports r where r.comment_id = c.id)) desc,
    c.created_at desc
  limit 300;
$$;

revoke all on function public.moderation_comments() from public;
grant execute on function public.moderation_comments() to authenticated;

create or replace function public.moderate_comment(p_comment uuid, p_hide boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_moderator() then
    raise exception 'Moderators only.' using errcode = '42501';
  end if;
  update public.comments set hidden = p_hide where id = p_comment;
end;
$$;

revoke all on function public.moderate_comment(uuid, boolean) from public;
grant execute on function public.moderate_comment(uuid, boolean) to authenticated;

-- Banning stops someone commenting and hides everything they've written. Unbanning lets
-- them comment again; their old comments stay hidden unless put back one by one.
create or replace function public.set_banned(p_user uuid, p_banned boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_moderator() then
    raise exception 'Moderators only.' using errcode = '42501';
  end if;
  if p_user = (select auth.uid()) then
    raise exception 'You can''t ban yourself.' using errcode = 'P0001';
  end if;
  update public.profiles set banned = p_banned where id = p_user;
  if p_banned then
    update public.comments set hidden = true where user_id = p_user;
  end if;
end;
$$;

revoke all on function public.set_banned(uuid, boolean) from public;
grant execute on function public.set_banned(uuid, boolean) to authenticated;

-- To make someone a moderator, once they've signed in and picked a screen name, run
-- (with their name):
--   update public.profiles set moderator = true where lower(display_name) = lower('TheirName');
