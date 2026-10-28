// The big employer hiring systems, read from canned answers shaped like the real ones.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as S from "../src/sources/index.js";
import { toRow } from "../src/crawl.js";

const real = globalThis.fetch;
afterEach(() => { globalThis.fetch = real; });
const calls = [];
// Answers each request from the first route whose pattern matches its URL.
function serve(routes) {
  calls.length = 0;
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), method: opts.method || "GET", body: opts.body });
    const r = routes.find(([re]) => re.test(String(url)));
    if (!r) return new Response("missing", { status: 404 });
    const body = typeof r[1] === "function" ? r[1](String(url), opts) : r[1];
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status: 200 });
  };
}
const ONE = ["purchasing"];

test("Workday: searches, reads new postings in full, skips the ones already indexed", async () => {
  serve([
    [/\/jobs$/, { total: 2, jobPostings: [
      { title: "Purchasing Coordinator", externalPath: "/job/Dallas-TX/Purchasing-Coordinator_R100", locationsText: "Dallas, TX", postedOn: "Posted 2 Days Ago" },
      { title: "Buyer", externalPath: "/job/Irving-TX/Buyer_R101", locationsText: "Irving, TX", postedOn: "Posted 30+ Days Ago" }] }],
    [/Purchasing-Coordinator_R100$/, { jobPostingInfo: { jobDescription: "<p>Issue POs to suppliers. Pay $55,000 - $65,000.</p>", location: "Dallas, TX", startDate: "2026-10-26", externalUrl: "https://graybar.wd1.myworkdayjobs.com/Careers/job/Dallas-TX/Purchasing-Coordinator_R100" } }],
  ]);
  const jobs = await S.workday("graybar.wd1.myworkdayjobs.com/graybar/Careers", "Graybar", { known: new Set(["wd:graybar:R101"]), search: ONE });
  assert.equal(calls[0].url, "https://graybar.wd1.myworkdayjobs.com/wday/cxs/graybar/Careers/jobs");
  assert.equal(JSON.parse(calls[0].body).searchText, "purchasing");
  assert.equal(calls.filter(c => /R101$/.test(c.url)).length, 0, "an indexed posting isn't read again");
  const [a, b] = jobs;
  assert.equal(a.id, "wd:graybar:R100");
  assert.equal(a.description, "Issue POs to suppliers. Pay $55,000 - $65,000.");
  assert.equal(a.payMin, 55000);
  assert.equal(a.firstPublished, "2026-10-26");
  assert.match(a.applyUrl, /^https:\/\/graybar\.wd1/);
  assert.equal(b.known, true);
  assert.equal(b.description, undefined);
  assert.ok(!("description" in toRow(b, "now")), "a known posting keeps the description already stored");
  assert.ok("description" in toRow(a, "now"));
});

test("Workday: a posting not yet read in full and not indexed waits for the next run", async () => {
  serve([[/\/jobs$/, { jobPostings: [{ title: "Buyer", externalPath: "/job/X/Buyer_R1" }] }]]);   // detail answers 404
  assert.deepEqual(await S.workday("h.wd1.myworkdayjobs.com/h/S", "H", { search: ONE }), []);
});

test("iCIMS: finds job links on the search page and reads each job's posting data", async () => {
  const ld = { "@context": "https://schema.org", "@type": "JobPosting", title: "Assistant Project Manager", datePosted: "2026-10-20",
    description: "&lt;p&gt;Run submittals and change orders.&lt;/p&gt;", jobLocation: { address: { addressLocality: "Dallas", addressRegion: "TX" } },
    baseSalary: { value: { minValue: 70000, maxValue: 85000, unitText: "YEAR" } } };
  serve([
    [/jobs\/search/, `<div><a href="https://careers-tdindustries.icims.com/jobs/4321/assistant-project-manager/job?in_iframe=1" class="iCIMS_Anchor"><span>Title</span> Assistant Project Manager</a></div>`],
    [/jobs\/4321/, `<html><script type="application/ld+json">${JSON.stringify(ld)}</script></html>`],
  ]);
  const [j] = await S.icims("careers-tdindustries.icims.com", "TDIndustries", { search: ONE });
  assert.equal(j.id, "icims:careers-tdindustries:4321");
  assert.equal(j.title, "Assistant Project Manager");
  assert.equal(j.location, "Dallas, TX");
  assert.equal(j.description, "Run submittals and change orders.");
  assert.equal(j.payMin, 70000);
  assert.equal(j.postedAt, "2026-10-20");
});

