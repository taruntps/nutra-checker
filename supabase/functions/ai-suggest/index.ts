// Supabase Edge Function: ai-suggest
// Resolves an unknown nutraceutical ingredient against the regulatory DB using Claude.
//
// Request  (POST JSON): { ingredient: string, dbList: string[] }
// Response (JSON):      { found, relationship, match, schedule, explanation }
//
// Required secret: ANTHROPIC_API_KEY
// SECURITY: requires a logged-in user (prevents anonymous Claude credit drain).
// RATE LIMIT: per-user daily cap enforced via ai_usage table (increment_ai_usage RPC).

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

// Daily AI-suggest call limits by plan. Keep in sync with extract-ingredients.
const SUGGEST_LIMITS: Record<string, number> = {
  free: 5, basic: 10, pro: 100, monthly: 200, unlimited: 500,
};

const MODEL = "claude-sonnet-4-6";

const TOOL = {
  name: "report_match",
  description: "Report whether the unlisted ingredient has a genuine equivalent in the regulatory list.",
  input_schema: {
    type: "object",
    properties: {
      found: { type: "boolean" },
      relationship: { type: "string", enum: ["derived_from", "extracted_from", "salt_form", "active_compound", "same_source", ""] },
      match: { type: "string", description: "EXACT name copied from the provided list, or empty string." },
      schedule: { type: "string" },
      explanation: { type: "string" },
    },
    required: ["found", "relationship", "match", "schedule", "explanation"],
    additionalProperties: false,
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return j({ found: false, error: "method not allowed" }, 405);

  try {
    const admin = adminClient();
    const user = await getUser(req, admin);
    if (!user) return j({ found: false, error: "unauthorized" }, 401);

    const KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!KEY) return j({ found: false, error: "anthropic key not configured" }, 500);

    const { ingredient, dbList } = await req.json();
    if (!ingredient || typeof ingredient !== "string") return j({ found: false, error: "ingredient required" }, 400);
    if (ingredient.length > 200) return j({ found: false, error: "ingredient too long" }, 400);

    // Rate limit: check + increment before calling Anthropic.
    const { data: profile } = await admin.from("profiles").select("plan").eq("id", user.id).maybeSingle();
    const plan = (profile?.plan as string) || "free";
    const limit = SUGGEST_LIMITS[plan] ?? SUGGEST_LIMITS.free;
    try {
      const { data: newCount, error: rlErr } = await admin.rpc("increment_ai_usage", { p_user_id: user.id, p_kind: "suggest" });
      if (!rlErr && typeof newCount === "number" && newCount > limit) {
        return j({ found: false, error: `Daily AI suggestion limit reached (${limit}/day on ${plan} plan). Upgrade your plan for more.` }, 429);
      }
    } catch (_e) { /* non-fatal: allow call if tracking fails */ }

    const list = Array.isArray(dbList) ? dbList.slice(0, 300).map(String) : [];

    const system =
      "You are an Indian FSSAI nutraceutical regulatory expert. You map an UNLISTED ingredient name " +
      "to the closest equivalent that IS present in the provided regulatory database list, based on a real " +
      "scientific relationship (the unlisted item is derived from, extracted from, a salt/ester form of, the " +
      "active compound of, or shares the same biological source as a listed item). " +
      "Only return found=true when the relationship is genuine and specific. If there is no real regulatory " +
      "equivalent in the list, return found=false. Never invent a match that is not in the list.";

    const userMsg =
      `Unlisted ingredient: "${ingredient}"\n\n` +
      `Regulatory database list (the ONLY items you may match against):\n${list.join("\n")}\n\n` +
      `Call report_match. If a genuine equivalent exists, set found=true, match=the EXACT name from the list, ` +
      `relationship, schedule (if evident else ""), and a one-sentence explanation. Otherwise found=false with empty strings.`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system,
        tools: [TOOL],
        tool_choice: { type: "tool", name: "report_match" },
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!resp.ok) {
      console.error("anthropic error:", resp.status, await resp.text());
      return j({ found: false, error: "ai backend error" }, 502);
    }

    const data = await resp.json();
    const toolBlock = (data.content || []).find((b: { type: string }) => b.type === "tool_use");
    let out: Record<string, unknown> = toolBlock?.input ?? { found: false };

    // Guard: only allow a match that is actually in the supplied list.
    if (out.found && out.match && !list.includes(String(out.match))) {
      out = { found: false, relationship: "", match: "", schedule: "", explanation: "" };
    }

    return j(out);
  } catch (e) {
    return j({ found: false, error: String((e as Error)?.message || e) }, 500);
  }
});
