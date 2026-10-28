// Posting check, knockouts, insider moves, background reading, reposts and the saved-posting re-check.
import test from "node:test";
import assert from "node:assert/strict";
import { postingCheck, knockouts, payLawState } from "../src/trust.js";
import { readBackground, suggestedRoles } from "../src/translate.js";
import { parseResume } from "../src/resume.js";
import { match, verify, checkJob, signature } from "../src/match.js";

const NOW = Date.parse("2026-10-24T12:00:00Z");
const ago = n => new Date(NOW - n * 864e5).toISOString();
const LONG = "You will onboard general contractors onto our platform, run training sessions, and work with the implementation team every day. ".repeat(5);

test("a fresh company-board posting with pay looks real", () => {
  const c = postingCheck({ title: "Implementation Specialist", source: "Company Site", firstPublished: ago(2), payMin: 80000, payMax: 95000, description: LONG, location: "Remote - US", remote: true }, null, NOW);
  assert.equal(c.label, "Looks Real");
  assert.ok(c.fresh);
  assert.ok(c.good.some(g => g.startsWith("Open 2 days, first posted 10-22-2026")));
  assert.ok(c.good.includes("Pay Listed"));
  assert.deepEqual(c.warn, []);
});

test("old, reposted and thin postings are called likely stale, with the reasons", () => {
  const c = postingCheck({ title: "Project Coordinator", source: "Company Site", firstPublished: ago(120), description: "Join us." },
    { lastSeen: ago(0), reposts: 2, repostFirstSeen: ago(200) }, NOW);
  assert.equal(c.label, "Likely Stale");
  assert.ok(c.warn.some(w => w.startsWith("Open 120 days")));
  assert.ok(c.warn.some(w => w.startsWith("Reposted 2 Times Since")));
  assert.ok(c.warn.some(w => w.startsWith("Thin Description")));
});

test("talent-pool postings are labeled pipeline, not fake", () => {
  const c = postingCheck({ title: "General Application", firstPublished: ago(5), description: LONG + " Join our talent community for future openings." }, null, NOW);
  assert.equal(c.label, "Pipeline");
});

test("entry level asking for many years is flagged", () => {
  const c = postingCheck({ title: "Estimator", firstPublished: ago(3), description: LONG + " This is an entry-level role. 7+ years of estimating required." }, null, NOW);
  assert.ok(c.warn.includes("Asks for Entry Level and 7+ Years"));
  assert.equal(c.label, "Check First");
});

test("missing pay in a pay-law state is called out, but not in Texas", () => {
  const co = postingCheck({ title: "Buyer", firstPublished: ago(3), description: LONG, location: "Denver, CO" }, null, NOW);
  assert.ok(co.warn.includes("Pay Not Listed, Though Colorado Requires It"));
  const tx = postingCheck({ title: "Buyer", firstPublished: ago(3), description: LONG, location: "Dallas, TX" }, null, NOW);
  assert.ok(!tx.warn.some(w => w.startsWith("Pay Not Listed")));
  assert.equal(payLawState("New York, New York"), "NY");
  assert.equal(payLawState("Washington, DC"), "DC");
  assert.equal(payLawState("Seattle, Washington"), "WA");
  assert.equal(payLawState("Austin, TX"), null);
});

test("knockouts compare the posting to the person", () => {
  const d = "Requires 5+ years in purchasing. OSHA 30 required. CDL preferred. Travel up to 60% to jobsites. Some weekends. Bachelor's degree or equivalent experience. Must be authorized to work in the US. 3 days a week in the office.";
  const k = knockouts({ description: d }, { years: 7, skills: ["Excel"], pastTitles: ["Purchasing Agent"] });
  const by = Object.fromEntries(k.map(x => [x.need, x]));
  assert.equal(by["5+ Years"].status, "ok");
  assert.equal(by["OSHA 30"].status, "miss");
  assert.equal(by["CDL"].status, "check");
  assert.equal(by["Travel 60%"].status, "check");
  assert.equal(by["Nights, Weekends or On-Call"].status, "check");
  assert.equal(by["Bachelor's Degree"].note, "Or equivalent experience");
  assert.equal(by["US Work Authorization"].status, "ok");
  assert.ok(by["3 Days a Week in the Office"]);
  const withCert = knockouts({ description: d }, { years: 4, skills: ["OSHA 30"] });
  assert.equal(withCert.find(x => x.need === "OSHA 30").status, "ok");
  assert.equal(withCert.find(x => x.need === "5+ Years").status, "check");
});

