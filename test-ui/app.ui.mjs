// Click-through test of the app in a real browser, with a stand-in for Supabase.
// The stand-in keeps rows in memory and answers the match function with the real engine over sample postings.
// Run: node test-ui/app.ui.mjs   (screenshots land in test-ui/shots/)
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");   // the copy installed on the machine
import { readFile, mkdir } from "node:fs/promises";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { match, checkJob, verify } from "../engine/src/match.js";
import { parseResume } from "../engine/src/resume.js";
import { readBackground } from "../engine/src/translate.js";

const JSPDF = createRequire(import.meta.url).resolve("jspdf/dist/jspdf.umd.min.js");   // the PDF maker the app loads from cdnjs
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const APP = join(ROOT, "app"), SHOTS = join(ROOT, "test-ui", "shots");
await mkdir(SHOTS, { recursive: true });

const day = n => new Date(Date.now() - n * 864e5).toISOString();
const LONG = " You will work with general contractors and supply houses every day, run onboarding calls, and keep vendor records clean. ".repeat(5);
const BOARD = [
  { id: "gh:buildco:1", title: "Purchasing Coordinator", company: "BuildCo", location: "Remote - US", remote: true, payMin: 62000, payMax: 74000,
    postedAt: day(2), firstPublished: day(2), applyUrl: "https://boards.greenhouse.io/buildco/jobs/1", source: "Company Site", industries: ["construction-tech"],
    description: "Run purchase orders and vendor lead times for our contractor customers. 3+ years in purchasing. OSHA 10 preferred. Some weekends during month end." + LONG },
  { id: "gh:buildco:2", title: "Implementation Specialist", company: "BuildCo", location: "Remote - US", remote: true, payMin: 80000, payMax: 95000,
    postedAt: day(20), firstPublished: day(20), applyUrl: "https://boards.greenhouse.io/buildco/jobs/2", source: "Company Site", industries: ["construction-tech"],
    description: "Onboard lumber yards and distributors onto our quoting and purchasing software. Bachelor's degree or equivalent experience." + LONG },
  { id: "ashby:yardsoft:9", title: "Estimating Specialist", company: "YardSoft", location: "Dallas, TX", remote: false,
    postedAt: day(75), firstPublished: day(75), applyUrl: "https://jobs.ashbyhq.com/yardsoft/9", source: "Company Site", industries: ["construction-tech"],
    description: "Build takeoffs and quotes for supply house customers. 2+ years estimating." + LONG },
];
const sources = {
  remotive: async () => [], jobicy: async () => [], themuse: async () => [],
  companyBoards: async () => ({ jobs: structuredClone(BOARD), errors: [] }),
  readBoard: async ({ token }) => token === "buildco" ? [{ id: "gh:buildco:2" }] : [],
};
const PROFILE = { profile: { name: "Gus" } };
async function engine(name, body) {
  if (name === "signup") return { ok: true };
  if (typeof body.resume === "string") return parseResume(body.resume);
  if (body.background) return { backgrounds: readBackground(body.background) };
  if (body.verify) return verify(body.verify, sources);
  if (body.check) return checkJob(body.check, body.profile || {});
  return match(body.profile, {}, sources, { record: async () => ({}) });
}

