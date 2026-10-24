# Recruiter Goose: plan (draft 10/20/2026)

## What it is, in one sentence
You tell the goose what you've done and what you want, and he brings back real job postings that fit, then tracks each one with you until you're hired.

## The goose
Same goose as HQ and Goose Egg, in a recruiter outfit. The art comes from Google Flow edits of an existing goose pose with only the outfit and pose changed. He is not redrawn from scratch.

Outfit ideas (pick one):
- A. Quarter-zip (recommended): a navy quarter-zip over a collared shirt, a lanyard with a blank ID badge, and a one-ear headset. Reads "recruiter" at icon size.
- B. Agency: a navy blazer over a white tee, a phone to his ear, and a coffee cup.
- C. Fleece vest: a gray fleece vest over a light blue button-down, holding a tablet.
- D. Hiring table: behind a small table with a blank tent card, handing over a name badge. This one has no outfit gag.

Poses needed (one Flow prompt at a time): waving = welcome, phone to ear = searching, clipboard = empty list, cheering = hired (reuse the cheer composition in the new outfit).

## Look
Goose Egg's calm layout (warm gray, white cards, ink buttons, system font). One new accent: the outfit's navy, used for the main buttons and the selected tab. Green means good news (pay clears the floor, interview, offer). Red is for warnings only.

## How it gets real postings
An artifact page can't call outside job sites, so the public app needs a small server. Plan: a Supabase edge function holds the API key and calls a jobs API. The app only talks to that function.

| Source | Covers | Free tier | Paid |
|---|---|---|---|
| JSearch (recommended to start) | Google for Jobs, which pulls in LinkedIn, Indeed, ZipRecruiter and company sites | 200 requests/mo | $25/mo for 10,000 |
| Adzuna | Its own listings | 2,500 calls/mo | By arrangement |
| SerpApi | Google Jobs pages | 250 searches/mo | $25/mo for 1,000 |
| USAJOBS | Federal jobs only | Free | Free |

Prices are from jobspipe.dev's 2026 comparison and Bright Data's API roundup; check them before signing up. "Legit" check: keep only postings with an employer apply link, drop duplicates across boards, flag listings older than 30 days, and flag pay ranges that aren't posted.

## Onboarding (3 screens)
1. Welcome, with the goose waving.
2. About you: past job titles (tap chips after typing one), years, and the trades or tools you know. Optional: upload a resume to fill this in.
3. What you want: roles, where (remote / city), pay floor. Then straight to the first matches.

## Big moments
- Tier 1: mark Applied (light tap).
- Tier 3: an interview set (a card, the goose cheering).
- Tier 4: an offer (full screen, count-up of applications sent, honk + confetti, the story card).

## Before building
- Check that "Recruiter Goose" is free on the App Store and as a domain. A web search found no app by that exact name, but a job-apply Chrome extension called GoosePilot exists.
- Set the bundle ID to match the final name.
- Decide: iPhone app first (your usual pipeline) or web first.

## Outreach Log (Gus, Oct 20, 2026)
- Log every email or message sent to a company, with a link to the sent email and a follow-up date.
- The user gives the address they job hunt from; the app searches that inbox for sent outreach.
- Connecting email is optional. Someone who signs in another way (Apple, phone) can add their job-search email later in Settings, or log outreach by hand.

## Draft for Review (Gus, Oct 20, 2026)
- On any matched job, Draft Email: the app writes a short note to the recruiter or hiring contact about that job, tailors the resume to the posting and company (no new claims), attaches it, and saves it as a draft in the user's own email. Nothing sends until the user proofreads and hits send.
- Every draft and sent note shows on the Outreach tab with its status, follow-up date and a link to the email.
- Job cards: company name on its own line, a colored Remote / Hybrid / On-Site pill, and pay in one fixed Pay column (yearly range, with Hourly, Bonus, Commission or Estimate noted underneath).

## Personal Catches and In-App Email (Gus, Oct 20, 2026)
- Catches (travel, time-zone hours, on-site, weekends) are highlighted in amber only when that user said "Want Less Of" for it in onboarding. Otherwise they show as plain pills. Nothing is a universal red flag.
- Each outreach card opens the full sent email and every reply on the page, oldest first, with the attached resume linkable. Gmail stays one tap away but isn't required.

## The Profile: Built, Not Filled Out (Gus, Oct 20, 2026)
- No profile form. The user drops in a resume (or LinkedIn PDF export) and the app fills title, years, skills, tools, school and past companies; they only correct mistakes.
- Onboarding asks only what a resume can't: next move, want more of, want less of, pay floor, where (about a minute).
- It learns from actions (save, pass, draft, replies). A repeated pattern (e.g. passing heavy-travel jobs) gets one question: treat this as a catch?
- One editable "What Goose Knows About You" card in Settings. Nothing required.
- Private by design: no public page, no recruiter inbound, nothing to keep current. LinkedIn's profile is for being found; this one is for finding.

