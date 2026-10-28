// Offline tests: fetch is replaced with sample responses shaped like each site's real API.
import test from "node:test";
import assert from "node:assert/strict";
import { match, score, cleanProfile, checkJob, vet } from "../src/match.js";
import { payFromText } from "../src/sources/index.js";

const day = n => new Date(Date.now() - n * 864e5).toISOString();

const FIXTURES = {
  "remotive.com": () => ({ jobs: [
    { id: 1, title: "Implementation Specialist", company_name: "SupplyHouse.com", candidate_required_location: "USA", salary: "$85,000 - $100,000",
      publication_date: day(3), url: "https://remotive.com/remote-jobs/1", description: "<p>Onboard lumber yard customers onto our ERP. Quoting and purchasing experience a plus.</p>" },
    { id: 2, title: "Account Executive", company_name: "SellCo", candidate_required_location: "USA", salary: "",
      publication_date: day(2), url: "https://remotive.com/remote-jobs/2", description: "Hit quota, commission uncapped." },
    { id: 3, title: "Onboarding Coordinator", company_name: "OldCo", candidate_required_location: "USA", salary: "",
      publication_date: day(90), url: "https://remotive.com/remote-jobs/3", description: "Old posting." },
    { id: 4, title: "Customer Onboarding Manager", company_name: "ScamCo", candidate_required_location: "USA", salary: "",
      publication_date: day(1), url: "https://remotive.com/remote-jobs/4", description: "Message us on Telegram to start, check deposit required." },
  ] }),
  "jobicy.com": () => ({ jobs: [
    { id: 9, jobTitle: "Customer Success Manager", companyName: "TradeApp", jobGeo: "USA", annualSalaryMin: 70000, annualSalaryMax: 82000,
      pubDate: day(10), url: "https://jobicy.com/jobs/9", jobDescription: "Help HVAC and plumbing contractors. Renewals and quota." },
  ] }),
  "www.themuse.com": url => url.includes("Dallas") ? { results: [
    { id: 5, name: "Operations Coordinator", company: { name: "Muse Dallas Co" }, locations: [{ name: "Dallas, TX" }],
      publication_date: day(5), refs: { landing_page: "https://www.themuse.com/jobs/5" }, contents: "Coordinate vendors and purchasing. $60,000 - $72,000." },
    { id: 6, name: "Operations Coordinator", company: { name: "Muse Denver Co" }, locations: [{ name: "Denver, CO" }],
      publication_date: day(5), refs: { landing_page: "https://www.themuse.com/jobs/6" }, contents: "Denver only." },
  ] } : { results: [] },
  "boards-api.greenhouse.io": url => url.includes("/supplyhouse/") ? { jobs: [
    { id: 77, title: "Implementation Specialist", absolute_url: "https://boards.greenhouse.io/buildsoft/77", location: { name: "Remote - US" },
      updated_at: day(2), content: "&lt;p&gt;Onboard lumber yards. ERP and purchasing. $92,000 - $110,000&lt;/p&gt;" },
    { id: 78, title: "Safety Manager", absolute_url: "https://boards.greenhouse.io/supplyhouse/78", location: { name: "Remote - US" },
      updated_at: day(2), content: "Run warehouse safety training for the project team. $110,000 - $134,000" },
    { id: 79, title: "Senior Manager of UX Design", absolute_url: "https://boards.greenhouse.io/supplyhouse/79", location: { name: "Remote - US" },
      updated_at: day(2), content: "Lead design for our windows and doors catalog. $150,000 - $195,000" },
    { id: 81, title: "Client Success Account Executive", absolute_url: "https://boards.greenhouse.io/supplyhouse/81", location: { name: "Remote - US" },
      updated_at: day(2), content: "Grow accounts. Onboarding new customers." },
    { id: 82, title: "Graduate Customer Success Manager", absolute_url: "https://boards.greenhouse.io/supplyhouse/82", location: { name: "Remote - US" },
      updated_at: day(2), content: "Start your career. Training provided." },
    { id: 83, title: "Network Engineer", absolute_url: "https://boards.greenhouse.io/supplyhouse/83", location: { name: "Remote - US" },
      updated_at: day(2), content: "Support onboarding of new hires. ERP and training. $90,000 - $110,000" },
    { id: 80, title: "Purchasing Coordinator", absolute_url: "https://boards.greenhouse.io/supplyhouse/80", location: { name: "Remote - US" },
      updated_at: day(2), content: "Buy plumbing parts from vendors. $70,000 - $95,000" },
  ] } : (() => { throw new Error("HTTP 404"); })(),
  // Right-sounding titles that aren't Gus's kind of job, plus Doxel's About Us line in every posting.
  "api.lever.co": url => url.includes("/doxel") ? [
    { id: "l1", text: "Account Manager, Hotel Partnerships", categories: { location: "Remote - US" }, workplaceType: "remote", createdAt: Date.now() - 2 * 864e5,
      hostedUrl: "https://jobs.lever.co/doxel/l1", descriptionPlain: "Doxel builds AI for construction contractors on every jobsite. Manage hotel and resort accounts, selling mattresses and bedding to hospitality groups. $95,000 - $120,000" },
    { id: "l2", text: "HR Coordinator", categories: { location: "Remote - US" }, workplaceType: "remote", createdAt: Date.now() - 2 * 864e5,
      hostedUrl: "https://jobs.lever.co/doxel/l2", descriptionPlain: "Doxel builds AI for construction contractors on every jobsite. Coordinate interviews and new hire paperwork. $85,000 - $95,000" },
    { id: "l3", text: "Implementation Consultant", categories: { location: "Remote - Germany" }, workplaceType: "remote", createdAt: Date.now() - 2 * 864e5,
      hostedUrl: "https://jobs.lever.co/doxel/l3", descriptionPlain: "Doxel builds AI for construction contractors on every jobsite. Onboard general contractors in the DACH region." },
    { id: "l4", text: "Implementation Manager, Health Systems", categories: { location: "Remote - US" }, workplaceType: "remote", createdAt: Date.now() - 2 * 864e5,
      hostedUrl: "https://jobs.lever.co/doxel/l4", descriptionPlain: "Doxel builds AI for construction contractors on every jobsite. Roll out our platform to hospital clinical teams and patient care units. $100,000 - $120,000" },
  ] : [],
  "api.ashbyhq.com": url => url.includes("/higharc") ? { jobs: [
    { id: "a1", title: "Senior Director, Implementation", location: "Remote", isRemote: true, publishedAt: day(4),
      jobUrl: "https://jobs.ashbyhq.com/higharc/a1", descriptionPlain: "Lead the implementation org. Homebuilders.",
      compensation: { summaryComponents: [{ compensationType: "Salary", minValue: 180000, maxValue: 220000, interval: "1 YEAR" }] } },
  ] } : (() => { throw new Error("HTTP 404"); })(),
  "jsearch.p.rapidapi.com": () => ({ data: [
    { job_id: "js1", job_title: "Implementation Consultant", employer_name: "Hyphen Solutions", job_publisher: "LinkedIn",
      job_apply_link: "https://www.linkedin.com/jobs/view/1", job_apply_is_direct: false, job_city: "Dallas", job_state: "TX",
      job_is_remote: false, job_posted_at_datetime_utc: day(6), job_min_salary: null, job_max_salary: null, job_description: "Homebuilder options and pricing." },
  ] }),
};

