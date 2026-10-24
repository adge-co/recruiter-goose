// Reads a resume's plain text and fills in a profile: past titles, past companies, years, skills, industries
// and roles worth looking at. Plain rules, no AI. The person checks the result and fixes anything wrong.

import { FIELD_WORDS, ROLE_WORDS } from "./match.js";
import { suggestedRoles as fromBackground } from "./translate.js";

const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";
const RANGE = new RegExp(`(?:${MONTH}\\s+|\\d{1,2}/)?((?:19|20)\\d{2})\\s*(?:-|–|—|to)\\s*(?:(present|current|now|today)|(?:${MONTH}\\s+|\\d{1,2}/)?((?:19|20)\\d{2}))`, "gi");

// Words that make a short line read like a job title.
const TITLE_WORD = /\b(manager|agent|specialist|coordinator|buyer|estimator|analyst|consultant|supervisor|lead|director|representative|rep|associate|engineer|technician|foreman|superintendent|administrator|assistant|owner|planner|purchaser|salesperson|clerk|dispatcher|scheduler|trainer|advisor|officer|president|founder|operator|installer|designer|developer|accountant|controller|expeditor|merchandiser)\b/i;
const SECTION = /^(profile|summary|experience|work experience|professional experience|education|skills|core skills|certifications|references|projects|objective)\b/i;

// Skills and tools people in the trades, building materials, logistics and ops list on resumes.
export const SKILL_WORDS = [
  "quoting", "pricing", "estimating", "takeoffs", "takeoff", "bids", "bidding", "purchasing", "procurement", "purchase orders",
  "vendor management", "supplier management", "negotiation", "inventory", "receiving", "scheduling", "dispatch", "logistics",
  "supply chain", "forecasting", "budgeting", "P&L", "project management", "customer service", "account management",
  "training", "onboarding", "implementation", "user acceptance testing", "process improvement", "reporting", "data entry",
  "Excel", "Power BI", "Tableau", "SQL", "Salesforce", "HubSpot", "Procore", "Bluebeam", "PlanSwift", "AutoCAD", "Revit",
  "SAP", "Oracle", "NetSuite", "QuickBooks", "Epicor", "BisTrack", "Spruce", "Microsoft Dynamics", "Dynamics GP", "Hyphen",
  "SupplyPro", "BuildPro", "ServiceTitan", "Buildertrend", "JobNimbus", "Sage", "Viewpoint", "Foundation", "ERP", "CRM",
  "OSHA", "blueprints", "plans", "submittals", "change orders", "material lists", "safety",
];
const SKIP_SKILL_IF = { takeoff: "takeoffs", plans: null, safety: null, receiving: null, reporting: null, bids: "bidding" };

const clean = s => s.replace(/\s+/g, " ").trim();
const words = s => s.toLowerCase().replace(/[^a-z0-9& ]+/g, " ");

export function parseResume(text, now = new Date()) {
  const lines = String(text || "").split(/\r?\n/).map(clean).filter(Boolean);
  const titles = [], companies = [];
  const addTitle = t => {
    for (let part of t.split(/\s+\/\s+|\s*&\s*(?=[A-Z])/)) {
      part = clean(part.replace(/[,(].*$/, "")).replace(/^[-•·*]\s*/, "");
      if (part.length < 4 || part.length > 48 || !TITLE_WORD.test(part)) continue;
      if (!titles.some(x => x.toLowerCase() === part.toLowerCase())) titles.push(part);
    }
  };

  lines.forEach((line, i) => {
    if (SECTION.test(line) || line.length > 110 || (line === line.toUpperCase() && /[A-Z]{3}/.test(line))) return;   // all-caps lines are headings and headlines
    // "Purchasing Agent | R.T. Moore Mechanical" or "Purchasing Agent — R.T. Moore, 2019 – 2023"
    const parts = line.split(/\s+[|•·]\s+|\s+[–—]\s+(?=[A-Z])/);
    if (parts.length >= 2 && TITLE_WORD.test(parts[0]) && !RANGE.test(parts[0]) && !/^(present|current|now|today)\b/i.test(parts[1])) {
      RANGE.lastIndex = 0;
      addTitle(parts[0]);
      const co = clean(parts[1].replace(new RegExp(RANGE.source, "i"), "").replace(/[,·|]+$/, ""));
      if (co && co.length < 60 && !companies.includes(co)) companies.push(co);
      return;
    }
    RANGE.lastIndex = 0;
    // A short title line with its dates on the same line, or one of the next two (a company line can sit between).
    const near = [line.replace(/^[^0-9]*?(?=\b(?:19|20)\d{2})/, ""), lines[i + 1] || "", lines[i + 2] || ""];
    if (line.length < 70 && TITLE_WORD.test(line) && !/[.;:]$/.test(line) && near.some(x => new RegExp(RANGE.source, "i").test(x)))
      addTitle(line.replace(new RegExp(RANGE.source, "gi"), "").replace(new RegExp(`\\b${MONTH}\\s*$`, "i"), "").replace(/[,·|–—-]+\s*$/, ""));
  });

  // Years: from the earliest job start to the latest end (or today).
  let first = null, last = null;
  for (const m of String(text || "").matchAll(RANGE)) {
    const start = Number(m[1]), end = m[2] ? now.getFullYear() : Number(m[3]);
    if (start > now.getFullYear() || end < start || end - start > 45) continue;
    first = first === null ? start : Math.min(first, start);
    last = last === null ? end : Math.max(last, end);
  }
  const years = first === null ? 0 : Math.max(0, Math.min(45, last - first));

  const body = words(text);
  const has = w => new RegExp(`\\b${w.toLowerCase().replace(/[^a-z0-9& ]+/g, " ").replace(/\s+/g, "\\s+")}\\b`).test(body);
  const skills = [];
  for (const s of SKILL_WORDS) {
    if (!has(s)) continue;
    const better = SKIP_SKILL_IF[s.toLowerCase()];
    if (better === null) continue;
    if (better && skills.includes(better)) continue;
    if (!skills.some(x => x.toLowerCase() === s.toLowerCase())) skills.push(s);
  }

  if (skills.includes("Dynamics GP")) skills.splice(skills.indexOf("Microsoft Dynamics"), skills.includes("Microsoft Dynamics") ? 1 : 0);
  const industries = Object.entries(FIELD_WORDS)
    .map(([field, list]) => [field, new Set(list.filter(w => has(w))).size])
    .filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([f]) => f);

  // Roles worth a look: ones their past titles or skills already point at.
  const titleText = words(titles.join(" "));
  const roles = Object.entries(ROLE_WORDS).filter(([role, list]) =>
    [role, ...list].some(w => new RegExp(`\\b${w}`).test(titleText)) ||
    (role === "pricing" && /\b(pricing|quoting|quotations?)\b/.test(body)) ||
    (role === "estimating" && /\b(estimating|takeoffs?)\b/.test(body)) ||
    (role === "purchasing" && /\b(purchasing|procurement|procured)\b/.test(body))
  ).map(([role]) => role);
  // Roles a recruiter would read their background as pointing to (trades, counter, field), after the ones their titles name.
  for (const r of fromBackground(titles)) if (!roles.includes(r)) roles.push(r);

  return { pastTitles: titles.slice(0, 6), pastCompanies: companies.slice(0, 6), years, skills: skills.slice(0, 15), industries, suggestedRoles: roles.slice(0, 6) };
}
