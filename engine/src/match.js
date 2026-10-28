// The engine: a person's profile goes in, legit postings that fit come out, ranked, each with
// the reasons it fits and anything to watch for. Runs in Node 18+ and Deno (Supabase).

import * as S from "./sources/index.js";
import { postingCheck, knockouts } from "./trust.js";
import { inCity } from "./places.js";

// Words people use for the same kind of role. A role the person types that isn't here is used as-is.
export const ROLE_WORDS = {
  implementation: ["implementation", "onboarding", "deployment", "solutions consultant", "rollout"],
  onboarding: ["onboarding", "implementation", "customer training"],
  training: ["trainer", "training", "enablement", "instructional"],
  "customer success": ["customer success", "account manager", "client success", "customer experience"],
  coordinator: ["coordinator", "project coordinator", "operations coordinator", "scheduler", "supply chain coordinator", "logistics coordinator"],
  "project manager": ["project manager", "project management", "program manager", "assistant project manager", "project engineer"],
  purchasing: ["purchasing", "procurement", "buyer", "assistant buyer", "sourcing"],
  pricing: ["pricing analyst", "pricing", "revenue analyst"],
  estimating: ["estimator", "estimating", "preconstruction", "takeoff"],
  operations: ["operations manager", "operations analyst", "operations", "process improvement"],
  support: ["support specialist", "technical support", "customer support", "help desk"],
  "product manager": ["product manager", "product owner", "product specialist"],
  scheduling: ["dispatcher", "dispatch", "scheduler", "scheduling coordinator", "service coordinator"],
  inventory: ["inventory", "materials planner", "material planner", "materials coordinator", "supply planner", "demand planner"],
  safety: ["safety coordinator", "safety manager", "safety specialist", "ehs", "hse"],
  quality: ["quality", "qa qc", "qc coordinator", "quality control", "quality assurance"],
  warehouse: ["warehouse manager", "warehouse supervisor", "warehouse coordinator", "distribution center", "yard manager", "branch operations"],
  quoting: ["quote", "quoting", "quotations", "inside sales", "counter sales", "order desk", "project sales"],
  sales: ["outside sales", "sales representative", "sales rep", "territory sales", "territory manager", "sales coordinator", "sales estimator", "account manager"],
};

const SENIOR = /\b(senior|sr\.?|lead|principal|staff)\b/i;
const EXEC = /\b(director|vp|vice president|head of|chief)\b/i;
const SCAM = /\b(telegram|whatsapp|wire transfer|check deposit|upfront fee|pay (a|the) fee|crypto wallet|gift cards?)\b/i;
// What people mean when they rule out a kind of role.
const AVOID_WORDS = {
  sales: ["sales", "account executive", "business development", "sales development", "sdr", "bdr", "inside sales"],
};
// Junior and assistant office titles (Jr Estimator, Assistant Buyer, APM) are the usual first step for people coming
// in from the field, so they aren't marked down; internships and graduate programs are.
const ENTRY = /\b(graduate|intern|internship|trainee|apprentice)\b/i;
// A past title that carried a quota. Counter and inside sales usually didn't, so they don't lift a no to sales.
const SOLD_BEFORE = /\b(outside sales|territory|account (manager|executive)|business development|sales (rep|representative|manager|executive|consultant))\b/i;
const COMMISSION_ONLY = /\b(commission[- ]only|100% commission|straight commission|uncapped commission)\b/i;
const SALESY = /\b(quota|commission|cold call|outbound prospecting|book of business|ote\b|on-target earnings)\b/i;

