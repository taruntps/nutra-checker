// Supabase Edge Function: ai-suggest
// Resolves an unknown nutraceutical ingredient against the regulatory DB using Claude.
// Replaces the Render /ai-suggest endpoint. Same request/response contract.
//
// Request  (POST JSON): { ingredient: string, dbList: string[] }
// Response (JSON):      { found: bool, relationship, match, schedule?, explanation }
//
// Required secret: ANTHROPIC_API_KEY

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Balanced cost/quality. "claude-haiku-4-5" is cheaper; "claude-opus-4-8" is the most capable.
const MODEL = "claude-sonnet-4-6";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return j({ found: false, error: "method not allowed" });

  try {
    const KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!KEY) return j({ found: false, error: "anthropic key not configured" }, 500);

    const { ingredient, dbList } = await req.json();
    if (!ingredient || typeof ingredient !== "string") return j({ found: false, error: "ingredient required" });

    const list = Array.isArray(dbList) ? dbList.slice(0, 300) : [];

    const system =
      "You are an Indian FSSAI nutraceutical regulatory expert. You map an UNLISTED ingredient name " +
      "to the closest equivalent that IS present in the provided regulatory database list, based on a real " +
      "scientific relationship (the unlisted item is derived from, extracted from, a salt/ester form of, the " +
      "active compound of, or shares the same biological source as a listed item). " +
      "Only return found=true when the relationship is genuine and specific. If there is no real regulatory " +
      "equivalent in the list, return found=false. Never invent a match that is not in the list.";

    const user =
      `Unlisted ingredient: "${ingredient}"\n\n` +
      `Regulatory database list (the ONLY items you may match against):\n${list.join("\n")}\n\n` +
      `If a genuine equivalent exists in the list, respond with found=true and:\n` +
      `- relationship: one of derived_from | extracted_from | salt_form | active_compound | same_source\n` +
      `- match: the EXACT name from the list above\n` +
      `- schedule: the schedule/category if evident from the name, else empty string\n` +
      `- explanation: one concise sentence on the relationship.\n` +
      `If no genuine equivalent exists, respond with found=false and empty strings for the other fields.`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system,
        output_config: {
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              properties: {
                found: { type: "boolean" },
                relationship: { type: "string" },
                match: { type: "string" },
                schedule: { type: "string" },
                explanation: { type: "string" },
              },
              required: ["found", "relationship", "match", "schedule", "explanation"],
              additionalProperties: false,
            },
          },
        },
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!resp.ok) {
      console.error("anthropic error:", resp.status, await resp.text());
      return j({ found: false, error: "ai backend error" }, 502);
    }

    const data = await resp.json();
    const textBlock = (data.content || []).find((b: { type: string }) => b.type === "text");
    let out: Record<string, unknown> = { found: false };
    try { out = JSON.parse(textBlock?.text || "{}"); } catch (_e) { out = { found: false }; }

    // Guard: only allow a match that is actually in the supplied list
    if (out.found && out.match && !list.includes(String(out.match))) {
      out = { found: false, relationship: "", match: "", schedule: "", explanation: "" };
    }

    return j(out);
  } catch (e) {
    return j({ found: false, error: String((e as Error)?.message || e) }, 500);
  }
});
