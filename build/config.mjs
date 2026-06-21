// Regulyze Ingredient Intelligence pipeline — configuration
// Single source of classification + EXPLICIT per-tab field mapping (derived from
// the real column names surfaced by the 2.0 governance report). Adding a regulatory
// framework or category is a CONFIG change here, never a structural change.

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
};
export const PRIMARY_FRAMEWORK = "india-fssai";

// ── Tab roles ────────────────────────────────────────────────────────────────
// entity → ingredient page candidate · enrichment → augments · synonym → aliases
// status → contributes a status signal · skip → not used as standalone pages
export const TAB_ROLES = {
  Sched_I_Vitamins:        { role: "entity", category: "vitamin" },
  Sched_I_Minerals:        { role: "entity", category: "mineral" },
  Sched_I_AminoAcids:      { role: "entity", category: "amino-acid" },
  Sched_I_Nucleotides:     { role: "entity", category: "nucleotide" },
  Schedule_II:             { role: "entity", category: "botanical" },
  Schedule_III_A:          { role: "entity", category: "botanical" },
  Schedule_III_B:          { role: "entity", category: "botanical" },
  Sched_IV_Prebiotics:     { role: "entity", category: "prebiotic" },
  Sched_IV_Probiotics:     { role: "entity", category: "probiotic" },

  Additives_HS_Nutra_PrePro: { role: "entity", category: "additive" },
  Additives_Tab_Cap_Syrup:   { role: "entity", category: "additive" },
  GMP_Codex_Additives:       { role: "entity", category: "additive" },
  GMP_FSSR_Additives:        { role: "entity", category: "additive" },

  Mineral_Conversions:     { role: "enrichment", kind: "conversion" },
  Vitamin_Conversions:     { role: "enrichment", kind: "conversion" },
  FSSR_Permitted:          { role: "enrichment", kind: "permitted" },
  RDA_2020:                { role: "enrichment", kind: "rda" },
  Sched_I_Overages_TableC: { role: "enrichment", kind: "overage" },

  Trade_Name_Mapper:       { role: "synonym" },

  Not_Permitted_Ingredients: { role: "status", status: "prohibited" },

  // product/applicant-level rows — not ingredient entities (status signal only, skipped in 2.0)
  NSF_Approved:            { role: "skip", reason: "product/brand-level approvals" },
  NSF_Rejected:            { role: "skip", reason: "product/applicant-level rejections" },
};

// ── EXPLICIT field map per entity tab (real columns) ─────────────────────────
// name: the ingredient-name column · limit: permitted-limit column ·
// common: common-name column · synonyms: columns whose values become synonyms.
export const FIELD_MAP = {
  Sched_I_Vitamins:    { name: "Nutrient",            synonyms: ["Components_Salt_Forms"] },
  Sched_I_Minerals:    { name: "Mineral",             synonyms: ["Chemical_Sources"] },
  Sched_I_AminoAcids:  { name: "Amino_Acid_Nutrient" },
  Sched_I_Nucleotides: { name: "Nucleotide" },
  Schedule_II:         { name: "Official_Common_Name", limit: "Permitted_Range_Adults_per_day", synonyms: ["Botanical_Name_Part_Used"] },
  Schedule_III_A:      { name: "Ingredient", common: "Common_Name", limit: "Permitted_Range_per_day" },
  Schedule_III_B:      { name: "Ingredient", common: "Common_Name" },
  Sched_IV_Prebiotics: { name: "Prebiotic_Compound" },
  Sched_IV_Probiotics: { name: "Microorganism_Name" },
  Additives_HS_Nutra_PrePro: { name: "Food_Additive",      limit: "Max_Permitted_Level", synonyms: ["INS_No"] },
  Additives_Tab_Cap_Syrup:   { name: "Additive",           limit: "Max_Permitted_Level" },
  GMP_Codex_Additives:       { name: "Food_Additive_Name", limit: "Permitted_Level", synonyms: ["INS_No"] },
  GMP_FSSR_Additives:        { name: "Food_Additive_Name", limit: "Permitted_Level", synonyms: ["INS_No"] },
};

// Enrichment field maps
export const ENRICH_MAP = {
  // conversions: parent nutrient ← salt form (salt forms become synonyms of parent)
  conversion: { parent: "Parent_Nutrient", salt: "Salt_Form_As_In_Schedule" },
  // FSSR_Permitted: fills limit/conditions/synonyms by ingredient name
  permitted:  { name: "Ingredient_Name", limit: "Max_Limit", conditions: "Conditions", synonyms: "Synonyms_Alternate_Names", status: "Status" },
};

// Fallback name detection (only if a tab lacks an explicit map entry).
export const NAME_KEY_PATTERNS = [
  /^ingredient[_\s]?name$/i, /^food[_\s]?additive[_\s]?name$/i,
  /generic[_\s]?name/i, /\bname\b/i, /ingredient/i, /nutrient/i, /substance/i, /additive/i,
];
// Columns that are NEVER a name (serial numbers etc.) — note the dotted "S.No".
export const SERIAL_PATTERNS = [/^s[._\s]?no\.?$/i, /^sr/i, /^#/i, /^id$/i, /^note$/i, /^notes$/i];

// Data-quality gates
export const QUALITY = {
  minNameLen: 2,
  maxNameLen: 140,
  requireStatus: true,
  // reject names that are purely numeric (catches mis-mapped serial columns)
  rejectNumericNames: true,
};
