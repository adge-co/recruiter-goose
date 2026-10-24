# Recruiter Goose: Handoff (10-24-2026)

For a fresh Claude picking this up in the ADGE project. Gus = Gus Johnson (GitHub `thunderbob34-boop`). Dates go Month-Day-Year. Section labels in the UI stay large, bold and dark. Gus put the design pass off until he can do it with you.

## What it is
A web app: anyone makes an account, drops in a resume (or types their background), says what they want, and gets real, legit job postings matched to their background, then tracks each one (Saved, Applied, Interviewing, Offer). No AI in the live app: matching and resume reading are plain rules (Gus's product rule). Stay keyless: Gus doesn't want sign-ups that could cost money later (JSearch/RapidAPI was declined 10-20-2026).

## Where it stands
**Working and live on the server:**
- Supabase project `recruiter-goose`, ref **aemtkwqrcmeksxvowmzr**, free plan, us-east-2, org "thunderbob34's Org". URL `https://aemtkwqrcmeksxvowmzr.supabase.co`. The app uses the legacy anon key (it's in `app/index.html`; it's public by design).
- Tables (row-level security on, each user sees only their own rows):
  - `profiles`: user_id, data (jsonb profile, including `prefs` learned from passes), last_result (last search), last_run_at, updated_at
  - `saved_jobs`: id, user_id, job_key, job (jsonb), status (saved/applied/interview/offer/passed/closed), note ("Passed: <reason>"), follow_up (date), created_at, updated_at. Unique (user_id, job_key).
- Edge Functions:
  - `match` (verify_jwt on), version 3. POST `{profile}` runs a search; POST `{check:{title,company,description}, profile}` judges one pasted posting; POST `{resume:"text"}` reads a resume into profile fields; GET lists industries and roles.
  - `signup` (verify_jwt off): makes an already-confirmed email/password account through the admin API, so no email or dashboard settings are needed. The app then signs in with the same password.
- Last live run (10-23-2026, Gus's profile): 1,795 postings read, 472 legit, 20 fits (19 strong), about 2 seconds.
- Extension `pg_net` is on; it's how you test the live functions (see Commands).

**Built, tested, not online yet:** the web app, one page.
- Account, resume drop-in (PDF via pdf.js and Word via mammoth, both from cdnjs, read in the browser; or paste), 2-step setup, Matches (fit badge, pay box, reasons, flags, at most 3 per company with "Show N more"), Pass asks why, repeated pass reasons ask one question (hide senior titles / under pay floor / a company) with "Show Everything Again" on the Me tab, My Jobs tracker with follow-up dates, interview and offer celebrations (cheering goose, confetti, count-up), Check A Job, add to home screen.
- Clicked through in Playwright on phone and desktop, light and dark, no console errors. That test used a stand-in Supabase client because the cloud container can't reach supabase.co; the real browser-to-Supabase path (CORS, real sign-in) has not been run yet. First thing to do once it's hosted.

## Waiting on Gus
1. **Create an empty public repo `Hoosier-Goose-Co/recruiter-goose`** (Claude can't create repos). Then push the contents of `app/` and turn on GitHub Pages (main branch, root). `.nojekyll` is already there.
2. **OK to drop the leftover table `public._probe`** (used to check job boards on 10-23; RLS on, harmless). The drop was blocked waiting for his confirmation. SQL: `drop table public._probe;`
3. Optional, later: a test user `goose.test1@example.com` exists from testing; delete it if he wants.

## What's left after hosting
- Live test on the real URL: make an account, upload a resume, search, save, change status.
- Design pass with Gus.
- Known gaps: no "forgot password" (needs an email sender; Supabase's built-in one only mails project members), no Google sign-in (needs a Google Cloud OAuth client), pass reasons don't change the server search (only filter in the app), Outreach Log and Draft Email from PLAN.md aren't built (need Gmail API and Google verification).
- Engine: Arrive Logistics' board sometimes times out at 12 seconds; consider a longer timeout for big boards.

## Files (project files, `/mnt/project-files/job-hunt/recruiter-goose/`)
- `PLAN.md`: full plan and history; see "Real App Built".
- `app/`: the web app to publish (`index.html`, `img/`, `manifest.webmanifest`, `README.md`, `.nojekyll`).
- `engine/`: plain Node ESM, no packages. `src/match.js` (matching), `src/resume.js` (resume reader), `src/directory.js` (46 company boards), `src/sources/index.js` (job sources), `test/engine.test.js` (9 tests), `supabase/functions/match/index.ts` and `supabase/functions/signup/index.ts`.
- `art/`: goose art. The app uses small webp copies in `app/img/`.
- On Gus's Mac the older copy lives at `HQ/Business/04 Apps and Side Hustles/Recruiter Goose/`; it's behind the project-files copy.

## Commands
- Tests: `cd engine && npm test` (Node 18+).
- Deploy `match`: send `index.ts` plus `src/match.js`, `src/directory.js`, `src/sources/index.js`, `src/resume.js` (as `src/...` next to index.ts) with the Supabase MCP `deploy_edge_function`, verify_jwt true. Every deploy replaces the whole bundle, so always send all five files.
- Test the live function from SQL (Supabase MCP `execute_sql`), then read the reply a few seconds later:
  ```sql
  select net.http_post(url:='https://aemtkwqrcmeksxvowmzr.supabase.co/functions/v1/match',
    body:='{"profile":{...}}'::jsonb,
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <anon key>"}'::jsonb,
    timeout_milliseconds:=120000);
  select status_code, content from net._http_response order by id desc limit 1;
  ```
- Check a new company board the same way: `net.http_get` on `https://boards-api.greenhouse.io/v1/boards/<token>/jobs`, `https://api.lever.co/v0/postings/<token>?mode=json`, or `https://api.ashbyhq.com/posting-api/job-board/<token>`, and confirm the postings name the right company (several tokens belong to other companies with the same name).

**Newest code on this Mac:** `latest-from-cloud/` in this folder holds the current `app/`, `engine/` and `PLAN.md` copied from the project files on 10-24-2026 (engine tests: 9 pass). Use it instead of the older files beside it.

## Recruiter Goose 2 (10-24-2026)
- Live search function `match` (version 4) reads the engine from this public repo at a pinned commit through jsDelivr (`cdn.jsdelivr.net/gh/adge-co/recruiter-goose@<commit>/engine/src/...`). To ship engine changes: push, then redeploy `engine/supabase/functions/match/index.ts` with `./src/` swapped for that URL at the new commit.
- Table `postings_seen` (migration `20261024_postings_seen.sql`) keeps first and last seen dates for company-board postings; only the function's service role can touch it.
- `.github/workflows/pages.yml` runs both test suites and publishes `app/` to GitHub Pages. Pages has to be switched on once in the repo settings (Source: GitHub Actions).
- Tests: `cd engine && npm test` (22) and `node test-ui/app.ui.mjs` (25 click-through checks, phone and desktop, light and dark).
- Leftover `_probe` table is still in the database: the delete was blocked by a safety check. Harmless.