function fakeFetch() {
  globalThis.fetch = async url => {
    const host = new URL(url).host, f = FIXTURES[host];
    if (!f) return { ok: false, status: 404, json: async () => ({}) };
    try { const body = f(url); return { ok: true, status: 200, json: async () => body }; }
    catch (e) { return { ok: false, status: 404, json: async () => ({}) }; }
  };
}

const GUS = {
  name: "Gus", years: 7,
  pastTitles: ["Project Manager", "Purchasing Agent", "Store Manager"],
  skills: ["quoting", "purchasing", "ERP", "lumber", "vendor management", "training"],
  industries: ["construction-tech", "building-materials"],
  wants: { roles: ["implementation", "onboarding", "customer success", "coordinator"], remote: true, cities: ["Dallas, TX"], payFloor: 90000, avoid: ["sales"] },
};

test("reads pay out of posting text", () => {
  assert.deepEqual(payFromText("$85,000 - $100,000"), { payMin: 85000, payMax: 100000 });
  assert.deepEqual(payFromText("pays $40-$65/hr"), { payMin: 83200, payMax: 135200 });
  assert.deepEqual(payFromText("$90k - $115k"), { payMin: 90000, payMax: 115000 });
  assert.equal(payFromText("competitive pay"), null);
});

test("Gus: legit, fitting jobs come back ranked with reasons", async () => {
  fakeFetch();
  const r = await match(GUS);
  const titles = r.jobs.map(j => `${j.company}: ${j.title} [${j.fit}]`);
  console.log(titles.join("\n"), "\n", r.dropped);

  const top = r.jobs[0];
  assert.equal(top.title, "Implementation Specialist");
  assert.equal(top.fit, "strong");
  assert.equal(top.source, "Company Site", "the employer's own posting wins over the repost");
  assert.ok(top.reasons.includes("Remote"));
  assert.ok(top.reasons.some(x => x.startsWith("Pays up to")));

  assert.equal(r.dropped.tooOld, 1);
  assert.equal(r.dropped.looksLikeScam, 1);
  assert.equal(r.dropped.duplicate, 1);
  assert.ok(r.dropped.wrongPlace >= 1, "Denver job dropped");
  assert.ok(!titles.some(t => t.includes("Account Executive") && !t.includes("[sales]")), "sales roles never pass as non-sales");
  const director = r.jobs.find(j => j.title.includes("Senior Director"));
  assert.ok(director.flags.includes("Wants More Years") && director.fit === "reach", "a director job is a reach at 7 years");
  const dallas = r.jobs.find(j => j.company === "Muse Dallas Co");
  assert.equal(dallas.fit, "reach", "pay under the floor is never a strong fit");
  const csm = r.jobs.find(j => j.title === "Customer Success Manager");
  assert.equal(csm?.fit, "sales", "quota in the description flags it");
  assert.ok(r.sources.some(s => s.name === "Company job boards" && s.ok));
  assert.ok(!r.jobs.some(j => j.title === "Safety Manager"), "sharing the word Manager isn't a fit");
  assert.ok(!r.jobs.some(j => j.title.includes("UX Design")), "a past title's generic words don't count as skills");
  assert.ok(!r.jobs.some(j => j.title.includes("Account Executive")), "account executive counts as sales");
  assert.equal(r.jobs.find(j => j.title.startsWith("Graduate"))?.fit, "reach", "entry-level roles are a reach at 7 years");
  assert.ok(!r.jobs.some(j => j.title === "Network Engineer"), "a role word in the description alone isn't a fit");
  const buyer = r.jobs.find(j => j.title === "Purchasing Coordinator");
  assert.ok(buyer && buyer.reasons.some(x => /coordinator|Purchasing Agent/i.test(x)), "a real overlap with past work still counts");
});