// What work in each field sounds like. A job's own duties naming these is what makes it fit someone's background,
// not a title word it happens to share (an Account Manager selling beds to hotels is not a construction job).
export const FIELD_WORDS = {
  "construction-tech": ["construction", "contractor", "contractors", "general contractor", "subcontractor", "subcontractors", "jobsite", "job site", "builder", "builders", "homebuilder", "homebuilders", "preconstruction", "takeoff", "estimating", "aec"],
  "building-materials": ["building materials", "building product manufacturers", "lumber", "millwork", "doors", "windows", "door hardware", "dealer", "dealers", "distributor", "distributors", "lbm", "supply house", "plumbing supply", "hvac"],
  "contractors": ["general contractor", "subcontractor", "subcontractors", "self-perform", "jobsite", "job site", "superintendent", "preconstruction", "mechanical contractor", "electrical contractor", "commercial construction", "construction projects", "submittals", "change orders"],
  "trades-software": ["trades", "hvac", "plumbing", "electrical", "roofing", "field service", "technicians", "service contractors", "home services"],
  "proptech": ["homebuilder", "homebuilders", "homebuilding", "home builders", "property management", "real estate", "multifamily"],
  "logistics": ["logistics", "supply chain", "freight", "shipping", "warehouse", "fleet", "fleets", "trucking", "carrier", "carriers", "procurement", "transportation"],
  "energy": ["solar", "battery", "batteries", "energy storage", "ev charging", "charging stations", "utility", "utilities", "renewable"],
  "hospitality": ["hotel", "hotels", "hospitality", "resort", "resorts", "restaurant", "restaurants", "guest", "guests", "front desk", "food service", "property management system"],
  "saas": [],
};
const FIELD_NAMES = { "contractors": "Construction", "construction-tech": "Construction", "building-materials": "Building materials", "trades-software": "Trades", "proptech": "Homebuilding", "logistics": "Logistics", "energy": "Energy", "hospitality": "Hospitality" };

// Fields that, when a job is clearly about one of them and not the person's own, mean "not for you".
export const OTHER_FIELDS = {
  hospitality: ["hotel", "hotels", "hospitality", "resort", "resorts", "guest experience", "travel industry"],
  healthcare: ["patient", "patients", "clinical", "hospital", "hospitals", "health system", "health systems", "physician", "physicians", "nurse", "nursing", "pharmacy", "medical", "healthcare", "care teams"],
  restaurants: ["restaurant", "restaurants", "food service", "menu"],
  education: ["students", "k 12", "school district", "school districts", "teachers", "higher education", "curriculum", "learners"],
  finance: ["banking", "banks", "wealth", "investors", "fund administration", "private equity", "insurance", "lending", "mortgage", "fintech", "asset managers"],
  retail: ["apparel", "fashion", "beauty", "cosmetics", "consumer brands"],
  entertainment: ["ticketing", "tickets", "live events", "gaming", "sports teams", "venues", "fans"],
  legal: ["law firm", "law firms", "attorneys"],
  advertising: ["advertisers", "ad tech", "publishers"],
};

// Kinds of work that share a title word with what people want (HR Coordinator, Legal Project Manager) but are a different job.
// Dropped unless the person has done or asked for that kind of work.
const OTHER_WORK = {
  "HR": /\b(hr|human resources|people operations|people partner|recruiter|recruiting|talent acquisition|payroll|benefits)\b/i,
  "Legal": /\b(legal|counsel|paralegal|attorney|compliance)\b/i,
  "Finance": /\b(accounting|accountant|finance|financial|tax|controller|fp a|treasury)\b/i,
  "Medical": /\b(nurse|clinical|physician|pharmacist|therapist|medical)\b/i,
  "Marketing": /\b(marketing|content|social media|brand|seo|communications|copywriter)\b/i,
  "Design": /\b(designer|ux|ui)\b/i,
  "Teaching": /\b(coach|instructor|teacher|tutor)\b/i,
};
// Technical roles stay, but only as a reach for someone without that background.
const TECHNICAL = /\b(engineer|engineering|developer|software|data scientist|devops|architect)\b/i;
const NON_US = /\b(canada|mexico|brazil|argentina|colombia|chile|peru|uk|united kingdom|england|london|ireland|germany|berlin|france|paris|spain|portugal|netherlands|amsterdam|poland|romania|india|bangalore|pakistan|philippines|australia|new zealand|singapore|japan|emea|apac|latam|europe|israel|south africa|nigeria|kenya|egypt|turkey|ukraine|serbia|costa rica|monterrey|guadalajara|mexico city|cdmx|toronto|vancouver|montreal|ontario|quebec|british columbia|alberta|calgary|sao paulo|bogota|medellin|buenos aires|santiago|lima|dublin|munich|hamburg|madrid|barcelona|lisbon|warsaw|krakow|bucharest|sydney|melbourne|tokyo|seoul|korea|china|shanghai|vietnam|indonesia|hyderabad|pune|delhi|mumbai|chennai|noida|gurgaon|gurugram|manila|cebu|lagos|nairobi|cairo|tel aviv|istanbul|kyiv|belgrade|sweden|stockholm|norway|denmark|copenhagen|finland|switzerland|zurich|austria|vienna|belgium|brussels|italy|milan|czech|prague|hungary|budapest|greece|uae|dubai|saudi|qatar)\b/i;
const US_OK = /\b(us|usa|u s|united states|america|americas|north america|anywhere|worldwide|global)\b/i;
// Lines every company puts in every posting; they say nothing about the job itself.
const BOILERPLATE = /\b(equal opportunity|eeo|without regard to|reasonable accommodation|about us|our mission|we are proud|benefits include|401 ?k|paid time off|pto|e verify|background check)\b/i;

