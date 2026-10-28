// Job sources. Each adapter turns one site's response into the shared posting shape:
// { id, title, company, location, remote, payMin, payMax, payText, postedAt, applyUrl, description, source }
// Keyless sources run for everyone. JSearch and Adzuna run only when their keys are set.

import { DIRECTORY } from "../directory.js";

const UA = { "User-Agent": "RecruiterGoose/0.1 (+job matching)" };

export async function getJson(url, opts = {}, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, headers: { ...UA, ...(opts.headers || {}) }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export const stripHtml = s => String(s || "")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

const isRemoteText = s => /\bremote\b|anywhere|work from home|\bwfh\b/i.test(s || "");

// Turns "$85,000 - $105,000", "$40-$65/hr" or "85k-105k" found in text into yearly numbers.
export function payFromText(text) {
  const s = String(text || "");
  const m = s.match(/\$\s?(\d{2,3}(?:[,.]\d{3})?(?:\.\d+)?)\s*(k|K)?\s*(?:-|–|to)\s*\$?\s?(\d{2,3}(?:[,.]\d{3})?(?:\.\d+)?)\s*(k|K)?\s*(\/\s?(?:hr|hour)|per hour|an hour)?/);
  if (!m) return null;
  const num = (v, k) => { let n = parseFloat(v.replace(/,/g, "")); if (k) n *= 1000; return n; };
  let lo = num(m[1], m[2] || m[4]), hi = num(m[3], m[4] || m[2]);
  if (m[5] || hi < 300) { lo *= 2080; hi *= 2080; }       // hourly to yearly
  if (hi < 20000 || hi > 1000000 || lo > hi) return null;
  return { payMin: Math.round(lo), payMax: Math.round(hi) };
}

function yearly(min, max, period) {
  const mult = { HOUR: 2080, hour: 2080, HOURLY: 2080, DAY: 260, WEEK: 52, MONTH: 12, month: 12, YEAR: 1, year: 1 }[period] || 1;
  return { payMin: min ? Math.round(min * mult) : null, payMax: max ? Math.round(max * mult) : null };
}

// ---------- Keyword sources (search by role) ----------

export async function remotive(q) {
  const d = await getJson(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(q.keyword)}&limit=50`);
  return (d.jobs || []).map(j => ({
    id: "remotive:" + j.id, title: j.title, company: j.company_name,
    location: j.candidate_required_location || "Remote", remote: true,
    ...(payFromText(j.salary) || {}), payText: j.salary || "",
    postedAt: j.publication_date, applyUrl: j.url, description: stripHtml(j.description), source: "Remotive",
  }));
}

export async function jobicy(q) {
  const d = await getJson(`https://jobicy.com/api/v2/remote-jobs?count=50&geo=usa&tag=${encodeURIComponent(q.keyword)}`);
  return (d.jobs || []).map(j => ({
    id: "jobicy:" + j.id, title: stripHtml(j.jobTitle), company: j.companyName,
    location: j.jobGeo || "Remote", remote: true,
    payMin: j.annualSalaryMin || null, payMax: j.annualSalaryMax || null, payText: "",
    postedAt: j.pubDate, applyUrl: j.url, description: stripHtml(j.jobDescription || j.jobExcerpt), source: "Jobicy",
  }));
}

export async function themuse(q) {
  const loc = q.city ? `&location=${encodeURIComponent(q.city)}` : "&location=Flexible%20%2F%20Remote";
  const d = await getJson(`https://www.themuse.com/api/public/jobs?page=0&descending=true${loc}`);
  return (d.results || []).map(j => {
    const desc = stripHtml(j.contents);
    const locs = (j.locations || []).map(l => l.name).join(" / ");
    return {
      id: "muse:" + j.id, title: j.name, company: j.company?.name, location: locs || "Not Listed",
      remote: isRemoteText(locs), ...(payFromText(desc) || {}), payText: "",
      postedAt: j.publication_date, applyUrl: j.refs?.landing_page, description: desc, source: "The Muse",
    };
  });
}

// ---------- Company job boards (direct from the employer's own system) ----------

async function greenhouse(token, name) {
  const d = await getJson(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`);
  return (d.jobs || []).map(j => {
    const desc = stripHtml(j.content), loc = j.location?.name || "";
    return {
      id: `gh:${token}:${j.id}`, title: j.title, company: name, location: loc || "Not Listed",
      remote: isRemoteText(loc), ...(payFromText(desc) || {}), payText: "",
      // first_published is when the job went up; updated_at moves on every edit and made old jobs look new.
      postedAt: j.first_published || j.updated_at, firstPublished: j.first_published || null, updatedAt: j.updated_at || null,
      requisitionId: j.requisition_id || null, applyUrl: j.absolute_url, description: desc, source: "Company Site",
    };
  });
}

async function lever(token, name) {
  const d = await getJson(`https://api.lever.co/v0/postings/${token}?mode=json`);
  return (Array.isArray(d) ? d : []).map(j => {
    const loc = j.categories?.location || "", sr = j.salaryRange;
    const pay = sr ? yearly(sr.min, sr.max, sr.interval === "per-hour-wage" ? "HOUR" : "YEAR") : payFromText(j.descriptionPlain) || {};
    return {
      id: `lever:${token}:${j.id}`, title: j.text, company: name, location: loc || "Not Listed",
      remote: j.workplaceType === "remote" || isRemoteText(loc), ...pay, payText: "",
      postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null, firstPublished: j.createdAt ? new Date(j.createdAt).toISOString() : null, applyUrl: j.hostedUrl,
      description: j.descriptionPlain || stripHtml(j.description), source: "Company Site",
    };
  });
}

async function ashby(token, name) {
  const d = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${token}?includeCompensation=true`);
  return (d.jobs || []).filter(j => j.isListed !== false).map(j => {
    const sal = (j.compensation?.summaryComponents || []).find(c => c.compensationType === "Salary");
    const pay = sal ? yearly(sal.minValue, sal.maxValue, sal.interval === "1 HOUR" ? "HOUR" : "YEAR") : payFromText(j.descriptionPlain) || {};
    return {
      id: `ashby:${token}:${j.id}`, title: j.title, company: name, location: j.location || "Not Listed",
      remote: j.isRemote || j.workplaceType === "Remote" || isRemoteText(j.location), ...pay,
      payText: j.compensation?.compensationTierSummary || "",
      postedAt: j.publishedAt, firstPublished: j.publishedAt || null, applyUrl: j.jobUrl || j.applyUrl, description: j.descriptionPlain || stripHtml(j.descriptionHtml), source: "Company Site",
    };
  });
}

// ---------- Big employer hiring systems (Workday, iCIMS, UKG, SmartRecruiters, Oracle) ----------
// Builders, specialty contractors and supply houses mostly hire through these. They list thousands of field and
// plant jobs, so each board is searched only for the office roles this app matches, and a posting's full text is
// fetched once: `known` holds ids already in the index, which come back with `known: true` and no description.

// Every office role word worth searching a big board for.
export const DEEP_SEARCH = ["purchasing", "procurement", "buyer", "estimator", "estimating", "preconstruction", "project coordinator",
  "project engineer", "assistant project manager", "project manager", "supply chain", "inventory", "materials", "logistics",
  "scheduler", "dispatch", "operations coordinator", "pricing", "quote", "implementation", "customer service", "warehouse",
  "quality", "safety coordinator", "document control", "contract administrator"];
const DETAIL_CAP = 40;   // new postings read in full per board per run; the rest wait for the next run

const decode = s => String(s || "").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

// Runs fn over items, a few at a time, so one company's server isn't hit with a hundred requests at once.
async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]).catch(() => null); } }));
  return out;
}

async function getText(url, opts = {}, timeoutMs = 15000) {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, headers: { ...UA, ...(opts.headers || {}) }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally { clearTimeout(t); }
}

// The JobPosting block search engines read, which most hiring systems put on each job page.
export function jsonLdJob(html) {
  for (const m of String(html).matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const d = JSON.parse(m[1].trim()), list = Array.isArray(d) ? d : d["@graph"] || [d];
      const j = list.find(x => x && x["@type"] === "JobPosting");
      if (j) return j;
    } catch { /* not JSON */ }
  }
  return null;
}
const ldPlace = j => { const a = [].concat(j?.jobLocation || [])[0]?.address || {}; return [a.addressLocality, a.addressRegion].filter(Boolean).join(", "); };
const ldPay = j => { const v = j?.baseSalary?.value; return v && (v.minValue || v.value) ? yearly(v.minValue || v.value, v.maxValue || v.value, String(v.unitText || "YEAR").toUpperCase()) : null; };
// "Posted 3 Days Ago" and friends, as a date.
export function postedAgo(text, now = Date.now()) {
  const s = String(text || "").toLowerCase();
  if (/today|just posted/.test(s)) return new Date(now).toISOString();
  if (/yesterday/.test(s)) return new Date(now - 864e5).toISOString();
  const m = s.match(/(\d+)\+?\s*days?/);
  return m && !s.includes("+") ? new Date(now - +m[1] * 864e5).toISOString() : null;   // "30+ days" is too vague to date
}

// Workday token: "host/tenant/site", e.g. "graybar.wd1.myworkdayjobs.com/graybar/Careers".
export async function workday(token, name, { known = new Set(), search = DEEP_SEARCH } = {}) {
  const [host, tenant, site] = token.split("/");
  const api = `https://${host}/wday/cxs/${tenant}/${site}`;
  const seen = new Map();
  await pool(search, 4, async q => {
    const d = await getJson(`${api}/jobs`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: q }) });
    for (const p of d.jobPostings || []) if (p.externalPath && !seen.has(p.externalPath)) seen.set(p.externalPath, p);
  });
  const list = [...seen.values()];
  const id = p => `wd:${tenant}:${p.externalPath.split("_").pop() || p.externalPath}`;
  const fresh = list.filter(p => !known.has(id(p))).slice(0, DETAIL_CAP);
  const details = new Map((await pool(fresh, 4, async p => [p.externalPath, (await getJson(api + p.externalPath)).jobPostingInfo])).filter(Boolean));
  const out = [];
  for (const p of list) {
    const info = details.get(p.externalPath), isKnown = known.has(id(p));
    if (!info && !isKnown) continue;
    const loc = info?.location || p.locationsText || "";
    const desc = info ? stripHtml(info.jobDescription) : undefined;
    out.push({
      id: id(p), title: p.title, company: name, location: loc || "Not Listed", remote: isRemoteText(loc) || /remote/i.test(info?.remoteType || ""),
      ...(desc ? payFromText(desc) || {} : {}), payText: "",
      postedAt: info?.startDate || postedAgo(p.postedOn), firstPublished: info?.startDate || null,
      applyUrl: info?.externalUrl || `https://${host}/${site}${p.externalPath}`, description: desc, known: isKnown, source: "Company Site",
    });
  }
  return out;
}

