// Supabase Edge Function: POST a profile, get matched postings back.
// POST {profile} runs a search; POST {check: {title, company, description, ...}, profile} judges one pasted posting;
// POST {resume: "plain text"} reads a resume into profile fields.
// GET returns the industries and role words the app offers as choices.
// Deploy copies ../../../src into this folder as ./src (see README).
// Keys live in the project's secrets: JSEARCH_KEY, ADZUNA_ID, ADZUNA_KEY (none set: keyless sources only).
import { match, checkJob, ROLE_WORDS } from "./src/match.js";
import { INDUSTRIES } from "./src/directory.js";
import { parseResume } from "./src/resume.js";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    if (req.method === "GET") return Response.json({ industries: INDUSTRIES, roles: Object.keys(ROLE_WORDS) }, { headers: cors });
    const body = await req.json();
    if (typeof body.resume === "string") return Response.json(parseResume(body.resume.slice(0, 60000)), { headers: cors });
    if (body.check) return Response.json(checkJob(body.check, body.profile || {}), { headers: cors });
    const out = await match(body.profile || body, {
      JSEARCH_KEY: Deno.env.get("JSEARCH_KEY"), ADZUNA_ID: Deno.env.get("ADZUNA_ID"), ADZUNA_KEY: Deno.env.get("ADZUNA_KEY"),
    });
    return Response.json(out, { headers: cors });
  } catch (e) {
    return Response.json({ error: String((e as Error).message || e) }, { status: 400, headers: cors });
  }
});
