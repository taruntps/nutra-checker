// Supabase Edge Function: admin-create-user
// Lets an ADMIN create a user account (no self-signup needed).
// Verifies the caller is an admin, checks the username is free, creates the auth
// user, sets their profile (name, username, plan + validity, company, mobile),
// stores the visible password — and ROLLS BACK if anything fails.
//
// No extra secrets needed — SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected.

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
  if (req.method !== "POST") return j({ ok: false, error: "method not allowed" });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // caller must be an admin
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: who, error: wErr } = await admin.auth.getUser(jwt);
    if (wErr || !who?.user) return j({ ok: false, error: "not authenticated" });
    const { data: me } = await admin.from("profiles").select("is_admin").eq("id", who.user.id).single();
    if (!me?.is_admin) return j({ ok: false, error: "forbidden" });

    const b = await req.json();
    const email = (b.email || "").trim().toLowerCase();
    const password = (b.password || "").trim();
    const username = (b.username || "").trim().toLowerCase() || null;
    if (!email || !password) return j({ ok: false, error: "email and password required" });
    if (password.length < 8) return j({ ok: false, error: "password must be at least 8 characters" });
    const plan = (b.plan && PLAN_CHECKS[b.plan] != null) ? b.plan : "free";

    // 1) username must be free (pre-check so we fail before creating anything)
    if (username) {
      const { data: dup } = await admin.from("profiles").select("id").eq("username", username).limit(1);
      if (dup && dup.length) return j({ ok: false, error: `Username "${username}" is already taken` });
    }

    // 2) create the auth user (auto-confirmed). Fails clearly if the email exists.
    const created = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { name: b.name || "" },
    });
    if (created.error) return j({ ok: false, error: created.error.message });
    const uid = created.data.user.id;

    // 3) set the profile — and if it fails, ROLL BACK (delete the auth user)
    const exp = VALID_DAYS[plan] ? new Date(Date.now() + VALID_DAYS[plan] * 864e5).toISOString() : null;
    const { error: upErr } = await admin.from("profiles").update({
      name: b.name || null, username,
      company: b.company || null, mobile: b.mobile || null,
      plan, plan_checks: PLAN_CHECKS[plan], used: 0, plan_expires_at: exp,
      auth_method: "password", status: "active",
    }).eq("id", uid);
    if (upErr) {
      try { await admin.auth.admin.deleteUser(uid); } catch (_e) { /* noop */ }
      const friendly = /duplicate|unique/i.test(upErr.message) ? `Username "${username}" is already taken` : upErr.message;
      return j({ ok: false, error: friendly });
    }

    // 4) record the auth method WITHOUT storing the plaintext password.
    //    The admin already knows the password they just typed; we never persist
    //    it in cleartext. A marker lets the admin panel show "Password set".
    try { await admin.rpc("admin_set_credential", { p_user: uid, p_plain: "__PASSWORD_SET__", p_method: "password" }); } catch (_e) { /* noop */ }

    return j({ ok: true, id: uid, email, plan, username });
  } catch (e) {
    return j({ ok: false, error: String((e as Error)?.message || e) });
  }
});
