// The job index: one pass over every source, run on a schedule so searches read from one table
// instead of asking forty sites at once. The server stores what this returns (see supabase/functions/crawl).

import * as S from "./sources/index.js";
import { ROLE_WORDS } from "./match.js";

export async function crawl(boards, sources = S) {
  const report = [], found = [];
  const run = async (name, key, fn) => {
    try { const list = await fn(); list.forEach(j => found.push({ ...j, boardKey: key })); report.push({ key, name, ok: true, count: list.length }); }
    catch (e) { report.push({ key, name, ok: false, count: 0, error: String(e.message || e).slice(0, 200) }); }
  };
  const tasks = boards.map(b => run(b.name, `${b.ats}:${b.token}`, async () => (await sources.readBoard(b)).map(j => ({ ...j, industries: b.industries || [] }))));
  for (const role of Object.keys(ROLE_WORDS)) {
    tasks.push(run(`Remotive: ${role}`, "remotive", () => sources.remotive({ keyword: role })));
    tasks.push(run(`Jobicy: ${role}`, "jobicy", () => sources.jobicy({ keyword: role })));
  }
  tasks.push(run("The Muse: remote", "muse", () => sources.themuse({ remote: true })));
  await Promise.all(tasks);
  const byId = new Map();
  for (const j of found) if (j.id && j.title && j.company && /^https:\/\//.test(j.applyUrl || "") && !byId.has(j.id)) byId.set(j.id, j);
  return { jobs: [...byId.values()], report };
}

// Tries board names on each hiring system and says which ones have open jobs, so new companies can be reviewed and added.
export async function probe(candidates, sources = S) {
  const out = [];
  await Promise.all(candidates.slice(0, 400).map(async c => {
    try {
      const jobs = await sources.readBoard({ ...c, name: c.name || c.token });
      if (jobs.length) out.push({ ats: c.ats, token: c.token, count: jobs.length, titles: jobs.slice(0, 4).map(j => j.title), sample: jobs[0]?.applyUrl || "" });
    } catch { /* no board under that name */ }
  }));
  return out;
}

// The posting as a table row.
export const toRow = (j, seenAt) => ({
  id: j.id, board_key: j.boardKey, company: j.company, title: j.title, location: j.location || null, remote: !!j.remote,
  pay_min: j.payMin ? Math.round(j.payMin) : null, pay_max: j.payMax ? Math.round(j.payMax) : null, pay_text: j.payText || null,
  posted_at: j.postedAt || null, first_published: j.firstPublished || null, apply_url: j.applyUrl,
  description: String(j.description || "").slice(0, 8000), source: j.source || null, industries: j.industries || [], seen_at: seenAt, active: true,
});

// And back into the posting shape the matcher reads.
export const fromRow = r => ({
  id: r.id, title: r.title, company: r.company, location: r.location || "Not Listed", remote: r.remote,
  payMin: r.pay_min, payMax: r.pay_max, payText: r.pay_text || "", postedAt: r.posted_at || r.first_seen,
  firstPublished: r.first_published, applyUrl: r.apply_url, description: r.description || "", source: r.source, industries: r.industries || [],
  indexedFirstSeen: r.first_seen,
});

// The title words a search needs from the index: the roles they want and the jobs they've held.
export function indexWords(p) {
  const words = new Set();
  for (const r of p.wants?.roles || []) for (const w of ROLE_WORDS[r] || [r]) words.add(w.toLowerCase());
  for (const t of p.pastTitles || []) { const w = String(t).toLowerCase().replace(/\b(senior|sr\.?|junior|jr\.?|lead|i{1,3})\b/g, "").trim(); if (w.length > 2) words.add(w); }
  return [...words].slice(0, 60);
}
