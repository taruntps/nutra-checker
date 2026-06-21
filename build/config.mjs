// Regulyze Ingredient Intelligence pipeline — configuration
// Single source of classification. Adding a regulatory framework or product
// category is a CONFIG change here, never a structural change (per architecture).

export const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://afttrokqchfcpjcekuyh.supabase.co";
// anon key is public (already shipped in app/index.html); read-only on regulation_data.
export const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmdHRyb2txY2hmY3BqY2VrdXloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTM2NzgsImV4cCI6MjA5NzI2OTY3OH0.JGL-oFajC4PWLcvqOhPCSOywUIgYw5Vz6V7u5kCuU9Q";

// ── Frameworks (extensible — add objects, never restructure) ─────────────────
export const FRAMEWORKS = {
  "india-fssai": {
    label: "India — FSSAI",
    source_default: "FSS (Health Supplements, Nutraceuticals…) Regulations 2022",
  },
  // future: "us-fda": { label: "USA — FDA", ... }, "eu-efsa": { ... }
};
export const PRIMARY_FRAMEWORK = "india-fssai";

// ── Tab classification ───────────────────────────────────────────────────────
// role: "entity"     → becomes an ingredient page (eligible, subject to data-quality gate)
//       "enrichment" → augments entities (synonyms, conversions, RDA, overages)
//       "synonym"    → trade/synonym mapping
//       "status"     → contributes a regulatory status signal (e.g. prohibited)
//       "skip"       → not used for entity pages in Phase 2 (e.g. NSF product rows)
export const TAB_ROLES = {
  Sched_I_Vitamins:        { role: "entity", category: "vitamin" },
  Sched_I_Minerals:        { role: "entity", category: "mineral" },
  Sched_I_AminoAcids:      { role: "entity", category: "amino-acid" },
  Sched_I_Nucleotides:     { role: "entity", category: "nucleotide" },
  Schedule_II:             { role: "entity", category: "other",     review: true }, // confirm category from data
  Schedule_III_A:          { role: "entity", category: "botanical", review: true },
  Schedule_III_B:          { role: "entity", category: "botanical", review: true },
  Sched_IV_Prebiotics:     { role: "entity", category: "prebiotic" },
  Sched_IV_Probiotics:     { role: "entity", category: "probiotic" },

  Additives_HS_Nutra_PrePro: { role: "entity", category: "additive", gate: "strict" },
  Additives_Tab_Cap_Syrup:   { role: "entity", category: "additive", gate: "strict" },
  GMP_Codex_Additives:       { role: "entity", category: "additive", gate: "strict" },
  GMP_FSSR_Additives:        { role: "entity", category: "additive", gate: "strict" },

  Mineral_Conversions:     { role: "enrichment", kind: "conversion" },
  Vitamin_Conversions:     { role: "enrichment", kind: "conversion" },
  RDA_2020:                { role: "enrichment", kind: "rda" },
  Sched_I_Overages_TableC: { role: "enrichment", kind: "overage" },
  FSSR_Permitted:          { role: "enrichment", kind: "permitted" },

  Trade_Name_Mapper:       { role: "synonym" },

  Not_Permitted_Ingredients: { role: "status", status: "prohibited" },
  NSF_Rejected:            { role: "status", status: "prohibited", note: "NSF closure" },

  NSF_Approved:            { role: "skip", reason: "product/brand-level approvals — status signal, not standalone ingredient pages" },
};

// Heuristics to detect the "name" column when headers vary across tabs.
export const NAME_KEY_PATTERNS = [
  /^ingredient[_\s]?name$/i, /^food[_\s]?additive[_\s]?name$/i,
  /generic[_\s]?name/i, /trade[_\s]?brand[_\s]?name/i,
  /salt[_\s]?form/i, /\bname\b/i, /ingredient/i, /nutrient/i, /substance/i, /additive/i,
];

// Data-quality gates
export const QUALITY = {
  minNameLen: 2,
  maxNameLen: 140,
  // an entity must have a usable name AND at least one status to publish later
  requireStatus: true,
};
