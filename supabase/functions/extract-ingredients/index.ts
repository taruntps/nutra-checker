// Supabase Edge Function: extract-ingredients
// Reads a product label (image or PDF) and extracts the formulation as structured
// text using Claude's vision. Replaces the Render /extract-ingredients endpoint.
//
// Request  (POST JSON): { fileData: base64, mediaType: string, isPDF: bool }
// Response (JSON):      { text, rawText, passCount, warning?, error? }
//   text     — one ingredient per line as "Name   Strength Unit" (2+ spaces before strength)
//   rawText  — the same, returned for the "View raw OCR text" panel
//
// Required secret: ANTHROPIC_API_KEY

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Vision-capable, balanced cost/quality. "claude-opus-4-8" is the most capable.
const MODEL = "claude-sonnet-4-6";

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
  if (req.method !== "POST") return j({ error: "method not allowed" });

  try {
    const KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!KEY) return j({ error: "anthropic key not configured" }, 500);

    const { fileData, mediaType, isPDF } = await req.json();
    if (!fileData) return j({ error: "No file data received." });

    const source = isPDF
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: fileData } }
      : { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: fileData } };

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        messages: [{ role: "user", content: [source, { type: "text", text: PROMPT }] }],
      }),
    });

    if (!resp.ok) {
      const errTxt = await resp.text();
      console.error("anthropic error:", resp.status, errTxt);
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
