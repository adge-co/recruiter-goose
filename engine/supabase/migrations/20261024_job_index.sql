create extension if not exists pg_trgm;
create extension if not exists pg_cron;

create table public.boards(
  ats text not null, token text not null, name text not null, industries text[] not null default '{}',
  active boolean not null default true, added_at timestamptz not null default now(),
  last_ok_at timestamptz, last_count int, last_error text, primary key (ats, token));
alter table public.boards enable row level security;

create table public.board_candidates(
  ats text not null, token text not null, tried_at timestamptz, count int, titles text[], sample text, primary key (ats, token));
alter table public.board_candidates enable row level security;

create table public.postings(
  id text primary key, board_key text not null, company text not null, title text not null, location text, remote boolean not null default false,
  pay_min int, pay_max int, pay_text text, posted_at timestamptz, first_published timestamptz, apply_url text not null,
  description text, source text, industries text[] not null default '{}',
  first_seen timestamptz not null default now(), seen_at timestamptz not null default now(), active boolean not null default true);
create index postings_live on public.postings (active, seen_at desc);
create index postings_title_trgm on public.postings using gin (lower(title) gin_trgm_ops);
alter table public.postings enable row level security;

create table public.crawl_runs(
  id bigserial primary key, started_at timestamptz not null, finished_at timestamptz, ok boolean, postings int, retired int, report jsonb);
alter table public.crawl_runs enable row level security;

-- Postings from a board that answered this run but no longer list them are retired.
create or replace function public.finish_crawl(p_started timestamptz, p_keys text[]) returns int
language sql security definer set search_path = '' as $$
  with r as (update public.postings set active = false where active and board_key = any(p_keys) and seen_at < p_started returning 1)
  select count(*)::int from r;
$$;
revoke all on function public.finish_crawl(timestamptz, text[]) from public, anon, authenticated;

-- What a search reads: live postings whose title has one of the words.
create or replace function public.index_search(p_words text[], p_limit int default 2500) returns setof public.postings
language sql stable security definer set search_path = '' as $$
  select * from public.postings
  where active and seen_at > now() - interval '36 hours'
    and lower(title) like any (select '%' || lower(w) || '%' from unnest(p_words) w)
  order by coalesce(first_published, posted_at, first_seen) desc
  limit least(p_limit, 4000);
$$;
revoke all on function public.index_search(text[], int) from public, anon, authenticated;

insert into public.boards (ats, token, name, industries) values
  ('greenhouse','supplyhouse','SupplyHouse.com',array['building-materials','logistics']::text[]),
  ('greenhouse','materialbank','Material Bank',array['building-materials']::text[]),
  ('ashby','higharc','Higharc',array['construction-tech','proptech']::text[]),
  ('greenhouse','openspace','OpenSpace',array['construction-tech']::text[]),
  ('ashby','buildops','BuildOps',array['trades-software']::text[]),
  ('ashby','kojo','Kojo',array['construction-tech','building-materials']::text[]),
  ('greenhouse','samsara','Samsara',array['logistics','saas']::text[]),
  ('greenhouse','flexport','Flexport',array['logistics']::text[]),
  ('greenhouse','project44','project44',array['logistics','saas']::text[]),
  ('ashby','eliseai','EliseAI',array['proptech','saas']::text[]),
  ('greenhouse','fieldwire','Fieldwire',array['construction-tech']::text[]),
  ('greenhouse','hover','Hover',array['construction-tech','proptech']::text[]),
  ('lever','doxel','Doxel',array['construction-tech']::text[]),
  ('ashby','bobyard','Bobyard',array['construction-tech']::text[]),
  ('ashby','parspec','Parspec',array['building-materials','construction-tech']::text[]),
  ('ashby','curri','Curri',array['building-materials','logistics']::text[]),
  ('greenhouse','jobnimbus','JobNimbus',array['trades-software']::text[]),
  ('greenhouse','servicetrade','ServiceTrade',array['trades-software']::text[]),
  ('greenhouse','fleetio','Fleetio',array['trades-software','logistics','saas']::text[]),
  ('greenhouse','simplisafe','SimpliSafe',array['trades-software']::text[]),
  ('greenhouse','gomotive','Motive',array['logistics','saas']::text[]),
  ('greenhouse','platformscience','Platform Science',array['logistics','saas']::text[]),
  ('greenhouse','geotab','Geotab',array['logistics','saas']::text[]),
  ('greenhouse','uberfreight','Uber Freight',array['logistics']::text[]),
  ('lever','loadsmart','Loadsmart',array['logistics']::text[]),
  ('greenhouse','flexe','Flexe',array['logistics']::text[]),
  ('greenhouse','shipmonk','ShipMonk',array['logistics']::text[]),
  ('ashby','vooma','Vooma',array['logistics','saas']::text[]),
  ('greenhouse','redwoodmaterials','Redwood Materials',array['energy']::text[]),
  ('greenhouse','chargepoint','ChargePoint',array['energy']::text[]),
  ('greenhouse','sunnova','Sunnova',array['energy']::text[]),
  ('greenhouse','getbuilt','Built Technologies',array['construction-tech']::text[]),
  ('greenhouse','siteline','Siteline',array['construction-tech']::text[]),
  ('ashby','companycam','CompanyCam',array['construction-tech','trades-software']::text[]),
  ('ashby','workyard','Workyard',array['construction-tech']::text[]),
  ('lever','tenna','Tenna',array['construction-tech']::text[]),
  ('lever','handoff','Handoff',array['construction-tech']::text[]),
  ('greenhouse','roofr','Roofr',array['trades-software','construction-tech']::text[]),
  ('ashby','jobber','Jobber',array['trades-software']::text[]),
  ('lever','workwave','WorkWave',array['trades-software']::text[]),
  ('ashby','thumbtack','Thumbtack',array['trades-software']::text[]),
  ('ashby','angi','Angi',array['trades-software']::text[]),
  ('lever','lessen','Lessen',array['proptech','trades-software']::text[]),
  ('lever','arrivelogistics','Arrive Logistics',array['logistics']::text[]),
  ('greenhouse','cargomatic','Cargomatic',array['logistics']::text[]),
  ('ashby','span','SPAN',array['energy']::text[]),
  ('ashby','traba','Traba',array['logistics']::text[]),
  ('ashby','maintainx','MaintainX',array['trades-software','saas']::text[]),
  ('greenhouse','upkeep','UpKeep',array['trades-software']::text[]),
  ('ashby','toolbx','TOOLBX',array['building-materials']::text[]),
  ('greenhouse','instawork','Instawork',array['hospitality','logistics']::text[]),
  ('greenhouse','toast','Toast',array['hospitality']::text[]),
  ('greenhouse','cloudbeds','Cloudbeds',array['hospitality']::text[]),
  ('lever','canarytechnologies','Canary Technologies',array['hospitality']::text[]);