test("matches on background, not on a shared word", async () => {
  fakeFetch();
  const r = await match(GUS);
  const titles = r.jobs.map(j => j.title);
  assert.ok(!titles.includes("Account Manager, Hotel Partnerships"), "an account manager selling beds to hotels isn't for someone from construction");
  assert.ok(!titles.includes("HR Coordinator"), "HR Coordinator isn't a coordinator job for him");
  assert.ok(!titles.includes("Implementation Consultant"), "remote in Germany isn't remote for someone in the US");
  assert.ok(!titles.includes("Implementation Manager, Health Systems"), "a hospital rollout is outside his field even at a construction company");
  assert.ok(Object.keys(r.hidden).some(k => /Hospitality/.test(k)) && Object.keys(r.hidden).some(k => /HR/.test(k)), "hidden jobs are counted with a reason");
  const top = r.jobs[0];
  assert.ok(top.reasons.some(x => /like your background/.test(x)), "the top match says how it fits his background");
});

test("checks one posting someone pastes in", () => {
  const forma = checkJob({ title: "Forma Implementation Consultant", company: "Autodesk", description: "Lead implementation and training for general contractors and trade contractors in construction. 5+ years in the AEC industry. Ability to travel up to 50%." }, GUS);
  assert.ok(["strong", "good"].includes(forma.fit));
  assert.ok(forma.headsUp.includes("Travel up to 50%"));
  const hotel = checkJob({ title: "Account Manager", company: "BedCo", description: "Sell mattresses to hotels and resorts across the hospitality industry." }, { ...GUS, wants: { ...GUS.wants, roles: [...GUS.wants.roles, "customer success"] } });
  assert.equal(hotel.verdict, "Not a fit");
  assert.ok(checkJob({ title: "Implementation Lead", description: "10+ years required." }, GUS).gaps[0].startsWith("Asks for 10+ years"));
});

test("JSearch only runs when a key is set", async () => {
  fakeFetch();
  const without = await match(GUS);
  assert.ok(!without.sources.some(s => s.name.startsWith("Google for Jobs")));
  const withKey = await match(GUS, { JSEARCH_KEY: "test" });
  assert.ok(withKey.jobs.some(j => j.company === "Hyphen Solutions"));
});

