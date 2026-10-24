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
  return res.status === 204 || res.status === 201 && !(init.headers as Record<string, string> | undefined)?.Prefer?.includes("representation") ? null : res.json();
};

Deno.serve(async () => {
  const started = new Date().toISOString();
  try {
    const last = await rest("crawl_runs?select=started_at&order=started_at.desc&limit=1");
    if (last[0] && Date.now() - Date.parse(last[0].started_at) < 20 * 60e3) return Response.json({ skipped: "Crawled less than 20 minutes ago" });
    const [run] = await rest("crawl_runs", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ started_at: started }) });
    const boards = await rest("boards?select=ats,token,name,industries&active=eq.true");
    const { jobs, report } = await crawl(boards, S);
    for (let i = 0; i < jobs.length; i += 400)
      await rest("postings?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(jobs.slice(i, i + 400).map(j => toRow(j, started))) });
    const okKeys = [...new Set(report.filter(r => r.ok).map(r => r.key))];
    const retired = await rest("rpc/finish_crawl", { method: "POST", body: JSON.stringify({ p_started: started, p_keys: okKeys }) });
    for (const r of report.filter(r => r.key.includes(":"))) {
      const [ats, token] = r.key.split(":");
      await rest(`boards?ats=eq.${ats}&token=eq.${encodeURIComponent(token)}`, { method: "PATCH", body: JSON.stringify(r.ok ? { last_ok_at: started, last_count: r.count, last_error: null } : { last_error: r.error }) });
    }
    // A handful of untried board names per run.
    const cands = await rest("board_candidates?select=ats,token&tried_at=is.null&limit=120");
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
