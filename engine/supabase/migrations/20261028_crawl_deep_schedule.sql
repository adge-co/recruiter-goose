-- The big employer boards are read two at a time every 10 minutes (crawl with {"deep": true}),
-- so no single run reads thousands of pages. Uses the same public anon key as the 4-hour crawl.
select cron.schedule('crawl-deep', '*/10 * * * *', $$
  select net.http_post(url := 'https://aemtkwqrcmeksxvowmzr.supabase.co/functions/v1/crawl',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlbXRrd3FyY21la3N4dm93bXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MDAyNjcsImV4cCI6MjEwODI3NjI2N30.EHuI9p7haPWH1N5MlsBw4jgIQAxhRNFSnS_l7BDmwmk'),
    body := '{"deep": true}'::jsonb, timeout_milliseconds := 150000)
$$);