// Words too common in job titles to say anything about fit on their own.
const GENERIC = new Set(["manager", "management", "project", "senior", "specialist", "associate", "assistant", "lead", "operations", "director", "coordinator", "analyst", "representative", "officer", "executive", "consultant", "agent", "store", "general"]);

const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const has = (text, word) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(text);
const daysAgo = iso => { const t = Date.parse(iso); return Number.isFinite(t) ? (Date.now() - t) / 864e5 : null; };
const money = n => "$" + Math.round(n / 1000) + "k";

export function cleanProfile(p = {}) {
  const w = p.wants || {};
  return {
    name: String(p.name || "").trim(),
    pastTitles: (p.pastTitles || []).map(String).filter(Boolean),
    years: Number(p.years) || 0,
    skills: (p.skills || []).map(String).filter(Boolean),
    // Skipped in setup: this app is for people from construction and supply, so that's the field to judge by.
    industries: (p.industries || []).map(String).filter(Boolean).length ? p.industries.map(String).filter(Boolean) : ["contractors", "building-materials", "construction-tech"],
    wants: {
      roles: (w.roles || []).map(r => String(r).toLowerCase().trim()).filter(Boolean),
      remote: w.remote !== false,
      cities: (w.cities || []).map(String).filter(Boolean),
      payFloor: Number(w.payFloor) || 0,
      avoid: (w.avoid || ["sales"]).map(r => String(r).toLowerCase()),
      maxAgeDays: Number(w.maxAgeDays) || 30,
      country: String(w.country || "US").toUpperCase(),
    },
  };
}

// ---------- 1. Ask the sources ----------

export async function fetchAll(p, env = {}, sources = S) {
  const roles = p.wants.roles.slice(0, 4);
  const places = [...(p.wants.remote ? [{ remote: true }] : []), ...p.wants.cities.slice(0, 3).map(city => ({ city }))];
  const report = [], jobs = [];
  const run = async (name, fn) => {
    try { const out = await fn(); const list = Array.isArray(out) ? out : out.jobs; jobs.push(...list);
      report.push({ name, ok: true, count: list.length, ...(out.errors?.length ? { notes: out.errors } : {}) }); }
    catch (e) { report.push({ name, ok: false, count: 0, error: String(e.message || e) }); }
  };
  const tasks = [];
  // The job index (filled on a schedule) answers in one read; live sources are the fallback when it's empty or down.
  if (sources.index) {
    let n = 0;
    await run("Job index", async () => { const list = await sources.index(p); n = list.length; return list; });
    if (n) {
      for (const pl of places) if (pl.city) tasks.push(run(`The Muse: ${pl.city}`, () => sources.themuse(pl)));
      await Promise.all(tasks);
      return { jobs, report };
    }
  }
  for (const role of roles) {
    if (p.wants.remote) {
      tasks.push(run(`Remotive: ${role}`, () => sources.remotive({ keyword: role })));
      tasks.push(run(`Jobicy: ${role}`, () => sources.jobicy({ keyword: role })));
    }
    for (const pl of places) {
      if (env.JSEARCH_KEY) tasks.push(run(`Google for Jobs: ${role}${pl.city ? " in " + pl.city : " remote"}`, () => sources.jsearch({ keyword: role, ...pl }, env.JSEARCH_KEY)));
      if (env.ADZUNA_ID && env.ADZUNA_KEY) tasks.push(run(`Adzuna: ${role}${pl.city ? " in " + pl.city : ""}`, () => sources.adzuna({ keyword: role, ...pl }, env.ADZUNA_ID, env.ADZUNA_KEY)));
    }
  }
  for (const pl of places) tasks.push(run(`The Muse${pl.city ? ": " + pl.city : ": remote"}`, () => sources.themuse(pl)));
  tasks.push(run("Company job boards", () => sources.companyBoards({ industries: p.industries })));
  await Promise.all(tasks);
  return { jobs, report };
}

