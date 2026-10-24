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

const BOARD = { greenhouse, lever, ashby };

export const readBoard = c => BOARD[c.ats](c.token, c.name);

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
