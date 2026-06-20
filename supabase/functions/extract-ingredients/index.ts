// Supabase Edge Function: extract-ingredients
// Reads a product label (image or PDF) and extracts the formulation as structured
// text using Claude's vision.
//
// Request  (POST JSON): { fileData: base64, mediaType: string, isPDF: bool }
// Response (JSON):      { text, rawText, passCount, error? }
//
// Required secret: ANTHROPIC_API_KEY
// SECURITY: requires a logged-in user + caps payload size.
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

// Daily extract call limits by plan. Keep in sync with ai-suggest.
const EXTRACT_LIMITS: Record<string, number> = {
  free: 2, basic: 5, pro: 10, monthly: 20, unlimited: 50,
};

const MODEL = "claude-sonnet-4-6";
const MAX_BASE64 = 30 * 1024 * 1024; // ~22 MB decoded — stays under Anthropic's 32 MB request limit
const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const PROMPT =
  "You are reading a nutraceutical / health-supplement product label. Extract the ingredient " +
  "formulation EXACTLY as printed. Output ONE ingredient per line in this format:\n\n" +
  "Name<two or more spaces>Strength Unit\n\n" +
  "Rules:\n" +
  "- Use 2+ spaces between the ingredient name and its strength (e.g. \"Vitamin C   80 mg\").\n" +
  "- Keep the unit as printed: mg, mcg, g, IU, CFU, %, billion CFU, etc.\n" +
  "- Preserve salt forms and \"(as ...)\" / \"(from ...)\" annotations in the name.\n" +
  "- Include every active ingredient and listed excipient you can read.\n" +
  "- If a strength is not printed for a line, write just the name.\n" +
  "- Do NOT add commentary, headings, numbering, or markdown — output only the ingredient lines.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return j({ error: "method not allowed" }, 405);

  try {
    const admin = adminClient();
    const user = await getUser(req, admin);
    if (!user) return j({ error: "unauthorized" }, 401);

    const KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!KEY) return j({ error: "anthropic key not configured" }, 500);

    // Rate limit: check + increment before calling Anthropic.
    const { data: profile } = await admin.from("profiles").select("plan").eq("id", user.id).maybeSingle();
    const plan = (profile?.plan as string) || "free";
    const limit = EXTRACT_LIMITS[plan] ?? EXTRACT_LIMITS.free;
    try {
      const { data: newCount, error: rlErr } = await admin.rpc("increment_ai_usage", { p_user_id: user.id, p_kind: "extract" });
      if (!rlErr && typeof newCount === "number" && newCount > limit) {
        return j({ error: `Daily label scan limit reached (${limit}/day on ${plan} plan). Upgrade your plan for more.` }, 429);
      }
    } catch (_e) { /* non-fatal: allow call if tracking fails */ }

    const { fileData, mediaType, isPDF } = await req.json();
    if (!fileData || typeof fileData !== "string") return j({ error: "No file data received." }, 400);
    if (fileData.length > MAX_BASE64) return j({ error: "File too large. Please upload a smaller image or PDF." }, 413);

    const mt = String(mediaType || "image/jpeg");
    if (!isPDF && !ALLOWED_IMAGE.includes(mt)) return j({ error: "Unsupported image type." }, 415);

    const source = isPDF
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileData } }
      : { type: "image", source: { type: "base64", media_type: mt, data: fileData } };

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        messages: [{ role: "user", content: [source, { type: "text", text: PROMPT }] }],
      }),
    });

    if (!resp.ok) {
      console.error("anthropic error:", resp.status, await resp.text());
      return j({ error: "Could not analyse the label. Please try a clearer image." }, 502);
    }

    const data = await resp.json();
    const textBlock = (data.content || []).find((b: { type: string }) => b.type === "text");
    const text = (textBlock?.text || "").trim();
    if (!text) return j({ error: "Could not extract ingredients. Try a clearer photo or higher resolution PDF." });

    return j({ text, rawText: text, passCount: 1 });
  } catch (e) {
    return j({ error: String((e as Error)?.message || e) }, 500);
  }
});