test("reads trades, counter and purchasing backgrounds the way a recruiter would", () => {
  const b = readBackground(["Counter Sales", "Purchasing Agent", "Superintendent", "HVAC Technician", "Dispatcher"]);
  assert.deepEqual(b.map(x => x.key), ["counter", "purchasing", "superintendent", "tech", "dispatch"]);
  assert.ok(b[0].roles.includes("purchasing"));
  assert.ok(b[0].say[0].was && b[0].say[0].now);
  assert.ok(b[0].numbers.length >= 2);
  assert.deepEqual(readBackground(["Purchasing Agent", "Senior Buyer"]).map(x => x.titles), [["Purchasing Agent", "Senior Buyer"]]);
  assert.equal(suggestedRoles(["Purchasing Agent", "Senior Buyer"])[0], "purchasing");
  assert.deepEqual(readBackground(["Chief Wizard"]), []);
});

test("a resume's suggested roles include what the background points to", () => {
  const r = parseResume("Superintendent | Moore Builders\n2015 - 2022\nForeman | Moore Builders\n2010 - 2015\nRan crews on commercial jobsites. OSHA 30.");
  assert.ok(r.suggestedRoles.includes("project manager"));
  assert.ok(r.suggestedRoles.includes("safety"));
  assert.ok(r.suggestedRoles.length <= 6);
});

test("the search attaches a posting check, knockouts and history to each job", async () => {
  const sources = {
    remotive: async () => [], jobicy: async () => [], themuse: async () => [],
    companyBoards: async () => ({ jobs: [
      { id: "gh:acme:1", title: "Implementation Specialist", company: "Acme Build", location: "Remote - US", remote: true, payMin: 85000, payMax: 100000,
        postedAt: ago(1), firstPublished: ago(1), applyUrl: "https://boards.greenhouse.io/acme/jobs/1", description: LONG + " OSHA 30 preferred.", source: "Company Site", industries: ["construction-tech"] },
    ], errors: [] }),
  };
  const calls = [];
  const store = { record: async rows => { calls.push(rows); return { "gh:acme:1": { firstSeen: ago(1), lastSeen: ago(0), timesSeen: 3, reposts: 1, repostFirstSeen: ago(60) } }; } };
  const out = await match({ pastTitles: ["Estimator"], years: 6, skills: ["takeoffs"], industries: ["construction-tech"], wants: { roles: ["implementation"], remote: true } }, {}, sources, store);
  const j = out.jobs[0];
  assert.equal(calls[0][0].id, "gh:acme:1");
  assert.equal(calls[0][0].sig, signature(j));
  assert.equal(j.check.label, "Check First");
  assert.ok(j.check.warn.some(w => w.startsWith("Reposted Once")));
  assert.equal(j.knockouts.find(k => k.need === "OSHA 30").status, "check");
  assert.ok(j.description.length > 200);
});

test("a broken history store never breaks the search", async () => {
  const sources = { remotive: async () => [], jobicy: async () => [], themuse: async () => [],
    companyBoards: async () => ({ jobs: [{ id: "gh:acme:2", title: "Implementation Manager", company: "Acme", location: "Remote", remote: true, postedAt: ago(1), applyUrl: "https://x.io/2", description: LONG, source: "Company Site", industries: ["construction-tech"] }], errors: [] }) };
  const out = await match({ pastTitles: ["Estimator"], industries: ["construction-tech"], wants: { roles: ["implementation"], remote: true } }, {}, sources, { record: async () => { throw new Error("down"); } });
  assert.equal(out.jobs.length, 1);
  assert.ok(out.sources.some(s => s.name === "Posting history" && !s.ok));
});

test("re-checking saved postings says open, gone or unknown", async () => {
  const sources = { readBoard: async ({ ats, token }) => {
    if (token === "dead") throw new Error("HTTP 404");
    return [{ id: `${ats === "greenhouse" ? "gh" : ats}:${token}:1` }];
  } };
  const out = await verify(["gh:acme:1", "gh:acme:2", "lever:other:1", "gh:dead:5", "remotive:9"], sources);
  assert.deepEqual(out.status, { "gh:acme:1": "open", "gh:acme:2": "gone", "lever:other:1": "open", "gh:dead:5": "unknown", "remotive:9": "unknown" });
});

test("checking a pasted posting includes the posting check and knockouts", () => {
  const r = checkJob({ title: "Purchasing Coordinator", company: "", description: LONG + " 3+ years in purchasing. CDL required." }, { pastTitles: ["Buyer"], years: 4, wants: { roles: ["purchasing"] } });
  assert.ok(r.check.label);
  assert.equal(r.knockouts.find(k => k.need === "CDL").status, "miss");
});
