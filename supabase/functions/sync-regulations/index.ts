// Supabase Edge Function: sync-regulations
// Called by the Google Apps Script trigger on every sheet edit (or on-demand).
// Replaces all rows for a single regulation tab atomically.
//
// Request  (POST JSON): { tab_name: string, rows: object[] }
// Authorization:        Bearer <REGULATION_SYNC_SECRET>
// Response (JSON):      { ok: true, tab_name, count } | { error }
//
// Required secrets: REGULATION_SYNC_SECRET (shared with Google Apps Script)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
}

const ALLOWED_TABS = new Set([
  "Sched_I_Vitamins", "Sched_I_Minerals", "Sched_I_AminoAcids", "Sched_I_Nucleotides",
  "Sched_I_Overages_TableC", "Schedule_II", "Schedule_III_A", "Schedule_III_B",
  "Sched_IV_Prebiotics", "Sched_IV_Probiotics", "Additives_HS_Nutra_PrePro",
  "Additives_Tab_Cap_Syrup", "RDA_2020", "GMP_Codex_Additives", "GMP_FSSR_Additives",
  "NSF_Approved", "NSF_Rejected", "FSSR_Permitted", "Trade_Name_Mapper",
  "Not_Permitted_Ingredients", "Mineral_Conversions", "Vitamin_Conversions",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return j({ error: "method not allowed" }, 405);

  const syncSecret = Deno.env.get("REGULATION_SYNC_SECRET");
  if (!syncSecret) return j({ error: "sync secret not configured" }, 500);

  const authHeader = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (authHeader !== syncSecret) {
    console.error("sync-regulations: unauthorized attempt");
    return j({ error: "unauthorized" }, 401);
  }

  try {
    const { tab_name, rows } = await req.json();
    if (!tab_name || typeof tab_name !== "string") return j({ error: "missing tab_name" }, 400);
    if (!Array.isArray(rows)) return j({ error: "rows must be an array" }, 400);
    if (!ALLOWED_TABS.has(tab_name)) return j({ error: "unknown tab: " + tab_name }, 400);
    if (rows.length > 10000) return j({ error: "too many rows (max 10000)" }, 400);

    const admin = adminClient();

    // Delete existing rows for this tab
    const { error: delErr } = await admin.from("regulation_data").delete().eq("tab_name", tab_name);
    if (delErr) {
      console.error("delete failed", tab_name, delErr);
      return j({ error: "delete failed: " + delErr.message }, 500);
    }

    // Insert new rows in batches of 500
    if (rows.length > 0) {
      const now = new Date().toISOString();
      const inserts = rows.map((data, i) => ({
        tab_name,
        row_index: i,
        data,
        updated_at: now,
      }));
      for (let i = 0; i < inserts.length; i += 500) {
        const batch = inserts.slice(i, i + 500);
        const { error: insErr } = await admin.from("regulation_data").insert(batch);
        if (insErr) {
          console.error("insert failed", tab_name, insErr);
          return j({ error: "insert failed: " + insErr.message }, 500);
        }
      }
    }

    console.log("synced", tab_name, rows.length, "rows");
    return j({ ok: true, tab_name, count: rows.length });
  } catch (e) {
    return j({ error: String((e as Error)?.message || e) }, 500);
  }
});
