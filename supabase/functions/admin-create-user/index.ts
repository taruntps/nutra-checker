// Supabase Edge Function: admin-create-user
// Lets an ADMIN create a user account (no self-signup needed).
// Verifies the caller is an admin, creates the auth user, sets their profile
// (name, username, plan + validity, company, mobile) and stores the visible
// password for the admin. Uses the service role (server-side only).
//
// No extra secrets needed — SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
// injected automatically.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const PLAN_CHECKS: Record<string, number> = {
  free: 5, basic: 10, pro: 50, monthly: 500, unlimited: 99999, enterprise: 99999,
};
const VALID_DAYS: Record<string, number> = { monthly: 30, unlimited: 180 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return j({ ok: false, error: "method not allowed" }, 405);

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // caller must be an admin
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: who, error: wErr } = await admin.auth.getUser(jwt);
    if (wErr || !who?.user) return j({ ok: false, error: "not authenticated" }, 401);
    const { data: me } = await admin.from("profiles").select("is_admin").eq("id", who.user.id).single();
    if (!me?.is_admin) return j({ ok: false, error: "forbidden" }, 403);

    const b = await req.json();
    const email = (b.email || "").trim().toLowerCase();
    const password = (b.password || "").trim();
    if (!email || !password) return j({ ok: false, error: "email and password required" }, 400);
    if (password.length < 6) return j({ ok: false, error: "password must be at least 6 characters" }, 400);
    const plan = (b.plan && PLAN_CHECKS[b.plan] != null) ? b.plan : "free";

    // create the auth user (auto-confirmed)
    const created = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { name: b.name || "" },
    });
    if (created.error) return j({ ok: false, error: created.error.message }, 400);
    const uid = created.data.user.id;

    const exp = VALID_DAYS[plan] ? new Date(Date.now() + VALID_DAYS[plan] * 864e5).toISOString() : null;
    await admin.from("profiles").update({
      name: b.name || null,
      username: (b.username || "").trim().toLowerCase() || null,
      company: b.company || null,
      mobile: b.mobile || null,
      plan, plan_checks: PLAN_CHECKS[plan], used: 0, plan_expires_at: exp,
      auth_method: "password", status: "active",
    }).eq("id", uid);

    // store the visible password for the admin (locked credentials table)
    try { await admin.rpc("admin_set_credential", { p_user: uid, p_plain: password, p_method: "password" }); } catch (_e) { /* noop */ }

    return j({ ok: true, id: uid, email, plan });
  } catch (e) {
    return j({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
});