// ---------- 2. Keep only legit postings ----------

export function vet(jobs, p) {
  const dropped = { noApplyLink: 0, tooOld: 0, looksLikeScam: 0, duplicate: 0, wrongPlace: 0 };
  const seen = new Map(), ids = new Set(), out = [];
  const rank = j => (j.source === "Company Site" ? 0 : j.applyIsDirect ? 1 : 2);
  for (const j of jobs) {
    if (ids.has(j.id)) continue;   // the same posting found by two searches
    ids.add(j.id);
    if (!j.title || !j.company || !/^https:\/\//.test(j.applyUrl || "")) { dropped.noApplyLink++; continue; }
    const age = daysAgo(j.postedAt);
    // Still live on the employer's own board means it's open, so those get twice as long before they count as old.
    if (age !== null && age > p.wants.maxAgeDays * (j.source === "Company Site" ? 2 : 1)) { dropped.tooOld++; continue; }
    if (SCAM.test(j.description)) { dropped.looksLikeScam++; continue; }
    if (!placeFits(j, p)) { dropped.wrongPlace++; continue; }
    const key = norm(j.company) + "|" + norm(j.title).replace(/\b(remote|us|usa|united states)\b/g, "").trim();
    const prev = seen.get(key);
    if (prev) { dropped.duplicate++; if (rank(j) < rank(prev)) { out[out.indexOf(prev)] = j; seen.set(key, j); } continue; }
    seen.set(key, j); out.push(j);
  }
  return { jobs: out, dropped };
}

function placeFits(j, p) {
  // Remote means remote from where they live: a "remote" job hiring only in Germany or Pakistan doesn't count.
  if (p.wants.remote && j.remote) return p.wants.country !== "US" || !NON_US.test(norm(j.location)) || US_OK.test(norm(j.location));
  return p.wants.cities.some(c => inCity(j.location, c));   // Dallas, TX takes in Fort Worth, Irving and Plano, not Dallas, GA
}

// ---------- 3. Score how well each one fits ----------

const sentences = text => String(text || "").split(/(?<=[.!?])\s+|\n+/).map(norm).filter(Boolean);

// The job's own words: its title and duties, minus lines the company repeats in every posting.
export function ownText(j, common = new Set()) {
  return norm(j.title) + " " + sentences(j.description).filter(x => !common.has(x) && !BOILERPLATE.test(x)).join(" ");
}

// Sentences that show up in most of one company's postings (About Us, mission, benefits).
export function companyBoilerplate(jobs) {
  const by = new Map();
  for (const j of jobs) { const k = norm(j.company); if (!by.has(k)) by.set(k, []); by.get(k).push(new Set(sentences(j.description))); }
  const common = new Set();
  for (const list of by.values()) {
    if (list.length < 3) continue;
    const n = new Map();
    for (const set of list) for (const x of set) if (x.length > 20) n.set(x, (n.get(x) || 0) + 1);
    for (const [x, c] of n) if (c / list.length >= 0.6) common.add(x);
  }
  return common;
}

// Which of the person's fields the job's own duties are in, and which other field it's clearly about.
export function fieldFit(j, p, own) {
  const mine = new Set(p.industries.map(i => i.toLowerCase()));
  const words = [...mine].flatMap(i => FIELD_WORDS[i] || OTHER_FIELDS[i] || [i]);
  const myHits = [...new Set(words.filter(w => has(own, w)))];
  const companyShared = (j.industries || []).filter(i => mine.has(i) && i !== "saas");
  let other = null, otherHits = 0;
  for (const [field, list] of Object.entries(OTHER_FIELDS)) {
    if (mine.has(field) || (field === "restaurants" && mine.has("hospitality"))) continue;
    const n = list.filter(w => has(own, w)).length + list.filter(w => has(j.title, w)).length;
    if (n >= 2 && n > otherHits) { other = field; otherHits = n; }
  }
  return { myHits, companyShared, other };
}

export function score(j, p, common) {
  const title = j.title, text = ownText(j, common);
  const reasons = [], flags = [];
  let s = 0;

  // The role (up to 40)
  let best = 0, hit = "";
  // The roles they listed first count a little more.
  p.wants.roles.forEach((role, i) => {
    const words = ROLE_WORDS[role] || [role], top = 40 - Math.min(i, 4), near = 32 - Math.min(i, 4);
    if (has(title, role)) { if (top > best) { best = top; hit = role; } }
    else if (words.some(w => has(title, w))) { if (near > best) { best = near; hit = role; } }
    else if (words.some(w => has(j.description, w)) && 10 > best) { best = 10; hit = role; }
  });
  if (best < 20) {
    const past = p.pastTitles.find(t => has(title, t) || norm(t).split(" ").filter(w => w.length > 3 && !GENERIC.has(w)).some(w => has(title, w)));
    if (past) { best = Math.max(best, 20); reasons.push(`Close to your work as ${past}`); }
  }
  if (best >= 28) reasons.push(`${titleCase(hit)} role`);
  else if (best === 10) reasons.push(`Mentions ${hit} work`);
  s += best;

  // What they know (up to 25)
  const found = [...new Set(p.skills.filter(k => k.length > 1 && has(text, k)))];
  s += Math.min(25, found.length * 5);
  if (found.length) reasons.push(`Asks for ${found.slice(0, 3).join(", ")}`);

  // Their field (up to 20): the work itself is in an industry they come from
  const field = fieldFit(j, p, text);
  const fieldName = i => FIELD_NAMES[i] || titleCase(i);
  let fieldPts = 0;
  if (field.myHits.length >= 2) fieldPts = 20;
  else if (field.myHits.length === 1) fieldPts = 12;
  else if (field.companyShared.length) fieldPts = 8;
  const hitWords = field.myHits.filter(w => !field.myHits.includes(w + "s"));   // "contractors", not "contractor, contractors"
  if (hitWords.length) reasons.push(`${titleCase(hitWords.slice(0, 2).join(", "))} work, like your background`);
  else if (field.companyShared.length) reasons.push(`Company works in ${fieldName(field.companyShared[0])}`);
  s += fieldPts;

  // Where (15, already filtered)
  s += 15;
  reasons.push(j.remote && p.wants.remote ? "Remote" : `In ${j.location}`);

  // Pay (up to 10)
  const floor = p.wants.payFloor;
  if (j.payMax) {
    if (!floor || j.payMax >= floor) { s += 10; reasons.push(`Pays up to ${money(j.payMax)}`); }
    else flags.push(`Pay Under ${money(floor)}`);
  } else { s += 4; flags.push("Pay Not Listed"); }

  // Freshness (up to 10)
  const age = daysAgo(j.postedAt);
  if (age === null) flags.push("Date Not Listed");
  else s += age <= 7 ? 10 : age <= 14 ? 7 : 4;

  // Watch-outs
  const stretch = (EXEC.test(title) && p.years < 10) || (SENIOR.test(title) && p.years < 5);
  if (stretch) { s -= 15; flags.push("Wants More Years"); }
  const underFloor = floor && j.payMax && j.payMax < floor;
  // A kind of role they ruled out, unless they asked for that very kind of title (Inside Sales under Quoting).
  // Someone who has carried a quota before isn't ruling out sales; a counter or inside sales title doesn't count.
  const avoid = p.wants.avoid.filter(a => !p.pastTitles.some(t => a === "sales" ? SOLD_BEFORE.test(t) && !/\b(counter|inside)\b/i.test(t) : (AVOID_WORDS[a] || [a]).some(w => has(t, w))));
  const asked = p.wants.roles.flatMap(r => ROLE_WORDS[r] || [r]);
  const avoidHit = avoid.find(a => { const ws = AVOID_WORDS[a] || [a];
    return ws.some(w => has(title, w)) && !asked.some(r => has(title, r) && ws.some(w => has(r, w)))
      && !(a === "sales" && /\b(inside sales|counter)\b/i.test(title) && p.pastTitles.some(t => /\b(counter|inside)\b/i.test(t))); });   // counter people can still take inside sales desks
  const entry = ENTRY.test(title) && p.years >= 5;
  if (entry) { s -= 15; flags.push("Entry Level"); }
  const salesy = SALESY.test(j.description);
  if (avoidHit) { s -= 40; flags.push(`${titleCase(avoidHit)} Role`); }
  else if (salesy && avoid.includes("sales")) { s -= 15; flags.push("Partly Sales"); }
  else if (salesy) flags.push("Quota or Commission");   // fine for someone who sells, but never a surprise

  const theirWork = norm([...p.pastTitles, ...p.wants.roles].join(" "));
  const otherWork = Object.keys(OTHER_WORK).find(k => OTHER_WORK[k].test(norm(title)) && !OTHER_WORK[k].test(theirWork));
  const technical = TECHNICAL.test(norm(title)) && !TECHNICAL.test(theirWork);
  if (technical) { s -= 10; flags.push("Technical Role"); }
  const offField = field.other && !field.myHits.length;   // even at a company in their field, the job itself is about something else

  const raw = s;
  s = Math.max(0, Math.min(100, Math.round(s)));
  const no = why => ({ ...j, score: 0, fit: null, reasons, flags, ...(why ? { hiddenBecause: why } : {}) });
  if (avoidHit) return no(`${titleCase(avoidHit)} role`);   // they said no to this kind of role
  if (best < 20) return no("");   // the title has to fit a role they want or have done; a mention in the description isn't enough
  if (otherWork) return no(`${otherWork} job`);   // HR Coordinator isn't a coordinator job for someone from construction
  if (offField) return no(`${titleCase(field.other)} industry, not your background`);   // the Account Manager selling beds to hotels
  let fit = (salesy && avoid.includes("sales")) ? "sales" : s >= 70 ? "strong" : s >= 50 ? "good" : s >= 35 ? "reach" : null;
  if (!fieldPts && (fit === "strong" || fit === "good")) { fit = "reach"; flags.push("Outside Your Field"); }   // the right title in an unrelated industry is a long shot, not a match
  if ((stretch || underFloor || entry || technical) && (fit === "strong" || fit === "good")) fit = "reach";   // a stretch is never sold as a sure thing
  if (fit === "strong" && COMMISSION_ONLY.test(j.description)) { fit = "good"; flags.push("Commission Only"); }   // no base pay is never a strong fit
  return { ...j, score: s, raw, fit, reasons, flags, ageDays: age === null ? null : Math.floor(age) };
}

const titleCase = s => String(s).replace(/\b\w/g, c => c.toUpperCase());

// ---------- Check one posting someone found ----------

// "Would I be a good fit for this?" One posting in, the same judgment the search uses out, plus what it asks for that they lack.
export function checkJob(job, profile) {
  const p = cleanProfile(profile);
  const j = { remote: true, ...job, description: String(job.description || "") };
  const r = score(j, p);
  const text = norm(j.description);
  const gaps = [], headsUp = [];
  const yrs = [...j.description.matchAll(/(\d{1,2})\s*\+?\s*(?:or more\s+)?years/gi)].map(m => Number(m[1])).filter(n => n < 30);
  if (yrs.length && Math.max(...yrs) > p.years) gaps.push(`Asks for ${Math.max(...yrs)}+ years; you have ${p.years}`);
  const travel = j.description.match(/travel[^.]{0,40}?(\d{2})\s*%|(\d{2})\s*%[^.]{0,30}travel/i);
  if (travel && Number(travel[1] || travel[2]) >= 25) headsUp.push(`Travel up to ${travel[1] || travel[2]}%`);
  if (SALESY.test(j.description)) headsUp.push("Has quota or commission language");
  const verdict = r.fit === "strong" ? "Strong fit" : r.fit === "good" ? "Good fit" : r.fit === "reach" ? "A reach" : r.fit === "sales" ? "Sales role" : "Not a fit";
  return { verdict, fit: r.fit, score: r.score, reasons: r.reasons, flags: r.flags, hiddenBecause: r.hiddenBecause || null, gaps, headsUp,
    check: postingCheck({ ...j, remote: !!job.remote }), knockouts: knockouts(j, p) };
}

// ---------- The whole run ----------

// The same posting under a new id (company, title and place match) is a repost.
export const signature = j => [norm(j.company), norm(j.title).replace(/\b(remote|us|usa|united states)\b/g, "").trim(), norm(j.location)].join("|");

export async function match(profile, env = {}, sources = S, store = null) {
  const p = cleanProfile(profile);
  if (!p.wants.roles.length) throw new Error("Add at least one role to look for.");
  if (!p.wants.remote && !p.wants.cities.length) throw new Error("Add remote or at least one city.");
  const started = Date.now();
  const { jobs: raw, report } = await fetchAll(p, env, sources);
  const { jobs: vetted, dropped } = vet(raw, p);
  const order = { strong: 0, good: 1, reach: 2, sales: 3 };
  const common = companyBoilerplate(vetted);
  const all = vetted.map(j => score(j, p, common));
  const scored = all.filter(j => j.fit).sort((a, b) => order[a.fit] - order[b.fit] || b.raw - a.raw);
  // How many right-sounding titles were hidden and why, so the person can see the filter working.
  const hidden = {};
  for (const j of all) if (j.hiddenBecause) hidden[j.hiddenBecause] = (hidden[j.hiddenBecause] || 0) + 1;
  // The app's own record of what it has seen on company boards: first and last seen, and reposts.
  let seen = {};
  if (store) { try { seen = await store.record(vetted.filter(j => j.source === "Company Site").map(j => ({ id: j.id, sig: signature(j) }))); } catch (e) { report.push({ name: "Posting history", ok: false, count: 0, error: String(e.message || e) }); } }
  const jobs = scored.slice(0, 100).map(({ description, raw, ...j }) => ({ ...j, snippet: description.slice(0, 280), description: description.slice(0, 4000),
    check: postingCheck({ ...j, description }, seen[j.id] || null), knockouts: knockouts({ ...j, description }, p), reposts: seen[j.id]?.reposts || 0 }));
  return {
    ranAt: new Date().toISOString(), tookMs: Date.now() - started,
    counts: { found: raw.length, legit: vetted.length, matched: scored.length, shown: jobs.length,
      strong: scored.filter(j => j.fit === "strong").length },
    dropped, hidden, sources: report, jobs,
  };
}

// ---------- Is a saved posting still up? ----------

// Re-reads the company boards behind saved postings. Answers open, gone or unknown (sites we can't re-check).
export async function verify(ids = [], sources = S) {
  const out = {}, boards = new Map(), indexed = [];
  for (const id of ids.slice(0, 60)) {
    const m = String(id).match(/^(gh|lever|ashby):([^:]+):/);
    // Big employer boards are searched, not read whole, so the job index (refreshed every 4 hours) answers for them.
    if (!m) { if (sources.indexStatus && /^(wd|icims|ukg|sr|oracle):/.test(id)) indexed.push(id); else out[id] = "unknown"; continue; }
    const ats = { gh: "greenhouse", lever: "lever", ashby: "ashby" }[m[1]];
    const key = ats + ":" + m[2];
    if (!boards.has(key)) boards.set(key, { ats, token: m[2], ids: [] });
    boards.get(key).ids.push(id);
  }
  await Promise.all([...boards.values()].map(async b => {
    try {
      const live = new Set((await sources.readBoard({ ats: b.ats, token: b.token, name: "" })).map(j => j.id));
      for (const id of b.ids) out[id] = live.has(id) ? "open" : "gone";
    } catch { for (const id of b.ids) out[id] = "unknown"; }
  }));
  if (indexed.length) {
    try { const live = await sources.indexStatus(indexed); for (const id of indexed) out[id] = live[id] === true ? "open" : live[id] === false ? "gone" : "unknown"; }
    catch { for (const id of indexed) out[id] = "unknown"; }
  }
  return { checkedAt: new Date().toISOString(), status: out };
}
