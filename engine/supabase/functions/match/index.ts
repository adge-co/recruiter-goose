// Supabase Edge Function: POST a profile, get matched postings back.
// POST {profile} runs a search; POST {check: {title, company, description, ...}, profile} judges one pasted posting;
// POST {resume: "plain text"} reads a resume into profile fields; POST {verify: [ids]} says which saved postings are still up;
// POST {background: [titles]} says how a recruiter reads those titles.
// GET returns the industries and role words the app offers as choices.
// Deploy copies ../../../src into this folder as ./src (see README).
// Keys live in the project's secrets: JSEARCH_KEY, ADZUNA_ID, ADZUNA_KEY (none set: keyless sources only).
import { match, checkJob, verify, ROLE_WORDS } from "./src/match.js";
import { INDUSTRIES } from "./src/directory.js";
import { parseResume } from "./src/resume.js";
import { readBackground } from "./src/translate.js";
import * as S0 from "./src/sources/index.js";
import { indexWords, fromRow } from "./src/crawl.js";

// The job index the crawl function fills every 4 hours: one read instead of forty sites.
const S = {
  ...S0,
  async index(p: Record<string, unknown>) {
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/index_search`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ p_words: indexWords(p), p_limit: 2500 }),
    });
    if (!res.ok) throw new Error(`Job index: HTTP ${res.status}`);
    return (await res.json()).map(fromRow);
  },
  // Whether each posting is still live in the index: true, false, or missing.
  async indexStatus(ids: string[]) {
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const list = encodeURIComponent(`(${ids.map(i => `"${i.replace(/"/g, "")}"`).join(",")})`);
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/postings?select=id,active&id=in.${list}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error(`Job index: HTTP ${res.status}`);
    return Object.fromEntries((await res.json()).map((r: { id: string; active: boolean }) => [r.id, r.active]));
  },
};

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };

// First and last seen for company-board postings, kept in postings_seen through the record_seen function.
const store = {
  async record(rows: { id: string; sig: string }[]) {
    if (!rows.length) return {};
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/record_seen`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ rows }),
    });
    if (!res.ok) throw new Error(`Posting history: HTTP ${res.status}`);
    const out: Record<string, unknown> = {};
    for (const r of await res.json()) out[r.id] = { firstSeen: r.first_seen, lastSeen: r.last_seen, timesSeen: r.times_seen, reposts: r.reposts, repostFirstSeen: r.repost_first_seen };
    return out;
  },
};

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    if (req.method === "GET") return Response.json({ industries: INDUSTRIES, roles: Object.keys(ROLE_WORDS) }, { headers: cors });
    const body = await req.json();
    if (typeof body.resume === "string") return Response.json(parseResume(body.resume.slice(0, 60000)), { headers: cors });
    if (Array.isArray(body.background)) return Response.json({ backgrounds: readBackground(body.background.slice(0, 12)) }, { headers: cors });
    if (Array.isArray(body.verify)) return Response.json(await verify(body.verify.slice(0, 60), S), { headers: cors });
    if (body.check) return Response.json(checkJob(body.check, body.profile || {}), { headers: cors });
    const out = await match(body.profile || body, {
      JSEARCH_KEY: Deno.env.get("JSEARCH_KEY"), ADZUNA_ID: Deno.env.get("ADZUNA_ID"), ADZUNA_KEY: Deno.env.get("ADZUNA_KEY"),
    }, S, store);
    return Response.json(out, { headers: cors });
  } catch (e) {
    return Response.json({ error: String((e as Error).message || e) }, { status: 400, headers: cors });
  }
});
