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

const TYPES = { ".html": "text/html", ".webp": "image/webp", ".png": "image/png", ".webmanifest": "application/manifest+json" };
async function open(browser, { width, height, dark, seed }) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: dark ? "dark" : "light", deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => m.type() === "error" && errors.push(m.text()));
  await page.exposeFunction("__engine", engine);
  if (seed) await page.addInitScript(s => { window.__db = s.db; window.__user = s.user; }, seed);
  await page.route("https://cdn.jsdelivr.net/**", r => r.fulfill({ contentType: "application/javascript", body: FAKE }));
  await page.route("http://app.test/**", async r => {
    const path = new URL(r.request().url()).pathname.replace(/^\/$/, "/index.html");
    try { r.fulfill({ body: await readFile(join(APP, path)), contentType: TYPES[extname(path)] || "application/octet-stream" }); } catch { r.fulfill({ status: 404, body: "" }); }
  });
  await page.goto("http://app.test/");
  return { ctx, page, errors };
}
const noSideScroll = async page => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "page scrolls sideways");
const shot = (page, name) => page.screenshot({ path: join(SHOTS, name + ".png"), fullPage: false });

const browser = await chromium.launch();
let passed = 0;
const step = async (name, fn) => { await fn(); passed++; console.log("ok -", name); };

// 1. A new person, start to finish, on a phone.
for (const dark of [false, true]) {
  const tag = dark ? "dark" : "light";
  const { ctx, page, errors } = await open(browser, { width: 390, height: 844, dark });
  await step(`[${tag}] make an account and sign in`, async () => {
    await page.click('.seg button[data-mode="up"]');
    await page.fill("#aName", "Gus"); await page.fill("#aEmail", "gus@example.com"); await page.fill("#aPass", "a-long-password");
    await page.click("#aGo");
    await page.waitForSelector("#vSetup:not(.hidden)");
  });
  await step(`[${tag}] setup step 1 takes past jobs`, async () => {
    for (const t of ["Counter Sales", "Purchasing Agent"]) { await page.fill("#iTitles", t); await page.press("#iTitles", "Enter"); }
    await page.fill("#iYears", "7");
    await page.click("#next1");
    await page.waitForSelector("#setup2:not(.hidden)");
  });
  await step(`[${tag}] step 2 shows how a recruiter reads the background, and its roles toggle`, async () => {
    await page.waitForSelector("#bgSetup:not(.hidden) .bg");
    const labels = await page.$$eval("#bgSetup .bg > b", els => els.map(e => e.textContent));
    assert.deepEqual(labels, ["Counter Sales", "Purchasing and Buying"]);
    await page.click('#bgSetup [data-tog="roles:purchasing"]');
    assert.ok(await page.$('#cRoles .chip.on[data-tog="roles:purchasing"]'), "role picked from the background card shows as picked");
    assert.ok(await page.$('#bgSetup .chip.on[data-tog="roles:purchasing"]'));
    await noSideScroll(page);
    await shot(page, `phone-${tag}-setup-background`);
  });
  await step(`[${tag}] search shows matches with a posting check on each`, async () => {
    await page.click("#next2");
    await page.waitForSelector("#mBody .job");
    const pills = await page.$$eval("#mBody .job .pills", els => els.map(e => e.textContent));
    assert.ok(pills.some(p => p.includes("Looks Real") || p.includes("Check First")), pills.join(" / "));
    const metas = await page.$$eval("#mBody .job .meta", els => els.map(e => e.textContent));
    assert.ok(metas.some(m => /Open (\d+ days|1 day|since today)/.test(m) && /\$\d+k/.test(m)), metas.join(" / "));
    await noSideScroll(page);
    await shot(page, `phone-${tag}-matches`);
  });
  await step(`[${tag}] the sheet shows evidence, knockouts and insider moves, and saves`, async () => {
    const card = page.locator("#mBody .job", { hasText: "Purchasing Coordinator" });
    await card.locator("button.more").click();
    await page.waitForSelector("#sheet:not(.hidden)");
    const text = await page.textContent("#sheetBody");
    for (const want of ["Posting Check", "Looks Real", "Nothing here says stale", "First Posted", "On the Company's Own Job Board", "Check Before You Apply", "OSHA 10", "Insider Moves", "Who Do You Know at BuildCo?", "hiring a Purchasing Coordinator", "working as a Counter Sales"])
      assert.ok(text.includes(want), "sheet is missing: " + want);
    await page.waitForTimeout(400);
    await shot(page, `phone-${tag}-sheet`);
    await page.click('#sheet [data-save="gh:buildco:1"]');
    await page.waitForFunction(() => !document.querySelector('#sheet [data-save]'));
    assert.ok(!(await page.isHidden("#sheet")), "sheet stays open after saving");
    await page.keyboard.press("Escape");
    assert.ok(await page.isHidden("#sheet"));
  });
  await step(`[${tag}] My Jobs has the Today card, and Applied sets a follow-up a week out`, async () => {
    await page.click('.tab[data-tab="mine"]');
    await page.waitForSelector("#mineBody .today");
    const today = await page.textContent("#mineBody .today");
    assert.ok(today.includes("Strong fit at") || today.includes("Nothing due"), today);
    const id = await page.getAttribute("#mineBody [data-status]", "data-status");
    await page.selectOption(`[data-status="${id}"]`, "applied");
    await page.waitForFunction(i => document.querySelector(`[data-follow="${i}"]`)?.value, id);
    const fu = await page.inputValue(`[data-follow="${id}"]`);
    const want = new Date(Date.now() + 7 * 864e5 - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    assert.equal(fu, want);
    await noSideScroll(page);
    await shot(page, `phone-${tag}-myjobs`);
  });
  await step(`[${tag}] Me shows the background card and Check A Job shows knockouts`, async () => {
    await page.click('.tab[data-tab="me"]');
    await page.waitForSelector("#bgCard:not(.hidden) .say");
    const bg = await page.textContent("#bgCard");
    assert.ok(bg.includes("Say This Instead") && bg.includes("Numbers to Put on Your Resume"));
    await page.fill("#cTitle", "Buyer");
    await page.fill("#cText", "Buy fittings and fixtures for our branches. 5+ years in purchasing. CDL required. Travel up to 60%. Pay not listed." + LONG);
    await page.click("#cGo");
    await page.waitForSelector("#cOut .ev");
    const out = await page.textContent("#cOut");
    assert.ok(out.includes("Check Before You Apply") && out.includes("CDL") && out.includes("Missing"), out);
    await noSideScroll(page);
    await shot(page, `phone-${tag}-me`);
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
await browser.close();
console.log(`\n${passed} checks passed`);