// iCIMS token: the careers host, e.g. "careers-tdindustries.icims.com".
export async function icims(token, name, { known = new Set(), search = DEEP_SEARCH } = {}) {
  const found = new Map();
  await pool(search, 3, async q => {
    const html = await getText(`https://${token}/jobs/search?ss=1&searchKeyword=${encodeURIComponent(q)}&in_iframe=1`);
    for (const m of html.matchAll(/href="(https:\/\/[^"]*\/jobs\/(\d+)\/[^"]*\/job)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const title = stripHtml(decode(m[3])).replace(/^Title\s*/i, "");
      if (title && !found.has(m[2])) found.set(m[2], { url: m[1], jid: m[2], title });
    }
  });
  const list = [...found.values()], id = p => `icims:${token.split(".")[0]}:${p.jid}`;
  const fresh = list.filter(p => !known.has(id(p))).slice(0, DETAIL_CAP);
  const details = new Map((await pool(fresh, 3, async p => [p.jid, jsonLdJob(await getText(p.url + "?in_iframe=1"))])).filter(x => x && x[1]));
  const out = [];
  for (const p of list) {
    const ld = details.get(p.jid), isKnown = known.has(id(p));
    if (!ld && !isKnown) continue;
    const loc = ld ? ldPlace(ld) : "", desc = ld ? stripHtml(decode(ld.description)) : undefined;
    out.push({
      id: id(p), title: ld?.title ? decode(ld.title) : p.title, company: name, location: loc || "Not Listed",
      remote: /TELECOMMUTE/i.test(ld?.jobLocationType || "") || isRemoteText(loc), ...(ld ? ldPay(ld) || payFromText(desc) || {} : {}), payText: "",
      postedAt: ld?.datePosted || null, firstPublished: ld?.datePosted || null, applyUrl: p.url, description: desc, known: isKnown, source: "Company Site",
    });
  }
  return out;
}

// UKG (UltiPro) token: "host/tenant/boardId", e.g. "recruiting2.ultipro.com/AUS1003AUIN/611d5a38-...".
export async function ukg(token, name, { known = new Set(), search = DEEP_SEARCH } = {}) {
  const [host, tenant, board] = token.split("/");
  const base = `https://${host}/${tenant}/JobBoard/${board}`;
  const found = new Map();
  await pool(search, 3, async q => {
    const d = await getJson(`${base}/JobBoardView/LoadSearchResults`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ opportunitySearch: { Top: 50, Skip: 0, QueryString: q, OrderBy: [{ Value: "postedDateDesc", PropertyName: "PostedDate", Ascending: false }], Filters: [] }, matchCriteria: { PreferredJobs: [], Educations: [], LicenseAndCertifications: [], Skills: [], hasNoLicenses: false, SkippedSkills: [] } }) });
    for (const o of d.opportunities || []) if (o.Id && !found.has(o.Id)) found.set(o.Id, o);
  });
  const list = [...found.values()], id = o => `ukg:${tenant}:${o.Id}`;
  const fresh = list.filter(o => !known.has(id(o))).slice(0, DETAIL_CAP);
  const details = new Map((await pool(fresh, 3, async o => {
    const html = await getText(`${base}/OpportunityDetail?opportunityId=${o.Id}`);
    const m = html.match(/CandidateOpportunityDetail\((\{[\s\S]*?\})\);?\s*\n/);
    let d = null; try { d = m ? JSON.parse(m[1]) : null; } catch { /* page changed */ }
    return [o.Id, d?.Description || jsonLdJob(html)?.description || ""];
  })).filter(Boolean));
  return list.filter(o => details.has(o.Id) || known.has(id(o))).map(o => {
    const a = (o.Locations || [])[0]?.Address || {}, loc = [a.City, a.State?.Code].filter(Boolean).join(", ");
    const raw = details.get(o.Id), desc = raw != null ? stripHtml(decode(raw)) || stripHtml(o.BriefDescription) : undefined;
    return {
      id: id(o), title: o.Title, company: name, location: loc || "Not Listed", remote: isRemoteText(loc) || (o.Locations || []).some(l => l.LocalizedDescription && /remote/i.test(l.LocalizedDescription)),
      ...(desc ? payFromText(desc) || {} : {}), payText: "", postedAt: o.PostedDate || null, firstPublished: o.PostedDate || null,
      applyUrl: `${base}/OpportunityDetail?opportunityId=${o.Id}`, description: desc, known: known.has(id(o)), source: "Company Site",
    };
  });
}