insert into public.board_candidates (ats, token) values ('greenhouse','procoretechnologies'),('lever','procoretechnologies'),('ashby','procoretechnologies'),('greenhouse','procore'),('lever','procore'),('ashby','procore'),('greenhouse','servicetitan'),('lever','servicetitan'),('ashby','servicetitan'),('greenhouse','buildertrend'),('lever','buildertrend'),('ashby','buildertrend'),('greenhouse','housecallpro'),('lever','housecallpro'),('ashby','housecallpro'),('greenhouse','billd'),('lever','billd'),('ashby','billd'),('greenhouse','slate'),('lever','slate'),('ashby','slate'),('greenhouse','slatetechnologies'),('lever','slatetechnologies'),('ashby','slatetechnologies'),('greenhouse','trunktools'),('lever','trunktools'),('ashby','trunktools'),('greenhouse','assignar'),('lever','assignar'),('ashby','assignar'),('greenhouse','rhumbix'),('lever','rhumbix'),('ashby','rhumbix'),('greenhouse','pype'),('lever','pype'),('ashby','pype'),('greenhouse','joist'),('lever','joist'),('ashby','joist'),('greenhouse','briq'),('lever','briq'),('ashby','briq'),('greenhouse','zuper'),('lever','zuper'),('ashby','zuper'),('greenhouse','fieldedge'),('lever','fieldedge'),('ashby','fieldedge'),('greenhouse','successware'),('lever','successware'),('ashby','successware'),('greenhouse','buildbook'),('lever','buildbook'),('ashby','buildbook'),('greenhouse','opendoor'),('lever','opendoor'),('ashby','opendoor'),('greenhouse','latch'),('lever','latch'),('ashby','latch'),('greenhouse','brivo'),('lever','brivo'),('ashby','brivo'),('greenhouse','bilt'),('lever','bilt'),('ashby','bilt'),('greenhouse','biltrewards'),('lever','biltrewards'),('ashby','biltrewards'),('greenhouse','entrata'),('lever','entrata'),('ashby','entrata'),('greenhouse','appfolio'),('lever','appfolio'),('ashby','appfolio'),('greenhouse','buildium'),('lever','buildium'),('ashby','buildium'),('greenhouse','rently'),('lever','rently'),('ashby','rently'),('greenhouse','porch'),('lever','porch'),('ashby','porch'),('greenhouse','frontdoor'),('lever','frontdoor'),('ashby','frontdoor'),('greenhouse','taskrabbit'),('lever','taskrabbit'),('ashby','taskrabbit'),('greenhouse','yardzen'),('lever','yardzen'),('ashby','yardzen'),('greenhouse','palmetto'),('lever','palmetto'),('ashby','palmetto'),('greenhouse','aurorasolar'),('lever','aurorasolar'),('ashby','aurorasolar'),('greenhouse','enphase'),('lever','enphase'),('ashby','enphase'),('greenhouse','arcadia'),('lever','arcadia'),('ashby','arcadia'),('greenhouse','shipbob'),('lever','shipbob'),('ashby','shipbob'),('greenhouse','stord'),('lever','stord'),('ashby','stord'),('greenhouse','flockfreight'),('lever','flockfreight'),('ashby','flockfreight'),('greenhouse','transfix'),('lever','transfix'),('ashby','transfix'),('greenhouse','fourkites'),('lever','fourkites'),('ashby','fourkites'),('greenhouse','dustyrobotics'),('lever','dustyrobotics'),('ashby','dustyrobotics'),('greenhouse','builtrobotics'),('lever','builtrobotics'),('ashby','builtrobotics'),('greenhouse','togal'),('lever','togal'),('ashby','togal'),('greenhouse','togalai'),('lever','togalai'),('ashby','togalai'),('greenhouse','documentcrunch'),('lever','documentcrunch'),('ashby','documentcrunch'),('greenhouse','civrobotics'),('lever','civrobotics'),('ashby','civrobotics'),('greenhouse','bedrockrobotics'),('lever','bedrockrobotics'),('ashby','bedrockrobotics'),('greenhouse','mosaic'),('lever','mosaic'),('ashby','mosaic'),('greenhouse','outbuild'),('lever','outbuild'),('ashby','outbuild'),('greenhouse','canvas'),('lever','canvas'),('ashby','canvas'),('greenhouse','canvasconstruction'),('lever','canvasconstruction'),('ashby','canvasconstruction'),('greenhouse','fyld'),('lever','fyld'),('ashby','fyld'),('greenhouse','bluebeam'),('lever','bluebeam'),('ashby','bluebeam'),('greenhouse','stackct'),('lever','stackct'),('ashby','stackct'),('greenhouse','cove'),('lever','cove'),('ashby','cove'),('greenhouse','coveai'),('lever','coveai'),('ashby','coveai'),('greenhouse','lumber'),('lever','lumber'),('ashby','lumber'),('greenhouse','lumberapp'),('lever','lumberapp'),('ashby','lumberapp'),('greenhouse','buildpass'),('lever','buildpass'),('ashby','buildpass'),('greenhouse','ledgeriq'),('lever','ledgeriq'),('ashby','ledgeriq'),('greenhouse','raken'),('lever','raken'),('ashby','raken'),('greenhouse','safetyculture'),('lever','safetyculture'),('ashby','safetyculture'),('greenhouse','hcss'),('lever','hcss'),('ashby','hcss'),('greenhouse','egnyte'),('lever','egnyte'),('ashby','egnyte'),('greenhouse','joinbuild'),('lever','joinbuild'),('ashby','joinbuild'),('greenhouse','join'),('lever','join'),('ashby','join'),('greenhouse','siteaware'),('lever','siteaware'),('ashby','siteaware'),('greenhouse','versatile'),('lever','versatile'),('ashby','versatile'),('greenhouse','disperse'),('lever','disperse'),('ashby','disperse'),('greenhouse','avvir'),('lever','avvir'),('ashby','avvir'),('greenhouse','reconstruct'),('lever','reconstruct'),('ashby','reconstruct'),('greenhouse','track3d'),('lever','track3d'),('ashby','track3d'),('greenhouse','smartbarrel'),('lever','smartbarrel'),('ashby','smartbarrel'),('greenhouse','builderprime'),('lever','builderprime'),('ashby','builderprime'),('greenhouse','hearth'),('lever','hearth'),('ashby','hearth'),('greenhouse','sunlightfinancial'),('lever','sunlightfinancial'),('ashby','sunlightfinancial'),('greenhouse','goodleap'),('lever','goodleap'),('ashby','goodleap'),('greenhouse','enfin'),('lever','enfin'),('ashby','enfin'),('greenhouse','setpoint'),('lever','setpoint'),('ashby','setpoint'),('greenhouse','zum'),('lever','zum'),('ashby','zum'),('greenhouse','tread'),('lever','tread'),('ashby','tread'),('greenhouse','augment'),('lever','augment'),('ashby','augment'),('greenhouse','parade'),('lever','parade'),('ashby','parade'),('greenhouse','paradeai'),('lever','paradeai'),('ashby','paradeai'),('greenhouse','shipwell'),('lever','shipwell'),('ashby','shipwell'),('greenhouse','turvo'),('lever','turvo'),('ashby','turvo'),('greenhouse','vector'),('lever','vector'),('ashby','vector'),('greenhouse','everstream'),('lever','everstream'),('ashby','everstream'),('greenhouse','orennia'),('lever','orennia'),('ashby','orennia'),('greenhouse','leap'),('lever','leap'),('ashby','leap'),('greenhouse','bractlet'),('lever','bractlet'),('ashby','bractlet'),('greenhouse','roofstock'),('lever','roofstock'),('ashby','roofstock'),('greenhouse','ribbon'),('lever','ribbon'),('ashby','ribbon'),('greenhouse','homelight'),('lever','homelight'),('ashby','homelight'),('greenhouse','pacaso'),('lever','pacaso'),('ashby','pacaso'),('greenhouse','arrived'),('lever','arrived'),('ashby','arrived'),('greenhouse','belong'),('lever','belong'),('ashby','belong'),('greenhouse','mynd'),('lever','mynd'),('ashby','mynd') on conflict do nothing;

