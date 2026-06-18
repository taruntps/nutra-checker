// Supabase Edge Function: create-order
// Creates a Razorpay order for a plan upgrade. Replaces the Render /create-order.
// The amount is decided here (server-side) from a fixed price table — the browser
// cannot choose its own price. verify-payment re-checks the amount after payment.
//
// Required secrets (already set for verify-payment):
//   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Price per plan in paise (₹1 = 100 paise). Keep in sync with verify-payment.
const PRICE_PAISE: Record<string, number> = {
  basic: 49900,
  pro: 149900,
  monthly: 299900,
  unlimited: 999900,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return j({ error: "method not allowed" });

  try {
    const KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!KEY_ID || !KEY_SECRET) return j({ error: "razorpay secrets not configured" });

    const { plan, email, name } = await req.json();
    const amount = PRICE_PAISE[plan];
    if (!amount) return j({ error: "unknown plan" });

    // Create the order on Razorpay
    const body = new URLSearchParams({
      amount: String(amount),
      currency: "INR",
      receipt: `rg_${plan}_${Date.now()}`,
      "notes[plan]": plan,
      "notes[email]": email || "",
      "notes[name]": name || "",
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
    if (!rp.ok) return j({ error: order?.error?.description || "Could not create order" });

    return j({
      key_id: KEY_ID,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (e) {
    return j({ error: String((e as Error)?.message || e) });
  }
});
