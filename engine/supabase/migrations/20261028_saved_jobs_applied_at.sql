-- When someone first marked a job Applied. updated_at moves on every edit (a new follow-up date, a note),
-- so the "Applied Oct 28" line, the follow-up note and the 21-day close-out clock read this instead.
alter table saved_jobs add column if not exists applied_at timestamptz;
update saved_jobs set applied_at = updated_at where applied_at is null and status in ('applied', 'interview', 'offer');

create or replace function saved_jobs_applied_at() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status in ('applied', 'interview', 'offer') and new.applied_at is null then
    new.applied_at := coalesce(old.applied_at, now());
  end if;
  return new;
end $$;

drop trigger if exists saved_jobs_applied_at on saved_jobs;
create trigger saved_jobs_applied_at before insert or update on saved_jobs
  for each row execute function saved_jobs_applied_at();
