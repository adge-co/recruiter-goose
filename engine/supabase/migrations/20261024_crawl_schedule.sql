-- Fill the job index every 4 hours, and once now. The key is the public anon key; the crawl function uses its own service key inside.
select cron.schedule('crawl-jobs', '17 */4 * * *', $$
  select net.http_post(url := 'https://aemtkwqrcmeksxvowmzr.supabase.co/functions/v1/crawl',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlbXRrd3FyY21la3N4dm93bXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MDAyNjcsImV4cCI6MjEwODI3NjI2N30.EHuI9p7haPWH1N5MlsBw4jgIQAxhRNFSnS_l7BDmwmk'),
    body := '{}'::jsonb, timeout_milliseconds := 150000)
$$);
select net.http_post(url := 'https://aemtkwqrcmeksxvowmzr.supabase.co/functions/v1/crawl',
  headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlbXRrd3FyY21la3N4dm93bXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MDAyNjcsImV4cCI6MjEwODI3NjI2N30.EHuI9p7haPWH1N5MlsBw4jgIQAxhRNFSnS_l7BDmwmk'),
  body := '{}'::jsonb, timeout_milliseconds := 150000);