test("a stranger: restaurant manager wanting Charlotte operations, no remote", async () => {
  fakeFetch();
  const r = await match({ name: "Sam", years: 4, pastTitles: ["Restaurant Manager"], skills: ["scheduling", "inventory"],
    industries: [], wants: { roles: ["operations"], remote: false, cities: ["Charlotte, NC"], payFloor: 60000 } });
  assert.ok(r.jobs.every(j => /charlotte/i.test(j.location)), "only Charlotte jobs");
  assert.ok(!r.sources.some(s => s.name.startsWith("Remotive")), "no remote boards when remote is off");
});

test("asks for the basics", async () => {
  await assert.rejects(() => match({ wants: { roles: [] } }), /role/);
  await assert.rejects(() => match({ wants: { roles: ["x"], remote: false, cities: [] } }), /city/);
  assert.equal(cleanProfile({}).wants.maxAgeDays, 30);
});

test("remote in a foreign city isn't remote in the US", () => {
  const p = cleanProfile({ wants: { roles: ["implementation"], remote: true } });
  const job = (id, location) => ({ id, title: "Implementation Consultant " + id, company: "Motive", location, remote: true, applyUrl: "https://x.co/" + id, description: "", postedAt: day(1) });
  const { jobs } = vet([job(1, "Monterrey - Remote"), job(2, "Remote - Toronto"), job(3, "Remote - US"), job(4, "Canada, USA")], p);
  assert.deepEqual(jobs.map(j => j.id), [3, 4]);
});

test("reads a resume into a profile", async () => {
  const { parseResume } = await import("../src/resume.js");
  const r = parseResume(`JANE DOE
OPERATIONS · LOGISTICS
EXPERIENCE
Restaurant General Manager
Olive Garden, Charlotte, NC
March 2015 - June 2022
Ran a team of 40. Scheduling, inventory, P&L, food cost and vendor negotiation.
Warehouse Supervisor, Amazon   2022 – Present
Led inbound receiving and shipping for a fulfillment center; trucking carriers and freight schedules. Excel and SAP daily.
EDUCATION
Associate's degree, 2012`, new Date("2026-10-23"));
  assert.deepEqual(r.pastTitles, ["Restaurant General Manager", "Warehouse Supervisor"]);
  assert.equal(r.years, 11);
  for (const s of ["scheduling", "inventory", "P&L", "Excel", "SAP", "negotiation"]) assert.ok(r.skills.includes(s), s);
  assert.ok(r.industries.includes("logistics"));
  assert.ok(!r.pastTitles.some(t => /OPERATIONS/.test(t)), "an all-caps headline isn't a past job");
  assert.ok(!r.pastCompanies.includes("Present"), "the end of a date range isn't a company");
});

// ---------- Job index ----------
import { crawl, probe, toRow, fromRow, indexWords } from "../src/crawl.js";
import { fetchAll as fetchAll2 } from "../src/match.js";

test("crawl reads every board and keyword source, drops rows without a real apply link, and dedupes", async () => {
  const src = {
    readBoard: async b => b.token === "bad" ? Promise.reject(new Error("HTTP 404")) : [{ id: `gh:${b.token}:1`, title: "Purchasing Coordinator", company: b.name, applyUrl: "https://x.test/1" }, { id: `gh:${b.token}:2`, title: "No Link", company: b.name, applyUrl: "" }],
    remotive: async () => [{ id: "remotive:9", title: "Implementation Specialist", company: "R", applyUrl: "https://r.test/9" }],
    jobicy: async () => [], themuse: async () => [],
  };
  const out = await crawl([{ ats: "greenhouse", token: "a", name: "A", industries: ["construction-tech"] }, { ats: "greenhouse", token: "bad", name: "Bad" }], src);
  assert.deepEqual(out.jobs.map(j => j.id).sort(), ["gh:a:1", "remotive:9"]);
  assert.equal(out.jobs.find(j => j.id === "gh:a:1").boardKey, "greenhouse:a");
  assert.deepEqual(out.jobs.find(j => j.id === "gh:a:1").industries, ["construction-tech"]);
  assert.ok(out.report.some(r => r.key === "greenhouse:bad" && !r.ok));
});

test("probe keeps only names with open jobs", async () => {
  const src = { readBoard: async c => c.token === "real" ? [{ title: "Estimator", applyUrl: "https://x.test" }] : Promise.reject(new Error("404")) };
  const out = await probe([{ ats: "lever", token: "real" }, { ats: "lever", token: "nope" }], src);
  assert.deepEqual(out.map(o => o.token), ["real"]);
});

