// Supabase Edge Function: verify-payment
// Securely verifies a Razorpay payment and upgrades the signed-in user's plan.
// The browser never decides the plan — this runs on Supabase's servers.
//
// Required secrets (set in Supabase → Edge Functions → Secrets):
//   RAZORPAY_KEY_ID      = your Razorpay Key Id  (rzp_live_... or rzp_test_...)
//   RAZORPAY_KEY_SECRET  = your Razorpay Key Secret
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Expected price per plan, in paise (₹1 = 100 paise). Keep in sync with /create-order.
const PRICE_PAISE: Record<string, { amount: number; checks: number }> = {
  basic:     { amount: 49900,  checks: 10 },
  pro:       { amount: 149900, checks: 50 },
  monthly:   { amount: 299900, checks: 99999 },
  unlimited: { amount: 999900, checks: 99999 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return jsonResp({ ok: false, error: "method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!KEY_ID || !KEY_SECRET) return jsonResp({ ok: false, error: "razorpay secrets not configured" }, 500);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) Identify the signed-in user from their token
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u, error: uErr } = await admin.auth.getUser(jwt);
    if (uErr || !u?.user) return jsonResp({ ok: false, error: "not authenticated" }, 401);
    const userId = u.user.id;

    // 2) Read & validate input
    const { plan, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
    if (!plan || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return jsonResp({ ok: false, error: "missing fields" }, 400);
    }
    const expectedPlan = PRICE_PAISE[plan];
    if (!expectedPlan) return jsonResp({ ok: false, error: "unknown plan" }, 400);

    // 3) Verify the Razorpay signature (proves the payment is genuine)
    const expectedSig = await hmacHex(KEY_SECRET, `${razorpay_order_id}|${razorpay_payment_id}`);
    if (expectedSig !== razorpay_signature) return jsonResp({ ok: false, error: "signature mismatch" }, 400);

    // 4) Confirm with Razorpay's API: captured + correct order + correct amount
    const rp = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
      headers: { Authorization: "Basic " + btoa(`${KEY_ID}:${KEY_SECRET}`) },
    });
    const pay = await rp.json();
    if (!rp.ok) return jsonResp({ ok: false, error: "razorpay lookup failed" }, 400);
    if (pay.order_id !== razorpay_order_id) return jsonResp({ ok: false, error: "order mismatch" }, 400);
    if (pay.status !== "captured" && pay.status !== "authorized") return jsonResp({ ok: false, error: "payment not captured" }, 400);
    if (Number(pay.amount) !== expectedPlan.amount) return jsonResp({ ok: false, error: "amount mismatch" }, 400);

    // 5) Upgrade the user's plan (server-trusted)
    const { error: upErr } = await admin
      .from("profiles")
      .update({ plan, plan_checks: expectedPlan.checks, used: 0 })
      .eq("id", userId);
    if (upErr) return jsonResp({ ok: false, error: upErr.message }, 500);

    return jsonResp({ ok: true, plan, plan_checks: expectedPlan.checks });
  } catch (e) {
    return jsonResp({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
});
