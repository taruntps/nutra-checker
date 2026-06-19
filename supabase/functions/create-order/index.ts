// Supabase Edge Function: create-order
// Creates a Razorpay order for a plan upgrade. The amount is decided here
// (server-side) from a fixed price table — the browser cannot choose its own price.
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

    const { plan } = await req.json();
    const amount = PRICE_PAISE[plan];
    if (!amount) return j({ error: "unknown plan" }, 400);

    // Bind the order to the authenticated user — email comes from the token.
    const body = new URLSearchParams({
      amount: String(amount),
      currency: "INR",
      receipt: `rg_${plan}_${Date.now()}`,
      "notes[plan]": plan,
      "notes[user_id]": user.id,
      "notes[email]": user.email || "",
    });

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

    return j({ key_id: KEY_ID, order_id: order.id, amount: order.amount, currency: order.currency });
  } catch (e) {
    return j({ error: String((e as Error)?.message || e) }, 500);
  }
});
