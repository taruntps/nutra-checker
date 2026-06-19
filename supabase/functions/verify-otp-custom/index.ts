// Supabase Edge Function: verify-otp-custom
// Validates the OTP from otp_sessions and (for reset) updates the user's password.
//
// SECURITY: attempt counter is incremented atomically via otp_increment_attempt() RPC
// (a single UPDATE ... RETURNING) so concurrent requests cannot race past MAX_ATTEMPTS.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const MAX_ATTEMPTS = 5;

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return j({ ok: false, error: "method not allowed" }, 405);

  try {
    const { email, otp, purpose, new_password } = await req.json();

    if (!email || !email.includes("@")) return j({ ok: false, error: "valid email required" }, 400);
    if (!otp) return j({ ok: false, error: "otp required" }, 400);
    if (purpose !== "reset" && purpose !== "signup") return j({ ok: false, error: "invalid purpose" }, 400);
    if (purpose === "reset" && (!new_password || new_password.length < 8))
      return j({ ok: false, error: "new_password required (min 8 chars)" }, 400);

    const norm = email.toLowerCase().trim();
    const inputHash = await sha256(otp.toString().replace(/\s+/g, "").trim());
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. Find the live session
    const { data: session } = await admin.from("otp_sessions")
      .select("id, otp_hash")
      .eq("email", norm).eq("purpose", purpose).eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (!session) return j({ ok: false, error: "Invalid or expired code. Please request a new one." }, 400);

    // 2. Atomically claim one attempt slot.
    //    Returns the new attempts count, or -1 if MAX_ATTEMPTS already reached.
    //    Because it's a single UPDATE, two concurrent requests cannot both read
    //    the same counter value — PostgreSQL serialises the increment.
    const { data: newAttempts, error: slotErr } = await admin.rpc("otp_increment_attempt", {
      p_id: session.id,
      p_max: MAX_ATTEMPTS,
    });

    if (slotErr) {
      console.error("otp_increment_attempt error", slotErr);
      return j({ ok: false, error: "Server error. Please try again." }, 500);
    }

    if ((newAttempts as number) < 0) {
      // Already at max before this request — burn the session for safety
      await admin.from("otp_sessions").update({ used: true }).eq("id", session.id);
      return j({ ok: false, error: "Too many incorrect attempts. Please request a new code." }, 429);
    }

    // 3. Check the OTP
    if (session.otp_hash !== inputHash) {
      if ((newAttempts as number) >= MAX_ATTEMPTS) {
        await admin.from("otp_sessions").update({ used: true }).eq("id", session.id);
        return j({ ok: false, error: "Too many incorrect attempts. Please request a new code." }, 429);
      }
      return j({ ok: false, error: "Incorrect code. Please try again." }, 400);
    }

    // 4. Correct OTP — burn session
    await admin.from("otp_sessions").update({ used: true }).eq("id", session.id);

    if (purpose === "reset") {
      const { data: prof } = await admin.from("profiles").select("id").eq("email", norm).maybeSingle();
      if (!prof?.id) return j({ ok: false, error: "Account not found" }, 404);
      const { error: pwErr } = await admin.auth.admin.updateUserById(prof.id, { password: new_password });
      if (pwErr) return j({ ok: false, error: pwErr.message }, 500);
    }

    return j({ ok: true });
  } catch (e) {
    return j({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
});