// SmartRecruiters token: the company id, e.g. "Winsupply1".
export async function smartrecruiters(token, name, { known = new Set(), search = DEEP_SEARCH } = {}) {
  const found = new Map();
  await pool(search, 3, async q => {
    const d = await getJson(`https://api.smartrecruiters.com/v1/companies/${token}/postings?limit=100&q=${encodeURIComponent(q)}&country=us`);
    for (const p of d.content || []) if (p.id && !found.has(p.id)) found.set(p.id, p);
  });
  const list = [...found.values()], id = p => `sr:${token}:${p.id}`;
  const fresh = list.filter(p => !known.has(id(p))).slice(0, DETAIL_CAP);
  const details = new Map((await pool(fresh, 3, async p => [p.id, await getJson(`https://api.smartrecruiters.com/v1/companies/${token}/postings/${p.id}`)])).filter(Boolean));
  return list.filter(p => details.has(p.id) || known.has(id(p))).map(p => {
    const d = details.get(p.id), sec = d?.jobAd?.sections || {};
    const desc = d ? stripHtml([sec.jobDescription?.text, sec.qualifications?.text, sec.additionalInformation?.text].filter(Boolean).join(" ")) : undefined;
    const loc = [p.location?.city, p.location?.region].filter(Boolean).join(", ");
    return {
      id: id(p), title: p.name, company: name, location: loc || "Not Listed", remote: !!p.location?.remote || isRemoteText(loc),
      ...(desc ? payFromText(desc) || {} : {}), payText: "", postedAt: p.releasedDate || null, firstPublished: p.releasedDate || null,
      applyUrl: d?.applyUrl || `https://jobs.smartrecruiters.com/${token}/${p.id}`, description: desc, known: known.has(id(p)), source: "Company Site",
    };
  });
}