// The stand-in client, injected in place of supabase-js. Same calls the app makes, rows in memory.
const FAKE = `window.supabase = { createClient() {
  const db = window.__db || { profiles: [], saved_jobs: [] }; window.__db = db;
  let cb = null, user = window.__user || null;
  const q = (table) => {
    let rows = null, op = "select", patch = null, filters = [];
    const api = {
      select() { return api; }, order() { return api; },
      eq(c, v) { filters.push([c, v]); return api; },
      update(p) { op = "update"; patch = p; return api; },
      upsert(row, o) { op = "upsert"; patch = row; return api; },
      maybeSingle() { return run(true); }, single() { return run(true); },
      then(ok, bad) { return run(false).then(ok, bad); },
    };
    async function run(one) {
      const t = db[table], hit = r => filters.every(([c, v]) => r[c] === v);
      if (op === "update") { t.filter(hit).forEach(r => Object.assign(r, structuredClone(patch))); rows = t.filter(hit); }
      else if (op === "upsert") {
        const key = table === "profiles" ? ["user_id"] : ["user_id", "job_key"];
        let r = t.find(x => key.every(k => x[k] === patch[k]));
        if (r) Object.assign(r, structuredClone(patch));
        else { r = { id: "row" + (t.length + 1), created_at: new Date().toISOString(), follow_up: null, note: null, ...structuredClone(patch) }; t.push(r); }
        rows = [r];
      } else rows = table === "saved_jobs" ? t.filter(r => r.user_id === user.id) : t.filter(hit);
      const data = one ? structuredClone(rows[0] || null) : structuredClone(rows);
      return { data, error: null };
    }
    return api;
  };
  return {
    from: q,
    auth: {
      onAuthStateChange(f) { cb = f; setTimeout(() => f("INITIAL", user ? { user } : null), 0); return { data: { subscription: { unsubscribe() {} } } }; },
      async signInWithPassword({ email }) { user = { id: "u1", email, user_metadata: { name: "Gus" } }; setTimeout(() => cb("SIGNED_IN", { user }), 0); return { error: null }; },
      async signOut() { user = null; cb("SIGNED_OUT", null); return { error: null }; },
    },
    functions: { async invoke(name, { body }) { window.__calls = (window.__calls || []).concat(name + ":" + Object.keys(body)[0]); const data = await window.__engine(name, body); return { data, error: null }; } },
  };
} };`;

const TYPES = { ".js": "application/javascript", ".html": "text/html", ".webp": "image/webp", ".png": "image/png", ".webmanifest": "application/manifest+json" };
async function open(browser, { width, height, dark, seed }) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: dark ? "dark" : "light", deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => m.type() === "error" && errors.push(m.text()));
  await page.exposeFunction("__engine", engine);
  if (seed) await page.addInitScript(s => { window.__db = s.db; window.__user = s.user; }, seed);
  await page.route("https://cdn.jsdelivr.net/**", r => r.fulfill({ contentType: "application/javascript", body: FAKE }));
  await page.route("https://cdnjs.cloudflare.com/ajax/libs/jspdf/**", async r => r.fulfill({ contentType: "application/javascript", body: await readFile(JSPDF) }));
  await page.route("http://app.test/**", async r => {
    const path = new URL(r.request().url()).pathname.replace(/^\/$/, "/index.html");
    try { r.fulfill({ body: await readFile(join(APP, path)), contentType: TYPES[extname(path)] || "application/octet-stream" }); } catch { r.fulfill({ status: 404, body: "" }); }
  });
  await page.goto("http://app.test/");
  return { ctx, page, errors };
}
const noSideScroll = async page => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "page scrolls sideways");
// A note from an earlier step would cover the screen, so it's hidden before each picture.
const shot = async (page, name) => { await page.evaluate(() => document.querySelector("#toast")?.classList.add("hidden")); return page.screenshot({ path: join(SHOTS, name + ".png"), fullPage: false }); };

const browser = await chromium.launch();
let passed = 0;
const step = async (name, fn) => { await fn(); passed++; console.log("ok -", name); };

