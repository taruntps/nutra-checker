// Supabase Edge Function: create-order
// Creates a Razorpay order for a plan upgrade. The amount is decided here
// (server-side) from a fixed price table — the browser cannot choose its own price.
// Optionally applies a DISCOUNT coupon: the discount is computed server-side and
// the coupon code is recorded on the order so verify-payment can re-derive the
// exact amount and mark the coupon used. (Grant/free coupons use redeem_grant_coupon,
// not this function.)
//
// Required secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
// SECURITY: requires a logged-in user (prevents anonymous order spam).

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

// Price per plan in paise (₹1 = 100 paise). Keep in sync with verify-payment.
const PRICE_PAISE: Record<string, number> = {
  basic: 49900,
  pro: 149900,
  monthly: 299900,
  unlimited: 999900,
};
const MIN_PAISE = 100; // Razorpay minimum order is ₹1

// Shared with verify-payment: validate a discount coupon for a plan and return
// the discounted amount in paise. Throws (string) with a user-facing reason if
// the coupon is not usable. Returns the base amount unchanged when no code given.
export async function applyDiscount(
  admin: ReturnType<typeof adminClient>,
  basePaise: number,
  plan: string,
  code: string | null | undefined,
  userEmail: string,
): Promise<{ amount: number; coupon: string | null }> {
  const norm = (code || "").trim().toUpperCase();
  if (!norm) return { amount: basePaise, coupon: null };

  const { data: c, error } = await admin.from("coupons").select("*").eq("code", norm).maybeSingle();
  if (error) throw "Could not check coupon. Please try again.";
  if (!c) throw "Invalid coupon code.";
  if (c.status !== "active") throw "This coupon is no longer active.";
  if (c.kind !== "discount") throw "This is not a discount code.";
  if (c.applies_to_plan && c.applies_to_plan !== "all" && c.applies_to_plan !== plan)
    throw `This coupon is not valid for the ${plan} plan.`;
  if (c.assigned_to && String(c.assigned_to).toLowerCase() !== userEmail.toLowerCase())
    throw "This coupon is assigned to a different account.";
  if (c.max_uses != null && (c.used_count || 0) >= c.max_uses) throw "This coupon has reached its usage limit.";

  let amount = basePaise;
  const val = Number(c.discount_value) || 0;
  if (c.discount_type === "percent") {
    amount = Math.round(basePaise * (1 - Math.min(Math.max(val, 0), 100) / 100));
  } else { // 'flat' rupees off
    amount = basePaise - Math.round(val * 100);
  }
  if (amount < MIN_PAISE) amount = MIN_PAISE;
  return { amount, coupon: norm };
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

    const { plan, coupon } = await req.json();
    const basePaise = PRICE_PAISE[plan];
    if (!basePaise) return j({ error: "unknown plan" }, 400);

    // Apply discount coupon server-side (no-op if none). Reject invalid codes.
    let amount = basePaise;
    let appliedCoupon: string | null = null;
    try {
      const r = await applyDiscount(admin, basePaise, plan, coupon, user.email || "");
      amount = r.amount; appliedCoupon = r.coupon;
    } catch (reason) {
      return j({ error: String(reason) }, 400);
    }

    // Bind the order to the authenticated user — email comes from the token.
    // notes[base_amount] is the canonical pre-discount price: verify-payment reads
    // it back from the order so the price lives in ONE place (this function) and the
    // two functions can never drift out of sync.
    const noteFields: Record<string, string> = {
      amount: String(amount),
      currency: "INR",
      receipt: `rg_${plan}_${Date.now()}`,
      "notes[plan]": plan,
      "notes[base_amount]": String(basePaise),
      "notes[user_id]": user.id,
      "notes[email]": user.email || "",
    };
    if (appliedCoupon) noteFields["notes[coupon]"] = appliedCoupon;
    const body = new URLSearchParams(noteFields);

    const rp = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${KEY_ID}:${KEY_SECRET}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const order = await rp.json();
    if (!rp.ok) return j({ error: order?.error?.description || "Could not create order" }, 502);

    return j({
      key_id: KEY_ID,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      base_amount: basePaise,
      coupon: appliedCoupon,
      discounted: appliedCoupon != null,
    });
  } catch (e) {
    return j({ error: String((e as Error)?.message || e) }, 500);
  }
});
