// Supabase Edge Function: make an account with email and password, already confirmed, so nobody waits on an email.
// The app then signs in with the same email and password. Runs without a user token (verify_jwt off).
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const fail = (error: string, status = 400) => Response.json({ error }, { status, headers: cors });

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return fail("Use POST.", 405);
  try {
    const { email, password, name } = await req.json();
    const e = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) || e.length > 200) return fail("That email doesn't look right.");
    if (String(password || "").length < 8) return fail("Use a password with at least 8 characters.");
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/admin/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify({ email: e, password: String(password), email_confirm: true, user_metadata: { name: String(name || "").slice(0, 80) } }),
    });
    const out = await res.json();
    if (!res.ok) return fail(/already|registered|exists/i.test(out.msg || out.message || "") ? "That email already has an account. Sign in instead." : (out.msg || out.message || "Couldn't make the account."), res.status === 422 ? 409 : 400);
    return Response.json({ ok: true }, { headers: cors });
  } catch (err) {
    return fail(String((err as Error).message || err));
  }
});