// Oracle Recruiting token: "host/siteNumber", e.g. "eewl.fa.us6.oraclecloud.com/CX_1".
export async function oracle(token, name, { known = new Set(), search = DEEP_SEARCH } = {}) {
  const [host, siteNo] = token.split("/");
  const api = `https://${host}/hcmRestApi/resources/latest`;
  const found = new Map();
  await pool(search, 3, async q => {
    const d = await getJson(`${api}/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=${siteNo},keyword=${encodeURIComponent(q)},limit=25,sortBy=POSTING_DATES_DESC`);
    for (const r of d.items?.[0]?.requisitionList || []) if (r.Id && !found.has(r.Id)) found.set(r.Id, r);
  });
  const list = [...found.values()], id = r => `oracle:${host.split(".")[0]}:${r.Id}`;
  const fresh = list.filter(r => !known.has(id(r))).slice(0, DETAIL_CAP);
  const details = new Map((await pool(fresh, 3, async r => {
    const d = await getJson(`${api}/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%22${r.Id}%22,siteNumber=${siteNo}`);
    const x = d.items?.[0] || {};
    return [r.Id, [x.ExternalDescriptionStr, x.ExternalResponsibilitiesStr, x.ExternalQualificationsStr].filter(Boolean).join(" ")];
  })).filter(Boolean));
  return list.filter(r => details.has(r.Id) || known.has(id(r))).map(r => {
    const raw = details.get(r.Id), desc = raw != null ? stripHtml(decode(raw)) || stripHtml(r.ShortDescriptionStr) : undefined;
    const loc = String(r.PrimaryLocation || "").replace(/,\s*United States$/, "");
    return {
      id: id(r), title: r.Title, company: name, location: loc || "Not Listed", remote: /remote/i.test(r.WorkplaceType || "") || isRemoteText(loc),
      ...(desc ? payFromText(desc) || {} : {}), payText: "", postedAt: r.PostedDate || null, firstPublished: r.PostedDate || null,
      applyUrl: `https://${host}/hcmUI/CandidateExperience/en/sites/${siteNo}/job/${r.Id}`, description: desc, known: known.has(id(r)), source: "Company Site",
    };
  });
}

