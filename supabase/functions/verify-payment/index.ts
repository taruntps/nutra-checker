// Supabase Edge Function: verify-payment
// Verifies a Razorpay payment signature, confirms amount matches the plan price
// server-side, guards against replay, then upgrades the user's plan.
//
// Request  (POST JSON): { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan }
// Response (JSON):      { ok: true, plan, checks } | { error }
//
// Required secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
// Requires table: processed_payments (see migrations).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
}
async function getUser(req: Request, admin: ReturnType<typeof adminClient>) {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return null;
  try { const { data, error } = await admin.auth.getUser(jwt); return error ? null : (data?.user ?? null); }
  catch { return null; }
}

// Keep in sync with create-order
const PRICE_PAISE: Record<string, number> = {
  basic: 49900, pro: 149900, monthly: 299900, unlimited: 999900,
};
// Checks granted per plan — keep in sync with PLANS in index.html
const PLAN_CHECKS: Record<string, number> = {
  basic: 10, pro: 50, monthly: 99999, unlimited: 99999,
};

async function hmacSHA256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return j({ error: "method not allowed" }, 405);

  try {
    const admin = adminClient();
    const user = await getUser(req, admin);
    if (!user) return j({ error: "unauthorized" }, 401);

    const KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!KEY_ID || !KEY_SECRET) return j({ error: "razorpay secrets not configured" }, 500);

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = await req.json();
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan) {
      return j({ error: "missing required fields" }, 400);
    }

    // 1. Verify signature: HMAC-SHA256(order_id|payment_id)
    const expected = await hmacSHA256(KEY_SECRET, `${razorpay_order_id}|${razorpay_payment_id}`);
    if (!timingSafeEqual(expected, String(razorpay_signature))) {
      console.error("signature mismatch", { order: razorpay_order_id });
      return j({ error: "invalid payment signature" }, 400);
    }

    // 2. Replay guard — claim this payment_id atomically (PRIMARY KEY).
    const { error: claimErr } = await admin.from("processed_payments").insert({
      payment_id: razorpay_payment_id, order_id: razorpay_order_id, user_id: user.id, plan,
    });
    if (claimErr) {
      console.error("replay/claim rejected", claimErr.code, claimErr.message);
      return j({ error: "This payment has already been processed." }, 409);
    }

    // 3. Confirm amount + capture with Razorpay (prevents plan-swap & unpaid).
    const orderResp = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
      headers: { Authorization: "Basic " + btoa(`${KEY_ID}:${KEY_SECRET}`) },
    });
    if (!orderResp.ok) {
      console.error("razorpay order fetch failed", orderResp.status, await orderResp.text());
      return j({ error: "could not verify order with Razorpay" }, 502);
    }
    const order = await orderResp.json();
    const expectedAmount = PRICE_PAISE[plan];
    if (!expectedAmount) return j({ error: "unknown plan" }, 400);
    if (order.amount !== expectedAmount) {
      console.error("amount mismatch", { orderAmount: order.amount, expectedAmount, plan });
      return j({ error: "payment amount does not match plan price" }, 400);
    }
    if (order.status !== "paid") {
      console.error("order not paid", { order: razorpay_order_id, status: order.status });
      return j({ error: "payment not captured" }, 400);
    }

    // 4. Upgrade the authenticated user's plan.
    const checks = PLAN_CHECKS[plan] ?? 5;
    const { error: updateErr } = await admin
      .from("profiles")
      .update({ plan, plan_checks: checks, used: 0 })
      .eq("id", user.id);
    if (updateErr) {
      console.error("profile update failed", updateErr);
      return j({ error: "plan upgrade failed: " + updateErr.message }, 500);
    }

    console.log("plan upgraded", { userId: user.id, plan, checks });
    return j({ ok: true, plan, checks });
  } catch (e) {
    return j({ error: String((e as Error)?.message || e) }, 500);
  }
});
