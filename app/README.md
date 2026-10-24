# Recruiter Goose

Tell the goose what you've done and what you want. He reads real job postings straight from company job boards, keeps the legit ones that fit your background, and tracks each one with you until you're hired.

**Live app:** this repo's GitHub Pages site.

## What it does
- Make an account with email and password (no confirmation email to wait on).
- Drop in a resume (PDF, Word or text) and the profile fills itself in: past jobs, years, skills, industries. You fix anything off.
- Pick the kinds of roles you want, remote and/or cities, a pay floor, and "no sales jobs".
- Matches: every posting from 46 company job boards plus Remotive, Jobicy and The Muse, checked for legit (employer apply link, under 30 days old, no scam signs, no duplicates), then judged on your background: Strong Fit, Good Fit, A Reach or Partly Sales, each with the reasons and anything to watch for.
- My Jobs: Saved, Applied, Interviewing, Offer, Closed Out, with follow-up dates. An interview gets the cheering goose; an offer gets the full celebration.
- Check A Job: paste a posting from anywhere and get the same verdict.

No AI runs in the live app. Matching and resume reading are plain rules, so it's fast, free to run and gives the same answer every time.

## How it's built
- `index.html`: the whole app, one page, plain JavaScript and supabase-js.
- Supabase (free plan): Postgres with row-level security (`profiles`, `saved_jobs`), and two Edge Functions:
  - `match`: the matching engine. Reads the job boards server-side, so no keys or scraping in the browser.
  - `signup`: makes an already-confirmed account.
- The engine's source and tests live in the project's `recruiter-goose/engine` folder.

Built by Gus Johnson with Claude, October 2026.
