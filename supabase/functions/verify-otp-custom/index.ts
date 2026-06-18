// Supabase Edge Function: verify-otp-custom
// Validates the OTP from otp_sessions and (for reset) updates the user's password via admin.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return j({ ok: false, error: "method not allowed" });

  try {
    const { email, otp, purpose, new_password } = await req.json();

    if (!email || !email.includes("@")) return j({ ok: false, error: "valid email required" });
    if (!otp) return j({ ok: false, error: "otp required" });
    if (purpose !== "reset" && purpose !== "signup") return j({ ok: false, error: "invalid purpose" });
    if (purpose === "reset" && (!new_password || new_password.length < 6))
      return j({ ok: false, error: "new_password required (min 6 chars)" });

    const norm = email.toLowerCase().trim();
    const inputHash = await sha256(otp.toString().replace(/\s+/g, "").trim());

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Find latest valid session
    const { data: session } = await admin
      .from("otp_sessions")
      .select("id, otp_hash")
      .eq("email", norm)
      .eq("purpose", purpose)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!session) return j({ ok: false, error: "Invalid or expired code. Please request a new one." });
    if (session.otp_hash !== inputHash) return j({ ok: false, error: "Incorrect code. Please try again." });

    // Mark used
    await admin.from("otp_sessions").update({ used: true }).eq("id", session.id);

    // For password reset: update via admin
    if (purpose === "reset") {
      const { data: prof } = await admin.from("profiles").select("id").eq("email", norm).maybeSingle();
      if (!prof?.id) return j({ ok: false, error: "Account not found" });

      const { error: pwErr } = await admin.auth.admin.updateUserById(prof.id, { password: new_password });
      if (pwErr) return j({ ok: false, error: pwErr.message });
    }

    return j({ ok: true });
  } catch (e) {
    return j({ ok: false, error: String((e as Error)?.message || e) });
  }
});