test("a posting survives the trip into the index and back", () => {
  const j = { id: "gh:a:1", boardKey: "greenhouse:a", title: "Estimator", company: "A", location: "Remote", remote: true, payMin: 70000, payMax: 90000, postedAt: "2026-10-20T00:00:00Z", firstPublished: "2026-10-20T00:00:00Z", applyUrl: "https://x.test", description: "d", source: "Company Site", industries: ["construction-tech"] };
  const back = fromRow({ ...toRow(j, "2026-10-24T00:00:00Z"), first_seen: "2026-10-21T00:00:00Z" });
  for (const k of ["id", "title", "company", "remote", "payMin", "payMax", "applyUrl", "source"]) assert.equal(back[k], j[k]);
});

test("index words come from wanted roles and past titles", () => {
  const w = indexWords({ wants: { roles: ["estimating"] }, pastTitles: ["Senior Counter Sales"] });
  assert.ok(w.includes("estimator") && w.includes("counter sales"));
});

test("a search reads the index first and skips the live sites when it has jobs", async () => {
  const calls = [];
  const src = { index: async () => [{ id: "gh:a:1", title: "Estimator", company: "A", applyUrl: "https://x.test" }], remotive: async () => { calls.push("remotive"); return []; }, jobicy: async () => [], themuse: async () => [], companyBoards: async () => { calls.push("boards"); return { jobs: [] }; } };
  const out = await fetchAll2({ wants: { roles: ["estimating"], remote: true, cities: [] }, industries: [] }, {}, src);
  assert.equal(out.jobs.length, 1);
  assert.deepEqual(calls, []);
  const empty = { ...src, index: async () => [] };
  await fetchAll2({ wants: { roles: ["estimating"], remote: true, cities: [] }, industries: [] }, {}, empty);
  assert.ok(calls.includes("boards"), "falls back to live sites when the index is empty");
});

test("Dallas, TX takes in the whole DFW area and not Dallas, GA", async () => {
  const { inCity } = await import("../src/places.js");
  for (const l of ["Fort Worth, TX", "Irving, Texas", "DFW Metroplex", "Plano, TX, US"]) assert.ok(inCity(l, "Dallas, TX"), l);
  for (const l of ["Dallas, GA", "Arlington, VA", "Houston, TX"]) assert.ok(!inCity(l, "Dallas, TX"), l);
  for (const c of ["Dallas", "DFW", "Dallas-Fort Worth", "Dallas/Fort Worth", "Dallas TX"])
    for (const [l, ok] of [["Dallas, GA", false], ["US-GA-Dallas", false], ["Irving, TX", true], ["US-TX-Plano", true], ["Fort Worth, Texas, United States", true]]) assert.equal(inCity(l, c), ok, `${l} for ${c}`);
});

test("sales titles stay for someone who has sold or asked for quoting work", async () => {
  const { checkJob } = await import("../src/match.js");
  const job = { title: "Inside Sales Estimator", company: "Builders FirstSource", location: "Irving, TX", description: "Quote doors and windows for builders and contractors. Takeoffs from plans for lumber and millwork.", postedAt: new Date().toISOString() };
  const base = { years: 7, industries: ["building-materials"], wants: { roles: ["estimating"], remote: false, cities: ["Dallas, TX"], avoid: ["sales"] } };
  assert.equal(checkJob(job, { ...base, pastTitles: ["Store Manager"] }).hiddenBecause, "Sales role", "ruled out sales and never sold");
  assert.equal(checkJob(job, { ...base, pastTitles: ["Counter Sales"] }).hiddenBecause, null, "has sold at the counter");
  assert.equal(checkJob(job, { ...base, pastTitles: ["Store Manager"], wants: { ...base.wants, roles: ["estimating", "quoting"] } }).hiddenBecause, null, "asked for quoting");
  const outside = { ...job, title: "Outside Sales Representative", description: "Commission only. Call on builders and contractors to sell doors and windows." };
  assert.equal(checkJob(outside, { ...base, pastTitles: ["Counter Sales"] }).hiddenBecause, "Sales role", "counter sales isn't a yes to outside sales");
  assert.equal(checkJob(outside, { ...base, pastTitles: ["Outside Sales Rep"] }).hiddenBecause, null, "has carried a quota");
});
