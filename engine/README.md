# Recruiter Goose engine

A person's info goes in. Legit job postings that fit come out, ranked, each with the reasons it fits and anything to watch for.

## Run it on your Mac
    cd "Recruiter Goose/engine"
    npm test          # offline tests with sample postings
    npm start         # then open http://localhost:8787
    npm run check-directory   # which company job boards answer

Node 18 or newer. No packages to install. Behind a proxy (like Claude's sandbox), Node 20's fetch ignores it; use Node 24 with `NODE_USE_ENV_PROXY=1`.

Optional keys add wide coverage: `JSEARCH_KEY=... npm start` turns on Google for Jobs (LinkedIn, Indeed, ZipRecruiter and company sites). `ADZUNA_ID` and `ADZUNA_KEY` turn on Adzuna.

## Input
    { "name": "Gus", "pastTitles": ["Purchasing Agent"], "years": 7, "skills": ["quoting", "ERP"],
      "industries": ["construction-tech"],
      "wants": { "roles": ["implementation"], "remote": true, "cities": ["Dallas, TX"], "payFloor": 90000, "avoid": ["sales"] } }

## Output
`counts` (found, legit, matched, strong), `dropped` (duplicate, tooOld, looksLikeScam, noApplyLink, wrongPlace), `sources` (each one checked, with its count or error) and `jobs`. Each job has: title, company, location, remote, payMin, payMax, postedAt, applyUrl, source, fit (strong, good, reach or sales), score (0-100), reasons, flags and snippet.

## How it decides
- **Legit:** it must have an https apply link, be posted in the last 30 days, have no scam markers (Telegram, check deposits, fees) and not be a duplicate. When the same job shows up twice, the employer's own posting wins.
- **Score:** role in the title (40), or a distinctive word from a past title (20); a job whose title fits neither is dropped, even if the description mentions the role. Their listed skills found in the posting (25), the right place (15), pay at or above the floor (10, or 4 when pay isn't listed) and freshness (10).
- **Never oversold:** a director job with under 10 years, or a senior job with under 5 years, is a Reach. Pay under the floor caps a job at Reach. Quota or commission in the posting makes it Partly Sales. A role they ruled out is dropped (ruling out sales also rules out account executive and business development titles). Entry-level and graduate roles are a Reach for anyone with 5+ years.

## Sources
No key: Remotive and Jobicy (remote jobs), The Muse, and company job boards read straight from Greenhouse, Lever and Ashby (src/directory.js).
With a key: JSearch (Google for Jobs) and Adzuna.

## Server
supabase/functions/match is the same engine as an Edge Function. Copy `src/` into `supabase/functions/match/src/` and deploy. Keep the keys in the project's secrets, never in the app.
