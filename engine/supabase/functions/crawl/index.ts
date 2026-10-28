// Supabase Edge Function: fills the job index. pg_cron calls it every 4 hours (see migrations/20261024_job_index.sql).
// POST {} crawls every active board plus the keyword sites, upserts into postings, and retires postings that left a board.
// It also tries a few board_candidates each run and records which ones have open jobs, for review before they go live.
// Runs at most once every 20 minutes no matter who calls it.
import { crawl, probe, toRow } from "./src/crawl.js";
import * as S from "./src/sources/index.js";

const URL_ = Deno.env.get("SUPABASE_URL")!, KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const rest = async (path: string, init: RequestInit = {}) => {
  const res = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  if (!res.ok) throw new Error(`${path.split("?")[0]}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();   // PATCH and minimal POST answer with no body
  return text ? JSON.parse(text) : null;
};

// One function, two jobs. POST {} is the 4-hour pass over the small boards and the keyword feeds.
// POST {"deep": true} reads the next big employer board (Workday, iCIMS, UKG, SmartRecruiters, Oracle), least recently tried first;
// pg_cron calls it every 5 minutes so each big board is fresh every couple of hours without one run doing too much.
// The board is marked tried before it is read, so one that runs out of time can't hold up the rest.
async function deepPass() {
  const started = new Date().toISOString();
  const boards = await rest(`boards?select=ats,token,name,industries&active=eq.true&ats=in.(${[...S.DEEP].join(",")})&order=last_tried_at.asc.nullsfirst&limit=1`);
  if (!boards.length) return { boards: 0 };
  for (const b of boards) await rest(`boards?ats=eq.${b.ats}&token=eq.${encodeURIComponent(b.token)}`, { method: "PATCH", body: JSON.stringify({ last_tried_at: started }) });
  const keys = boards.map((b: { ats: string; token: string }) => `${b.ats}:${b.token}`);
  const known = new Map<string, Set<string>>();
  const rows0 = await rest(`postings?select=id,board_key&active=eq.true&board_key=in.${encodeURIComponent(`(${keys.map((k: string) => `"${k}"`).join(",")})`)}&limit=5000`);
  for (const r of rows0) { if (!known.has(r.board_key)) known.set(r.board_key, new Set()); known.get(r.board_key)!.add(r.id); }
  const { jobs, report } = await crawl(boards, S, known, { feeds: false });
  await save(jobs, started);
  // A board that answered but whose posting list changed retires what's gone; one that failed is left as it was.
  const retired = await rest("rpc/finish_crawl", { method: "POST", body: JSON.stringify({ p_started: started, p_keys: report.filter(r => r.ok).map(r => r.key) }) });
  await markBoards(report, started);
  return { boards: keys, postings: jobs.length, retired, report };
}

async function save(jobs: Record<string, unknown>[], started: string) {
  const rows = jobs.map(j => toRow(j, started));
  // Rows without a description keep the one already stored; a batch has to share one set of columns.
  for (const part of [rows.filter(r => "description" in r), rows.filter(r => !("description" in r))])
    for (let i = 0; i < part.length; i += 400)
      await rest("postings?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(part.slice(i, i + 400)) });
}

async function markBoards(report: { key: string; ok: boolean; count: number; error?: string }[], started: string) {
  for (const r of report.filter(r => r.key.includes(":"))) {
    const i = r.key.indexOf(":"), ats = r.key.slice(0, i), token = r.key.slice(i + 1);
    await rest(`boards?ats=eq.${ats}&token=eq.${encodeURIComponent(token)}`, { method: "PATCH", body: JSON.stringify(r.ok ? { last_ok_at: started, last_count: r.count, last_error: null } : { last_error: r.error }) });
  }
}

Deno.serve(async req => {
  const body = await req.json().catch(() => ({}));
  if (body.deep) {
    try { return Response.json(await deepPass()); }
    catch (e) { return Response.json({ error: String((e as Error).message || e) }, { status: 500 }); }
  }
  const started = new Date().toISOString();
  try {
    const last = await rest("crawl_runs?select=started_at&order=started_at.desc&limit=1");
    if (last[0] && Date.now() - Date.parse(last[0].started_at) < 20 * 60e3) return Response.json({ skipped: "Crawled less than 20 minutes ago" });
    const [run] = await rest("crawl_runs", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ started_at: started }) });
    const boards = (await rest("boards?select=ats,token,name,industries&active=eq.true")).filter((b: { ats: string }) => !S.DEEP.has(b.ats));
    const { jobs, report } = await crawl(boards, S);
    await save(jobs, started);
    const okKeys = [...new Set(report.filter(r => r.ok).map(r => r.key))];
    const retired = await rest("rpc/finish_crawl", { method: "POST", body: JSON.stringify({ p_started: started, p_keys: okKeys }) });
    await markBoards(report, started);
    // A handful of untried board names per run.
    const cands = await rest("board_candidates?select=ats,token&tried_at=is.null&ats=in.(greenhouse,lever,ashby)&limit=120");
    if (cands.length) {
      const hits = await probe(cands, S);
      const now = new Date().toISOString();
      await rest("board_candidates?on_conflict=ats,token", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(cands.map((c: { ats: string; token: string }) => { const h = hits.find(x => x.ats === c.ats && x.token === c.token); return { ...c, tried_at: now, count: h?.count || 0, titles: h?.titles || [], sample: h?.sample || null }; })) });
    }
    await rest(`crawl_runs?id=eq.${run.id}`, { method: "PATCH", body: JSON.stringify({ finished_at: new Date().toISOString(), ok: true, postings: jobs.length, retired, report }) });
    return Response.json({ postings: jobs.length, retired, sources: report.length, failed: report.filter(r => !r.ok).length });
  } catch (e) {
    try { await rest(`crawl_runs?started_at=eq.${encodeURIComponent(started)}`, { method: "PATCH", body: JSON.stringify({ finished_at: new Date().toISOString(), ok: false, report: { error: String((e as Error).message || e) } }) }); } catch { /* nothing more to do */ }
    return Response.json({ error: String((e as Error).message || e) }, { status: 500 });
  }
});