test("UKG: reads the search results and each opportunity's description", async () => {
  serve([
    [/LoadSearchResults/, { opportunities: [{ Id: "abc-1", Title: "Estimator", PostedDate: "2026-10-22T10:00:00Z", Locations: [{ Address: { City: "Plano", State: { Code: "TX" } } }], BriefDescription: "Short." }] }],
    [/OpportunityDetail/, `<script>var opportunity = new US.Opportunity.CandidateOpportunityDetail({"Id":"abc-1","Description":"<p>Build takeoffs from plans.</p>"});\n</script>`],
  ]);
  const [j] = await S.ukg("recruiting.ultipro.com/HIG1007/f95ef15e", "Highland Homes", { search: ONE });
  assert.equal(j.id, "ukg:HIG1007:abc-1");
  assert.equal(j.location, "Plano, TX");
  assert.equal(j.description, "Build takeoffs from plans.");
  assert.equal(j.applyUrl, "https://recruiting.ultipro.com/HIG1007/JobBoard/f95ef15e/OpportunityDetail?opportunityId=abc-1");
});

test("SmartRecruiters and Oracle read the same way", async () => {
  serve([
    [/postings\?/, { content: [{ id: "77", name: "Inventory Coordinator", releasedDate: "2026-10-21T00:00:00Z", location: { city: "Fort Worth", region: "TX", remote: false } }] }],
    [/postings\/77$/, { applyUrl: "https://jobs.smartrecruiters.com/Winsupply1/77", jobAd: { sections: { jobDescription: { text: "<p>Count stock.</p>" } } } }],
  ]);
  const [s] = await S.smartrecruiters("Winsupply1", "Winsupply", { search: ONE });
  assert.equal(s.id, "sr:Winsupply1:77");
  assert.equal(s.description, "Count stock.");
  serve([
    [/recruitingCEJobRequisitions\?/, { items: [{ requisitionList: [{ Id: "9001", Title: "Project Engineer", PostedDate: "2026-10-19", PrimaryLocation: "Dallas, TX, United States" }] }] }],
    [/recruitingCEJobRequisitionDetails/, { items: [{ ExternalDescriptionStr: "<p>RFIs and submittals.</p>" }] }],
  ]);
  const [o] = await S.oracle("eewl.fa.us6.oraclecloud.com/CX_1", "Sundt", { search: ONE });
  assert.equal(o.id, "oracle:eewl:9001");
  assert.equal(o.location, "Dallas, TX");
  assert.equal(o.description, "RFIs and submittals.");
  assert.equal(o.applyUrl, "https://eewl.fa.us6.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/9001");
});

test("posted-ago text turns into a date, and a vague one doesn't", () => {
  const now = Date.parse("2026-10-28T12:00:00Z");
  assert.equal(S.postedAgo("Posted Today", now).slice(0, 10), "2026-10-28");
  assert.equal(S.postedAgo("Posted 3 Days Ago", now).slice(0, 10), "2026-10-25");
  assert.equal(S.postedAgo("Posted 30+ Days Ago", now), null);
});

test("a saved job from a big board is checked against the index", async () => {
  const { verify } = await import("../src/match.js");
  const r = await verify(["wd:graybar:R1", "icims:careers-x:2", "ukg:T:3", "zip:9"], { readBoard: async () => [], indexStatus: async ids => ({ "wd:graybar:R1": true, "icims:careers-x:2": false }) });
  assert.deepEqual(r.status, { "wd:graybar:R1": "open", "icims:careers-x:2": "gone", "ukg:T:3": "unknown", "zip:9": "unknown" });
});
