-- The app's own record of postings seen on company job boards: first seen, last seen and reposts.
-- No personal data. Only the match function (service role) reads or writes it.
create table if not exists public.postings_seen (
  id text primary key,
  sig text not null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  times_seen integer not null default 1
);
create index if not exists postings_seen_sig on public.postings_seen (sig);
alter table public.postings_seen enable row level security;
revoke all on public.postings_seen from anon, authenticated;

-- Record a batch of postings and return each one's history.
-- A repost is another id with the same company, title and place that was last seen more than a day before this one first was.
create or replace function public.record_seen(rows jsonb)
returns table (id text, first_seen timestamptz, last_seen timestamptz, times_seen integer, reposts integer, repost_first_seen timestamptz)
language sql
security definer
set search_path = public
as $$
  with incoming as (
    select distinct on (r->>'id') r->>'id' as id, r->>'sig' as sig from jsonb_array_elements(rows) r where r->>'id' is not null
  ), up as (
    insert into public.postings_seen as p (id, sig)
    select i.id, i.sig from incoming i
    on conflict (id) do update set last_seen = now(), times_seen = p.times_seen + 1, sig = excluded.sig
    returning p.id, p.sig, p.first_seen, p.last_seen, p.times_seen
  )
  select u.id, u.first_seen, u.last_seen, u.times_seen,
    (select count(*)::int from public.postings_seen o where o.sig = u.sig and o.id <> u.id and o.last_seen < u.first_seen - interval '1 day'),
    (select min(o.first_seen) from public.postings_seen o where o.sig = u.sig and o.id <> u.id and o.last_seen < u.first_seen - interval '1 day')
  from up u;
$$;
revoke all on function public.record_seen(jsonb) from public, anon, authenticated;
grant execute on function public.record_seen(jsonb) to service_role;
