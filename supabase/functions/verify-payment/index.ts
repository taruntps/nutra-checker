// Supabase Edge Function: verify-payment
// Verifies a Razorpay payment signature, confirms amount matches the plan price
// server-side, then upgrades the user's plan in the profiles table.
//
// Request  (POST JSON): { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan }
// Response (JSON):      { ok: true, plan, checks } | { error }
//
// Required secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
// Built-in secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected by Supabase)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Keep in sync with create-order
const PRICE_PAISE: Record<string, number> = {
  basic: 49900,
  pro: 149900,
  monthly: 299900,
  unlimited: 999900,
};

// Checks granted per plan — keep in sync with PLANS in index.html
const PLAN_CHECKS: Record<string, number> = {
  basic: 10,
  pro: 50,
  monthly: 99999,
  unlimited: 99999,
};

async function hmacSHA256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return j({ error: "method not allowed" });

  try {
    const KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!KEY_ID || !KEY_SECRET) return j({ error: "razorpay secrets not configured" }, 500);
    if (!SUPABASE_URL || !SERVICE_KEY) return j({ error: "supabase not configured" }, 500);

    // Identify the calling user from their JWT
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
    if (authErr || !user) return j({ error: "unauthorized" }, 401);

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = await req.json();
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan) {
      return j({ error: "missing required fields" }, 400);
    }

    // 1. Verify Razorpay signature: HMAC-SHA256(order_id|payment_id)
    const expected = await hmacSHA256(KEY_SECRET, `${razorpay_order_id}|${razorpay_payment_id}`);
    if (expected !== razorpay_signature) {
      console.error("signature mismatch", { expected, got: razorpay_signature });
      return j({ error: "invalid payment signature" }, 400);
    }

    // 2. Confirm amount on the order matches our price table (prevents plan-swap attacks)
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

    // 3. Upgrade user's plan in profiles table
    const checks = PLAN_CHECKS[plan] ?? 5;
    const { error: updateErr } = await admin
      .from("profiles")
      .update({ plan, checks, used: 0 })
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