// 1. A new person, start to finish, on a phone.
for (const dark of [false, true]) {
  const tag = dark ? "dark" : "light";
  const { ctx, page, errors } = await open(browser, { width: 390, height: 844, dark });
  await step(`[${tag}] the welcome says what it is, has About and Privacy, and lets people look without an account`, async () => {
    await page.waitForSelector("#vWelcome:not(.hidden)");
    const body = await page.textContent("body");
    for (const gone of ["Hey, I'm your recruiter", "Built by", "with Claude", "No resume upload"]) assert.ok(!body.includes(gone), "still says: " + gone);
    assert.ok(await page.isHidden("#authCard"), "sign-up form waits behind Sign In");
    await page.click('footer [data-page="privacy"]');
    assert.ok((await page.textContent("#sheetBody")).includes("Delete My Account"));
    await page.click("#sheet [data-close]");
    await page.click('footer [data-page="about"]');
    assert.ok((await page.textContent("#sheetBody")).includes("Where the Jobs Come From"));
    await page.click("#sheet [data-close]");
    await shot(page, `phone-${tag}-welcome`);
    await page.click("#tryIt");
    await page.waitForSelector("#vSetup:not(.hidden)");
  });
  await step(`[${tag}] setup step 1 takes past jobs`, async () => {
    for (const t of ["Counter Sales", "Purchasing Agent"]) { await page.fill("#iTitles", t); await page.press("#iTitles", "Enter"); }
    await page.fill("#iYears", "7");
    await page.click("#next1");
    await page.waitForSelector("#setup2:not(.hidden)");
  });
  await step(`[${tag}] step 2 shows how a recruiter reads the background, and its roles toggle in one place`, async () => {
    await page.waitForSelector("#bgSetup:not(.hidden) .bg");
    const labels = await page.$$eval("#bgSetup .bg > b", els => els.map(e => e.textContent));
    assert.deepEqual(labels, ["Counter Sales", "Purchasing and Buying"]);
    assert.equal(await page.$('#bgSetup [data-tog]'), null, "the cards don't repeat the role chips");
    assert.ok(await page.$('#cRoles .chip.on[data-tog="roles:purchasing"]'), "the roles the background points to start picked");
    await page.click('#cRoles [data-tog="roles:purchasing"]');
    assert.equal(await page.$('#cRoles .chip.on[data-tog="roles:purchasing"]'), null, "a tap turns one off");
    await page.click('#cRoles [data-tog="roles:purchasing"]');
    assert.ok(await page.$('#cRoles .chip.on[data-tog="roles:purchasing"]'), "and back on");
    const offered = await page.$$eval('#cRoles [data-tog]', els => els.map(e => e.dataset.tog.slice(6)));
    assert.ok(offered.includes("quoting") && !offered.includes("safety"), "roles come from the background: " + offered);
    await page.click("#moreRoles");
    assert.ok(await page.$('#cRoles [data-tog="roles:safety"]'), "More Roles shows the full list");
    await noSideScroll(page);
    await shot(page, `phone-${tag}-setup-background`);
  });
  await step(`[${tag}] an unknown background says so and shows every role`, async () => {
    await page.click("#back2"); await page.fill("#iTitles", "Financial Analyst"); await page.press("#iTitles", "Enter");
    await page.click('#cTitles [data-del="titles:0"]'); await page.click('#cTitles [data-del="titles:0"]');
    await page.click("#next1");
    await page.waitForFunction(() => document.querySelector("#bgSetup")?.textContent.includes("No Read on That Background"));
    assert.ok(await page.$('#cRoles [data-tog="roles:safety"]') && !(await page.$("#moreRoles")));
    await page.click("#back2"); await page.click('#cTitles [data-del="titles:0"]');
    for (const x of ["Counter Sales", "Purchasing Agent"]) { await page.fill("#iTitles", x); await page.press("#iTitles", "Enter"); }
    await page.click("#next1"); await page.waitForSelector("#bgSetup .bg");
  });
  await step(`[${tag}] a guest's search shows matches, with warnings only where there are some`, async () => {
    await page.click("#next2");
    await page.waitForSelector("#mBody .job");
    const pills = await page.$$eval("#mBody .job .pills", els => els.map(e => e.textContent));
    assert.ok(!pills.some(p => p.includes("Looks Real")), "cards grade themselves: " + pills.join(" / "));
    assert.ok(!(await page.$("#mBody .stats")), "stats row is gone");
    assert.equal(await page.$eval(".tabs", el => getComputedStyle(el).position), "fixed", "tab bar sits at the bottom on a phone");
    const metas = await page.$$eval("#mBody .job", els => els.map(e => e.textContent));
    assert.ok(metas.some(m => /Open (\d+ days|1 day|since today)/.test(m) && /\$\d+k/.test(m)), metas.join(" / "));
    await noSideScroll(page);
    await shot(page, `phone-${tag}-matches`);
  });
  await step(`[${tag}] a guest can pass on a job without an account, and it stays gone`, async () => {
    const titles = await page.$$eval("#mBody .job .title", els => els.map(e => e.textContent));
    const last = page.locator("#mBody .job").first();
    const gone = await last.locator(".title").textContent();
    await last.locator("[data-pass]").click();
    await last.locator("[data-passwhy]").first().click();
    await page.waitForFunction(t => ![...document.querySelectorAll("#mBody .job .title")].some(e => e.textContent === t), gone);
    assert.ok(!(await page.$("#authSheet.open, .sheet.open #aEmail")), "no account wall for a pass");
    assert.equal((await page.$$("#mBody .job")).length, titles.length - 1);
    await page.evaluate(() => { guestPass.clear(); localStorage.removeItem("rg-passed"); renderMatches(); });   // the next checks use this job
  });
  await step(`[${tag}] the sheet shows evidence, knockouts and insider moves, and saves`, async () => {
    const card = page.locator("#mBody .job", { hasText: "Purchasing Coordinator" });
    await card.locator(".title").click();
    await page.waitForSelector("#sheet:not(.hidden)");
    const text = await page.textContent("#sheetBody");
    for (const want of ["Your Resume for This Job", "Add My Resume", "Paper Trail", "first posted", "On the Company's Own Job Board", "Check Before You Apply", "OSHA 10", "Insider Moves", "Who Do You Know at BuildCo?", "hiring a Purchasing Coordinator", "working in Counter Sales"])
      assert.ok(text.includes(want), "sheet is missing: " + want);
    await page.waitForTimeout(400);
    await shot(page, `phone-${tag}-sheet`);
    assert.ok(!text.includes("Looks Real"), "sheet grades itself");
    await page.click('#sheet [data-save="gh:buildco:1"]');
    await page.waitForSelector("#sheet #authCard:not(.hidden)");
    assert.ok((await page.textContent("#sheetBody")).includes("Keep This Job"));
    await page.fill("#aName", "Gus"); await page.fill("#aEmail", "gus@example.com"); await page.fill("#aPass", "a-long-password");
    await page.click("#aGo");
    await page.waitForFunction(() => window.__db.saved_jobs.length === 1 && window.__db.profiles.length === 1);
    assert.ok((await page.evaluate(() => window.__db.profiles[0].data.pastTitles)).includes("Counter Sales"), "guest answers carried into the account");
    await page.waitForSelector("#sheet.hidden", { state: "attached" });
    assert.ok(await page.$("#authSlot #authCard"), "sign-up form goes back to its place");
  });
  await step(`[${tag}] My Jobs has the Today card, and Applied sets a follow-up a week out`, async () => {
    await page.click('.tab[data-tab="mine"]');
    await page.waitForSelector("#mineBody .today");
    const today = await page.textContent("#mineBody .today");
    assert.ok(today.includes("Strong fit at") || today.includes("Nothing due"), today);
    assert.ok(await page.$("#mineBody .rows .row-job"), "saved job shows as a pipeline row");
    await page.click("#mineBody .row-job");
    await page.waitForSelector("#sheet:not(.hidden) [data-status]");
    const id = await page.getAttribute("#sheet [data-status]", "data-status");
    await page.click(`[data-status="${id}"][data-val="applied"]`);
    await page.waitForSelector(`[data-fuwhen="${id}"]`);
    const want = new Date(Date.now() + 7 * 864e5 - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    assert.equal(await page.evaluate(() => window.__db.saved_jobs[0].follow_up), want);
    assert.ok(await page.$(`[data-status="${id}"][data-val="applied"].on`), "Applied shows as picked");
    assert.ok(!(await page.$("#mineBody select, #mineBody input[type=date]")), "no browser select or date box");
    await page.click(`[data-follow="${id}"][data-days="14"]`);
    await page.waitForFunction(w => window.__db.saved_jobs[0].follow_up > w, want);
    await page.waitForTimeout(450);
    await shot(page, `phone-${tag}-track`);
    await page.keyboard.press("Escape");
    assert.ok((await page.textContent("#mineBody .row-job")).includes("Follow up"), "row shows the follow-up day");
    await noSideScroll(page);
    await shot(page, `phone-${tag}-myjobs`);
  });
  await step(`[${tag}] Me shows the background card and Check A Job shows knockouts`, async () => {
    await page.click('.tab[data-tab="me"]');
    await page.waitForSelector("#bgCard:not(.hidden) .say");
    const bg = await page.textContent("#bgCard");
    assert.ok(bg.includes("Same Work, Recruiter Words") && bg.includes("Numbers to Put on Your Resume"));
    await page.click('.tab[data-tab="matches"]');
    await page.fill("#cTitle", "Buyer");
    await page.fill("#cText", "Buy fittings and fixtures for our branches. 5+ years in purchasing. CDL required. Travel up to 60%. Pay not listed." + LONG);
    await page.click("#cGo");
    await page.waitForSelector("#cOut .ev");
    const out = await page.textContent("#cOut");
    assert.ok(out.includes("Check Before You Apply") && out.includes("CDL") && out.includes("Missing"), out);
    await noSideScroll(page);
    await shot(page, `phone-${tag}-check`);
    await page.click('.tab[data-tab="me"]');
    await shot(page, `phone-${tag}-me`);
    await page.click('[data-theme-pick="dark"]');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
    await page.click('[data-theme-pick="system"]');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), undefined);
  });
  await step(`[${tag}] no page errors`, async () => assert.deepEqual(errors, []));
  await ctx.close();
}

