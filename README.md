# Recruiter Goose

A job finder for people coming out of the trades, the counter, purchasing and the jobsite who want an office or construction-tech job.

**Live:** https://adge-co.github.io/recruiter-goose/

## What it does that job boards don't
- **Posting Check on every job.** Looks Real, Check First, Pipeline or Likely Stale, with the evidence: days open from the company's own first-posted date, last seen on the company's job board, reposts, pay listed (and whether the state requires it), "always hiring" wording, and contradictions like entry level with 7+ years.
- **How a Recruiter Reads Your Background.** Counter sales, purchasing, estimating, supers, foremen, techs, dispatch, warehouse and more, each with the office roles it points to, why a recruiter buys it, honest wording swaps and the numbers worth putting on a resume.
- **Check Before You Apply.** Pulls the knockouts out of a posting (years, licenses and certs, travel, shifts, degree, on-site days) and compares them to you.
- **Insider Moves.** Apply while it's new, a referral note to copy, one follow-up after a week.
- **A calm Today list.** Follow-ups due, fresh strong fits, saved postings the company took down, and applications gone quiet for 21 days.

No AI in the app and no paid data. Jobs come straight from company job boards: tech companies on Greenhouse, Lever and Ashby, and builders, specialty contractors, homebuilders and supply houses on Workday, iCIMS, UKG, SmartRecruiters and Oracle, plus a few free remote-job feeds.

## How it's built
- `app/`: one HTML file, Supabase for sign-in and saved jobs.
- `engine/`: plain Node modules with no packages (matching, posting check, background reader), run as a Supabase Edge Function.
- Tests: `cd engine && npm test` (engine) and `node test-ui/app.ui.mjs` (click-through in a real browser, phone and desktop, light and dark).