## Company Boards Added (2026-10-20)
- Added 21 company boards to engine/src/directory.js (31 total). Each slug was checked that day against its public, keyless board API (boards-api.greenhouse.io, api.lever.co, api.ashbyhq.com) and returned a live board with open jobs.
- Construction tech: Fieldwire (greenhouse/fieldwire, 24 jobs), Hover (greenhouse/hover, 21), Doxel (lever/doxel), Bobyard (ashby/bobyard, 16).
- Building materials: Parspec (ashby/parspec, 5), Curri (ashby/curri, 9+).
- Trades and field service: JobNimbus (greenhouse/jobnimbus, 5), ServiceTrade (greenhouse/servicetrade, 8), Fleetio (greenhouse/fleetio, 24), SimpliSafe (greenhouse/simplisafe, 45).
- Logistics: Motive (greenhouse/gomotive), Platform Science (greenhouse/platformscience, 27), Geotab (greenhouse/geotab, 56), Uber Freight (greenhouse/uberfreight, 64), Loadsmart (lever/loadsmart), Flexe (greenhouse/flexe, 3), ShipMonk (greenhouse/shipmonk, 54), Vooma (ashby/vooma, 11).
- Energy and battery storage (new "energy" industry filter): Redwood Materials (greenhouse/redwoodmaterials, 144), ChargePoint (greenhouse/chargepoint, 34), Sunnova (greenhouse/sunnova, 2).
- Tried and not added: no board found for EquipmentShare, Built Technologies, Trunk Tools, Document Crunch, Briq, Command Alkon, Raken, Fluence, Aurora Solar, ShipBob, Stord, FourKites, Workiz, Zuper and others. "palmetto" and "slate" are other companies with the same name. CompanyCam and TOOLBX boards exist but had no open jobs.

## Live Run on 31 Boards (2026-10-20)
1,785 found, 520 legit, 66 matched (43 strong). All 31 boards answered. Result on the Mac: engine/out-gus-2026-10-20b.json, script engine/scripts/run-gus.mjs.
Fixes the run showed are needed:
- "Remote" jobs outside the US (Pakistan, Mexico, Germany) pass as matches. Remote should mean remote in the seeker's country.
- Company boilerplate inflates skill hits: Samsara's "construction" in every posting made legal, finance and AI roles "strong". Count skills from the job's own duties, not the About Us text.
- Off-target titles slip through on one role word (HR Coordinator, Legal Project Manager). Consider an exclude list per role (HR, legal, finance, engineer).
8 hand-picked matches went onto Gus's board: SupplyHouse onboarding, 3 Samsara, Built, WorkWave, ChargePoint, Flexport trucking procurement.

## Matching on Background (2026-10-20)
Gus: "I want Implementation Consultant for my construction background, don't show me Account Manager selling beds to hotels." The engine (src/match.js) now:
- Scores the job's field from its own duties (FIELD_WORDS per industry), minus lines a company repeats in most of its postings (companyBoilerplate) and EEO/benefits text.
- Hides jobs clearly about another industry (OTHER_FIELDS: hospitality, healthcare, finance...) when nothing in the duties touches the person's field, and other kinds of work sharing a title word (HR, Legal, Finance, Marketing, Teaching...). Counts land in result.hidden.
- Strong needs a field match; the right title with no field signal is at most a reach ("Outside Your Field"). Technical titles are a reach.
- Remote means remote in the US (wants.country, default US).
- Company boards tag each job with the company's industries.
- checkJob(job, profile) judges one pasted posting (verdict, reasons, gaps, heads-up such as travel %).
Tests: 7 passing. The Mac copy of the engine is behind this one.

## Competitors (from the board's old Market Check, Oct 20, 2026)
Simplify ($39.99/mo), Jobright (paid after sign-up), Huntr ($40/mo), Teal ($29/mo), Jobscan ($49.95/mo) and Careerflow (varies) already match jobs to a resume and track applications; Jobscan and Careerflow also score LinkedIn. None know the trades (can't tell a $40M window department manager is a strong implementation hire, or that "HomeFront Sales" is a product name). Niche: tradespeople moving into construction tech. Source: HireKey's 2026 comparison of AI job search tools.
The board's Market tab was replaced on Oct 20 with a Glassdoor-style pay and hiring view for the user's target roles.

## Real App Built (10-22-2026 to 10-23-2026)
- Supabase project `recruiter-goose` (ref aemtkwqrcmeksxvowmzr, free plan, us-east-2). Tables: `profiles` (data, last_result, last_run_at) and `saved_jobs` (job, status saved/applied/interview/offer/passed/closed, note, follow_up), both row-level secured to the owner.
- Edge Functions: `match` (the engine; also `{check}` for one pasted posting and `{resume}` to read a resume) and `signup` (makes an already-confirmed account, so no email or SMTP is needed).
- The web app is one page: `app/index.html` (+ `app/img`, `app/manifest.webmanifest`). Account, resume drop-in (PDF/Word/paste, read in the browser), 2-step setup, Matches (max 3 per company, "show more"), Pass asks why, My Jobs tracker with follow-up dates, interview and offer celebrations, Check A Job.
- Live run 10-23-2026 for Gus: 1,795 postings read, 472 legit, 20 fits (19 strong), including Built Technologies and Jobber from the new boards.
- Directory now 46 boards; 15 added 10-23 (Built, Siteline, CompanyCam, Workyard, Tenna, Handoff, Roofr, Jobber, WorkWave, Thumbtack, Angi, Lessen, Arrive Logistics, Cargomatic, SPAN), each checked from the Supabase server. Rejected same-name or off-field boards: Arcadia (healthcare), Mosaic (finance), GC AI (legal), Greenlight, Xometry, Pallet.
- Hosting: GitHub Pages, waiting on the public repo Hoosier-Goose-Co/recruiter-goose.
- Known gaps: no "forgot password" (needs an email sender; Supabase's built-in one only mails project members), no Google sign-in yet (needs a Google Cloud OAuth client), pass reasons are saved but don't steer the search yet, Draft Email / Outreach not built (needs Gmail API and Google verification).
- Testing: the cloud container can't reach supabase.co or job sites, so live checks go through pg_net from SQL; the UI is tested in Playwright with a stand-in Supabase client (scratch harness, not saved).