// 2. Someone coming back: one saved posting was taken down, one applied job has gone quiet for weeks.
const old = day(30);
const seed = {
  user: { id: "u1", email: "gus@example.com", user_metadata: { name: "Gus" } },
  db: {
    profiles: [{ user_id: "u1", data: { name: "Gus", pastTitles: ["Estimator"], years: 6, skills: [], industries: ["construction-tech"], wants: { roles: ["estimating"], remote: true, cities: [] } },
      last_result: null, last_run_at: null }],
    saved_jobs: [
      { id: "row1", user_id: "u1", job_key: "gh:buildco:1", status: "saved", follow_up: null, note: null, created_at: old, updated_at: old, job: { ...BOARD[0], checkedAt: old } },
      { id: "row2", user_id: "u1", job_key: "gh:buildco:2", status: "applied", follow_up: null, note: null, created_at: old, updated_at: old, job: { ...BOARD[1], checkedAt: old } },
    ],
  },
};
for (const [w, h, dark, tag] of [[390, 844, false, "phone-light"], [1280, 860, false, "desktop-light"], [1280, 860, true, "desktop-dark"]]) {
  const { ctx, page, errors } = await open(browser, { width: w, height: h, dark, seed });
  await step(`[${tag}] a taken-down posting is marked and offered to close out`, async () => {
    await page.waitForSelector("#mBody .summary");
    await page.click('.tab[data-tab="mine"]');
    await page.waitForSelector("#mineBody .pill.gone");
    const today = await page.textContent("#mineBody .today");
    assert.ok(today.includes("No longer on BuildCo's job board"), today);
    assert.ok(today.includes("Applied 30 days ago"), today);
    await noSideScroll(page);
    await shot(page, `${tag}-returning-myjobs`);
    await page.click('#mineBody [data-closeout="row1"]');
    await page.waitForFunction(() => window.__db.saved_jobs[0].status === "closed");
    assert.ok(!(await page.textContent("#mineBody .today")).includes("No longer on BuildCo's job board"));
  });
  await step(`[${tag}] the sheet for a saved job keeps the posting text`, async () => {
    await page.locator('#mineBody [data-open="gh:buildco:2"]').first().click();
    await page.waitForSelector("#sheet:not(.hidden)");
    assert.ok((await page.textContent("#sheetBody")).includes("The Posting, Saved"));
    await page.waitForTimeout(400);
    await shot(page, `${tag}-returning-sheet`);
    await page.click("#sheet [data-close]");
  });
  await step(`[${tag}] no page errors`, async () => assert.deepEqual(errors, []));
  await ctx.close();
}
// 3. Their resume made for one job, the PDF, the email, and Gmail moving a job along.
const RESUME = { name: "Jordan Avery", email: "jordan@example.com", phone: "(817) 555-0142", city: "Fort Worth, TX",
  jobs: [{ title: "Purchasing Agent", company: "Lone Star Mechanical", dates: "Jan 2021 - Present", bullets: ["Kept the shop clean and organized", "Managed purchase orders and vendor lead times for 40+ active jobs", "Trained two coordinators on Epicor", "Ran onboarding for new contractor accounts"] },
    { title: "Counter Sales", company: "Builders Supply Co", dates: "2017 - 2020", bullets: ["Quoted doors and windows for contractor accounts", "Built takeoffs from plans"] }],
  skills: ["Purchasing", "Epicor", "Excel"], education: ["OSHA 10"] };
{
  const seed3 = structuredClone(seed);
  seed3.db.profiles[0].data = { ...seed3.db.profiles[0].data, pastTitles: ["Purchasing Agent"], resume: RESUME, wants: { roles: ["implementation", "purchasing"], remote: true, cities: [] } };
  const { ctx, page, errors } = await open(browser, { width: 390, height: 844, dark: false, seed: seed3 });
  const drafts = [];
  await page.addInitScript(() => {
    window.RG_GOOGLE_CLIENT_ID = "test.apps.googleusercontent.com";
    window.google = { accounts: { oauth2: { initTokenClient: o => ({ requestAccessToken() { setTimeout(() => o.callback({ access_token: "tok", expires_in: 3600 }), 0); } }), revoke() {} } } };
  });
  await ctx.route("https://mail.google.com/**", r => r.fulfill({ contentType: "text/html", body: "<p>Gmail</p>" }));
  await page.route("https://gmail.googleapis.com/**", async r => {
    const u = new URL(r.request().url());
    if (u.pathname.endsWith("/drafts")) { drafts.push(JSON.parse(r.request().postData())); return r.fulfill({ json: { id: "d1", message: { id: "m1" } } }); }
    if (u.pathname.endsWith("/messages")) return r.fulfill({ json: u.searchParams.get("q").includes("BuildCo") ? { messages: [{ id: "x1" }] } : {} });
    // The preview only shows the thank-you; the invite is in the second paragraph of the full email, as job sites write them.
    const body = Buffer.from("Hi,\n\nThanks for applying to BuildCo.\n\nWe'd like to schedule a phone screen. What is your availability this week?\n\nDana\n\nOn Mon, Oct 27, 2026 at 9:00 AM Jordan wrote:\n> We regret to inform you\n").toString("base64url");
    return r.fulfill({ json: { snippet: "Hi, Thanks for applying to BuildCo.", internalDate: String(Date.now()),
      payload: { mimeType: "multipart/alternative", headers: [{ name: "Subject", value: "Next steps with BuildCo" }, { name: "From", value: "Dana Lee <dana@buildco.com>" }],
        parts: [{ mimeType: "text/plain", body: { data: body } }, { mimeType: "text/html", body: { data: "" } }] } } });
  });
  await page.reload();
  await step("[resume] a job's sheet shows how the resume lines up, and the PDF downloads", async () => {
    await page.waitForSelector("#mBody .summary");
    await page.click('.tab[data-tab="mine"]');
    await page.locator('#mineBody .rows [data-open="gh:buildco:2"]').click();
    await page.waitForSelector("#sheet:not(.hidden) .fitline");
    const text = await page.textContent("#sheetBody");
    assert.match(text, /\d+ of \d+words from this posting are already on your resume/);
    await page.locator("#sheetBody .fitline").evaluate(el => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(450);
    await shot(page, "phone-light-resume-fit");
    await page.click("#sheetBody details:has(.paper) summary");
    const lines = await page.$$eval("#sheetBody .paper li", els => els.map(e => e.textContent));
    assert.equal(lines[0], "Managed purchase orders and vendor lead times for 40+ active jobs", "the line that fits this purchasing-software posting best comes first");
    assert.equal(lines[1], "Ran onboarding for new contractor accounts", "then the onboarding line");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#sheetBody [data-pdf]")]);
    assert.equal(dl.suggestedFilename(), "Jordan Avery - BuildCo Implementation Specialist.pdf");
    const head = await (await import("node:fs/promises")).readFile(await dl.path());
    assert.equal(head.subarray(0, 5).toString(), "%PDF-");
    await page.waitForTimeout(400);
    await shot(page, "phone-light-resume-sheet");
  });
  await step("[resume] back from the company's site, one tap marks it Applied", async () => {
    await page.keyboard.press("Escape");
    await page.click('.tab[data-tab="matches"]');
    await page.waitForSelector("#mBody .job");
    await page.locator('#mBody .job[data-open="gh:buildco:1"] .title').click();
    await page.waitForSelector("#sheet:not(.hidden) [data-applyout]");
    const id = await page.getAttribute("#sheet [data-applyout]", "data-applyout");
    await page.evaluate(() => { const a = document.querySelector("#sheet [data-applyout]"); a.removeAttribute("target"); a.addEventListener("click", e => e.preventDefault()); a.click(); });
    await page.waitForTimeout(2700);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.waitForSelector("#sheet [data-didapply]");
    await page.click("#sheet [data-didapply]");
    await page.waitForFunction(k => window.__db.saved_jobs.some(r => r.job_key === k && r.status === "applied" && r.follow_up), id);
    await page.click("#sheet [data-close]");
  });
  await step("[resume] the email is written for the job, and Gmail saves it as a draft with the PDF", async () => {
    await page.click('.tab[data-tab="mine"]');
    await page.locator('#mineBody .rows [data-open="gh:buildco:2"]').click();
    await page.waitForSelector("#sheet:not(.hidden) [data-mail]");
    await page.click("#sheetBody [data-mail]");
    await page.waitForSelector("#mailBody");
    assert.match(await page.inputValue("#mailBody"), /^Hello BuildCo hiring team,\n\nI'm applying for the Implementation Specialist role\./);
    assert.ok(await page.$("#sheetBody [data-compose]"), "without Gmail it opens a filled-in Gmail compose");
    await page.click("#sheetBody [data-gconnect]");
    await page.waitForSelector("#sheetBody [data-gdraft]");
    assert.equal(await page.evaluate(() => window.__db.saved_jobs[1].status), "applied", "Gmail never moves a job without a tap");
    await page.fill("#mailBody", (await page.inputValue("#mailBody")) + "\nP.S. Thanks.");
    await page.click("#sheetBody [data-gdraft]");
    await page.waitForFunction(() => document.querySelector("#toast")?.textContent.includes("Gmail Drafts"));
    const raw = Buffer.from(drafts[0].message.raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
    assert.match(raw, /Subject: Application: Implementation Specialist - Jordan Avery/);
    assert.match(raw, /Content-Type: application\/pdf; name="Jordan Avery - BuildCo Implementation Specialist.pdf"/);
    assert.ok(Buffer.from(raw.split("charset=UTF-8")[1].split("--rg")[0].split("base64")[1].replace(/\s+/g, ""), "base64").toString().includes("P.S. Thanks."), "their edits go into the draft");
    await shot(page, "phone-light-resume-email");
    await page.click("#sheet [data-close]");
    await page.click('.tab[data-tab="mine"]');
    await page.waitForSelector("#mineBody [data-mailyes]");
    assert.ok((await page.textContent("#mineBody .mailnudge")).includes("schedule a phone screen"), "the email shows beside the suggestion");
    await shot(page, "phone-light-gmail-suggest");
    const n = await page.$$eval("#mineBody [data-mailyes]", els => els.length);
    assert.equal(n, 1, "one email moves one job: the BuildCo job furthest along, not both");
    await page.click("#mineBody [data-mailyes]");
    await page.waitForFunction(() => window.__db.saved_jobs.find(r => r.id === "row2").status === "interview");
    assert.equal(await page.evaluate(() => window.__db.saved_jobs.find(r => r.id === "row2").job.mail.kind), "interview");
    await page.waitForSelector(".party button"); await page.click(".party button");
    await page.locator('#mineBody .rows [data-open="gh:buildco:2"]').click();
    await page.waitForSelector("#sheet:not(.hidden)");
    assert.ok((await page.textContent("#sheetBody")).includes("Interview Request in Gmail"), "the sheet says why it moved");
    await page.click("#sheet [data-close]");
  });
  await step("[resume] Me shows the resume and Gmail, and edits save", async () => {
    await page.click('.tab[data-tab="me"]');
    await page.waitForSelector("#resumeBody .kv");
    assert.ok((await page.textContent("#resumeBody")).includes("2 jobs"), "the resume card counts jobs; the titles show once, above");
    assert.ok((await page.textContent("#gmailBody")).includes("Check for Replies"));
    await page.click("#editResume");
    await page.waitForSelector("#rjB1");
    await page.fill("#rjB1", "Quoted doors and windows for contractor accounts\nBuilt takeoffs from plans\nRan the will-call desk");
    await page.click("#rAddJob");
    await page.fill("#rjT2", "Warehouse Associate");
    await page.click("#rSave");
    await page.waitForFunction(() => window.__db.profiles[0].data.resume.jobs.length === 3);
    assert.equal(await page.evaluate(() => window.__db.profiles[0].data.resume.jobs[1].bullets.length), 3);
    assert.ok((await page.evaluate(() => window.__db.profiles[0].data.pastTitles)).includes("Warehouse Associate"), "a job added to the resume joins Jobs You've Held");
    await noSideScroll(page);
    await shot(page, "phone-light-resume-me");
  });
  await step("[resume] no page errors", async () => assert.deepEqual(errors, []));
  await ctx.close();
}
await browser.close();
console.log(`\n${passed} checks passed`);
