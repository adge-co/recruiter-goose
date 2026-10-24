// Is this posting real and still open, what will knock you out, and the insider moves for it.
// Plain rules over what the posting and the company's own board say. Never sold as certain.

const DAY = 864e5;
const daysSince = (iso, now) => { const t = Date.parse(iso); return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / DAY)) : null; };
export const mdy = iso => { const d = new Date(iso); return isNaN(d) ? "" : `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}-${d.getUTCFullYear()}`; };

// Collecting resumes for later, not filling a seat now.
const PIPELINE = /\b(always (hiring|accepting|looking)|talent (pool|community|network|pipeline)|general application|future (openings?|opportunities|roles)|evergreen|pipeline (role|posting|requisition)|not (currently )?an active (opening|position)|join our talent)\b/i;
const ENTRY = /\b(entry[- ]level|new grads?|recent graduates?|no experience (required|needed))\b/i;

// States whose laws say a posting must show its pay range (research 01, checked 10-2026).
export const PAY_LAW_STATES = {
  CA: "California", CO: "Colorado", DC: "Washington, DC", HI: "Hawaii", IL: "Illinois", MD: "Maryland", MA: "Massachusetts",
  MN: "Minnesota", NJ: "New Jersey", NY: "New York", VT: "Vermont", WA: "Washington",
};
const STATE_NAMES = Object.fromEntries(Object.entries(PAY_LAW_STATES).map(([k, v]) => [v.toLowerCase(), k]));
const CITY_STATE = { "new york city": "NY", nyc: "NY", "san francisco": "CA", "los angeles": "CA", seattle: "WA", denver: "CO", chicago: "IL", boston: "MA", "washington dc": "DC" };

export function payLawState(location) {
  const loc = String(location || "");
  const m = loc.match(/,\s*([A-Z]{2})\b/);
  if (m && PAY_LAW_STATES[m[1]]) return m[1];
  const low = loc.toLowerCase();
  for (const [name, code] of Object.entries(STATE_NAMES)) if (new RegExp(`\\b${name}\\b`).test(low) && !(code === "WA" && /washington,? ?dc/.test(low))) return code;
  for (const [city, code] of Object.entries(CITY_STATE)) if (low.includes(city)) return code;
  return null;
}

// The evidence trail for one posting, and a plain label from it.
// seen: { firstSeen, lastSeen, timesSeen, reposts, repostFirstSeen } from the app's own record of company boards.
export function postingCheck(job, seen = null, now = Date.now()) {
  const good = [], warn = [];
  const opened = job.firstPublished || job.postedAt;
  const open = daysSince(opened, now);
  const text = `${job.title || ""} ${job.description || ""}`;
  let pipeline = false, stale = 0;

  if (open !== null) {
    if (open <= 14) good.push(`Open ${open === 0 ? "Since Today" : open === 1 ? "1 Day" : open + " Days"}, First Posted ${mdy(opened)}`);
    else if (open <= 60) good.push(`Open ${open} Days, First Posted ${mdy(opened)}`);
    else { warn.push(`Open ${open} Days. Most real openings fill or close well before that.`); stale++; }
  }
  if (job.source === "Company Site") good.push(`On the Company's Own Job Board as of ${mdy(seen?.lastSeen || now)}`);
  if (seen?.reposts) { warn.push(`Reposted ${seen.reposts === 1 ? "Once" : seen.reposts + " Times"} Since ${mdy(seen.repostFirstSeen)}`); stale += seen.reposts >= 2 ? 2 : 1; }
  if (PIPELINE.test(text)) { pipeline = true; warn.push("Pipeline Posting: They're Collecting Resumes for Future Openings"); }
  const yrs = [...String(job.description || "").matchAll(/(\d{1,2})\s*\+?\s*(?:or more\s+)?years/gi)].map(m => Number(m[1])).filter(n => n < 30);
  if (ENTRY.test(text) && yrs.length && Math.max(...yrs) >= 5) { warn.push(`Asks for Entry Level and ${Math.max(...yrs)}+ Years`); stale++; }
  if (job.payMin && job.payMax && job.payMax / job.payMin > 2) warn.push("Pay Range Is Very Wide");
  if (job.payMax || job.payMin) good.push("Pay Listed");
  else {
    const st = payLawState(job.location);
    if (st && !job.remote) warn.push(`Pay Not Listed, Though ${PAY_LAW_STATES[st]} Requires It`);
  }
  if (String(job.description || "").replace(/\s+/g, " ").trim().length < 400) { warn.push("Thin Description: No Team or Duties Named"); stale++; }

  const label = pipeline ? "Pipeline" : stale >= 2 ? "Likely Stale" : warn.length ? "Check First" : "Looks Real";
  return { label, good, warn, openDays: open, fresh: open !== null && open <= 4 };
}

