// Supabase Edge Function: send-otp
// Generates a 6-digit OTP, stores a SHA-256 hash, and sends the same code
// to both email (Resend) and SMS (2Factor.in).
// Required secrets: RESEND_API_KEY, TWOFACTOR_API_KEY

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

function emailHtml(otp: string, purpose: string, name: string): string {
  const title = purpose === "reset" ? "Reset your password" : "Verify your account";
  const intro = purpose === "reset"
    ? "We received a request to reset the password for your Regulyze account."
    : "Thank you for signing up for Regulyze. Please verify your account.";
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
<tr><td style="background:#0f2d5e;padding:28px 40px;">
  <p style="margin:0;font-size:22px;font-weight:700;color:#fff;">Regulyze</p>
  <p style="margin:4px 0 0;font-size:12px;color:#93c5fd;">by TPS Xperts</p>
</td></tr>
<tr><td style="padding:36px 40px 24px;">
  <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#111827;">${title}</p>
  <p style="margin:0 0 28px;font-size:15px;color:#4b5563;line-height:1.6;">Hi ${name || "there"},<br/>${intro}</p>
  <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Your verification code</p>
  <div style="background:#eff6ff;border:2px solid #0f2d5e;border-radius:10px;padding:18px 36px;display:inline-block;margin-bottom:24px;">
    <span style="font-size:38px;font-weight:700;color:#0f2d5e;letter-spacing:10px;">${otp}</span>
  </div>
  <p style="margin:0 0 28px;font-size:13px;color:#9ca3af;">Valid for <strong>10 minutes</strong>. Do not share this code with anyone.</p>
  <p style="margin:0;font-size:13px;color:#6b7280;">If you did not request this, you can safely ignore this email.</p>
</td></tr>
<tr><td style="background:#f9fafb;padding:18px 40px;border-top:1px solid #e5e7eb;">
  <p style="margin:0;font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} TPS Xperts · regulyze.in</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return j({ ok: false, error: "method not allowed" });

  try {
    const { email, purpose } = await req.json();
    if (!email || !email.includes("@")) return j({ ok: false, error: "valid email required" });
    if (purpose !== "reset" && purpose !== "signup") return j({ ok: false, error: "purpose must be reset or signup" });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const norm = email.toLowerCase().trim();

    // Get user profile for name + mobile
    const { data: prof } = await admin.from("profiles").select("name,mobile").eq("email", norm).maybeSingle();
    const name = prof?.name || "";
    const rawMobile = prof?.mobile || "";

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await sha256(otp);

    // Invalidate any prior unused sessions for same email+purpose
    await admin.from("otp_sessions").update({ used: true })
      .eq("email", norm).eq("purpose", purpose).eq("used", false);

    // Store new session
    const { error: insErr } = await admin.from("otp_sessions").insert({
      email: norm, otp_hash: otpHash, purpose,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (insErr) return j({ ok: false, error: "Failed to create OTP session" });

    // Send email via Resend
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Regulyze <noreply@regulyze.in>",
          to: [email.trim()],
          subject: purpose === "reset" ? "Reset your Regulyze password" : "Verify your Regulyze account",
          html: emailHtml(otp, purpose, name),
        }),
      });
      if (!res.ok) console.error("Resend error:", await res.text());
    }

    // Send SMS via 2Factor.in (custom OTP — sends our generated code)
    const digits = rawMobile.replace(/\D/g, "");
    let mob10 = digits;
    if (mob10.startsWith("91") && mob10.length === 12) mob10 = mob10.slice(2);
    else if (mob10.startsWith("0") && mob10.length === 11) mob10 = mob10.slice(1);

    if (/^\d{10}$/.test(mob10)) {
      const TF_KEY = Deno.env.get("TWOFACTOR_API_KEY");
      try {
        const smsRes = await fetch(`https://2factor.in/API/V1/${TF_KEY}/SMS/91${mob10}/${otp}`);
        if (!smsRes.ok) console.error("2Factor error:", await smsRes.text());
      } catch (e) { console.error("SMS fetch failed:", e); }
    }

    const smsSent = /^\d{10}$/.test(mob10);
    return j({ ok: true, sms: smsSent });
  } catch (e) {
    return j({ ok: false, error: String((e as Error)?.message || e) });
  }
});