const BOARD = { greenhouse, lever, ashby, workday, icims, ukg, smartrecruiters, oracle };
export const DEEP = new Set(["workday", "icims", "ukg", "smartrecruiters", "oracle"]);

export const readBoard = (c, opts) => BOARD[c.ats](c.token, c.name, opts);

export async function companyBoards(q) {
  const picks = DIRECTORY.filter(c => !q.industries?.length || c.industries.some(i => q.industries.includes(i)));
  const results = await Promise.allSettled(picks.map(readBoard));
  const jobs = [], errors = [];
  // Each posting carries the industries its company works in, so matching can tell a construction-software
  // company's onboarding job from a hotel software company's.
  results.forEach((r, i) => r.status === "fulfilled" ? jobs.push(...r.value.map(j => ({ ...j, industries: picks[i].industries }))) : errors.push(`${picks[i].name}: ${r.reason?.message || r.reason}`));
  if (picks.length && errors.length === picks.length) throw new Error("No company job board answered");
  return { jobs, errors, checked: picks.length };
}

// ---------- Keyed sources (wide coverage once a key is added) ----------

export async function jsearch(q, key) {
  const where = q.remote && !q.city ? "remote" : q.city || "";
  const query = encodeURIComponent(`${q.keyword} ${where ? "in " + where : ""}`.trim());
  const d = await getJson(`https://jsearch.p.rapidapi.com/search?query=${query}&page=1&num_pages=1&date_posted=month${q.remote && !q.city ? "&remote_jobs_only=true" : ""}`,
    { headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": "jsearch.p.rapidapi.com" } });
  return (d.data || []).map(j => ({
    id: "jsearch:" + j.job_id, title: j.job_title, company: j.employer_name,
    location: [j.job_city, j.job_state].filter(Boolean).join(", ") || (j.job_is_remote ? "Remote" : "Not Listed"),
    remote: !!j.job_is_remote, ...yearly(j.job_min_salary, j.job_max_salary, j.job_salary_period), payText: "",
    postedAt: j.job_posted_at_datetime_utc, applyUrl: j.job_apply_link, applyIsDirect: !!j.job_apply_is_direct,
    description: j.job_description || "", source: j.job_publisher || "Google for Jobs",
  }));
}

export async function adzuna(q, id, key) {
  const where = q.city ? `&where=${encodeURIComponent(q.city)}` : "";
  const d = await getJson(`https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${id}&app_key=${key}&results_per_page=50&max_days_old=30&what=${encodeURIComponent(q.keyword)}${where}`);
  return (d.results || []).map(j => ({
    id: "adzuna:" + j.id, title: stripHtml(j.title), company: j.company?.display_name, location: j.location?.display_name || "Not Listed",
    remote: isRemoteText(j.title + " " + j.description),
    payMin: j.salary_is_predicted === "1" ? null : j.salary_min || null, payMax: j.salary_is_predicted === "1" ? null : j.salary_max || null, payText: "",
    postedAt: j.created, applyUrl: j.redirect_url, description: stripHtml(j.description), source: "Adzuna",
  }));
}