// What in the posting can knock someone out, checked against their profile. status: ok, check or miss.
const CERTS = [
  ["CDL", /\b(cdl|commercial driver'?s license)\b/i],
  ["OSHA 30", /\bosha[ -]?30\b/i], ["OSHA 10", /\bosha[ -]?10\b/i],
  ["PE License", /\b(p\.?e\.? licen[cs]e|professional engineer)\b/i], ["PMP", /\bpmp\b/i], ["LEED", /\bleed (ap|ga|green)\b/i],
  ["Journeyman or Master License", /\b(journeyman|master) (license|licence|plumber|electrician)\b/i],
  ["CPSM or CPIM", /\b(cpsm|cpim|cscp|cpm)\b/i], ["Forklift Certification", /\bforklift (cert|license)/i],
];
const has = (list, re) => list.some(s => re.test(String(s)));

export function knockouts(job, profile = {}) {
  const d = String(job.description || ""), out = [];
  const mine = [...(profile.skills || []), ...(profile.certs || []), ...(profile.pastTitles || [])];
  const yrs = [...d.matchAll(/(\d{1,2})\s*\+?\s*(?:or more\s+)?years/gi)].map(m => Number(m[1])).filter(n => n > 0 && n < 30);
  if (yrs.length) {
    const need = Math.max(...yrs), have = Number(profile.years) || 0;
    out.push({ need: `${need}+ Years`, status: have >= need ? "ok" : have >= need - 2 ? "check" : "miss", note: have ? `You have ${have}` : "Add your years on the Me tab" });
  }
  for (const [name, re] of CERTS) if (re.test(d)) {
    const required = new RegExp(`(required|must have|must hold)[^.]{0,60}${re.source}|${re.source}[^.]{0,40}(required|is a must)`, "i").test(d);
    out.push({ need: name, status: has(mine, re) ? "ok" : required ? "miss" : "check", note: has(mine, re) ? "You listed it" : required ? "Required" : "Preferred" });
  }
  if (/\b(bachelor'?s|4[- ]year degree|b\.?s\.? in|b\.?a\.? in)\b/i.test(d)) {
    const equiv = /\bor (equivalent|related) (work )?experience\b/i.test(d);
    out.push({ need: "Bachelor's Degree", status: "check", note: equiv ? "Or equivalent experience" : "Ask if experience can count" });
  }
  const travel = d.match(/travel[^.]{0,40}?(\d{2})\s*%|(\d{2})\s*%[^.]{0,30}travel/i);
  if (travel) { const pct = Number(travel[1] || travel[2]); out.push({ need: `Travel ${pct}%`, status: pct >= 50 ? "check" : "ok", note: pct >= 50 ? "Heavy travel" : "Some travel" }); }
  if (/\b(nights?|weekends?|on[- ]call|rotating shifts?|overtime)\b/i.test(d)) out.push({ need: "Nights, Weekends or On-Call", status: "check", note: "Named in the posting" });
  if (/\b(valid driver'?s license|clean driving record|motor vehicle record)\b/i.test(d)) out.push({ need: "Driver's License", status: "ok", note: "Clean record asked for" });
  if (/\b(security clearance|clearance required|secret clearance)\b/i.test(d)) out.push({ need: "Security Clearance", status: "miss", note: "Required" });
  if (/\b(no (visa )?sponsorship|not (able to )?sponsor|must be (legally )?authorized to work)\b/i.test(d)) out.push({ need: "US Work Authorization", status: "ok", note: "No sponsorship" });
  const office = d.match(/\b(\d)\s*days?\s*(a|per)\s*week\s*(in|at)\s*(the\s*)?(office|site)/i);
  if (office) out.push({ need: `${office[1]} Days a Week in the Office`, status: "check", note: "Hybrid" });
  return out;
}

// The moves an insider makes on a job worth going after.
export function insiderMoves(job, profile = {}) {
  const check = postingCheck(job);
  const name = String(profile.name || "").trim();
  const past = (profile.pastTitles || [])[0];
  const moves = [];
  if (check.fresh) moves.push({ key: "fresh", title: "Apply While It's New", text: `Open ${check.openDays === 0 ? "since today" : check.openDays + (check.openDays === 1 ? " day" : " days")}. Most applications on a posting come in its first four days.` });
  const a = /^[aeiou]/i.test(job.title || "") ? "an" : "a";
  moves.push({ key: "referral", title: `Who Do You Know at ${job.company}?`,
    text: "In hiring data from Ashby, referred applicants got interviews 40% of the time and cold applicants 3%. Past vendors, customers, subs and old coworkers all count.",
    note: [`Hey, I saw ${job.company} is hiring ${a} ${job.title}.`, past ? `I've been working as ${/^[aeiou]/i.test(past || "") ? "an" : "a"} ${past} and it lines up well.` : "It lines up well with what I've been doing.",
      "Would you be up for passing my name to the hiring manager, or telling me who that is?", `Thanks either way${name ? ", " + name : ""}.`].join(" "),
    search: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(job.company)}` });
  moves.push({ key: "follow", title: "One Follow-Up After a Week", text: "If you hear nothing in 7 days, one short note to the recruiter or hiring manager. If nothing after 21 days, close it out and move on." });
  return moves;
}
